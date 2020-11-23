const path = require('path')
const fs = require('fs').promises
const fileSystem = require('fs')
const Keyify = require('keyify')
const { Recorder, Player } = require('transcript')
const { Readable } = require('stream')
const Interrupt = require('interrupt')
const assert = require('assert')
const coalesce = require('extant')

let latch

class Delineate {
    static Error = Interrupt.create('Delineate.Error', {
        'BLOCK_SHORT_READ': 'incomplete read of block',
        'BLOCK_MISSING': 'block did not parse correct',
        'INVALID_CHECKSUM': 'block contained an invalid checksum'
    })

    static Stream = class extends Readable {
        constructor (delineate, key) {
            super()
            this.delineate = delineate
            this._index = 0
            this._keyified = Keyify.stringify(key)
            this.key = key
            this._blocks = []
            this._logs = this.delineate._logs.slice()
            this._remainder = Buffer.alloc(0)
            this._player = new Player(this.delineate._checksum)
            this._log = 0
        }

        _callback (callback, e = null) {
            return (error, ...vargs) => {
                if (error) {
                    this.destroy(coalesce(e, error))
                } else {
                    callback.apply(this, vargs)
                }
            }
        }

        _close (callback, error = null) {
            fileSystem.close(this._fd, this._callback(callback, error))
        }

        _read () {
            if (this._blocks.length == 0) {
                if (this._index == this.delineate._logs.length) {
                    this.push(null)
                } else {
                    if (this._fd != null) {
                        this._close(() => {
                            this._fd = null
                            this._read()
                        })
                    } else {
                        this._log = this.delineate._logs[this._index++]
                        this._blocks = this.delineate._blocks[this._log][this._keyified].slice()
                        this._read()
                    }
                }
            } else if (this._fd == null) {
                const filename = path.join(this.delineate.directory, String(this._log))
                fileSystem.open(filename, 'r', this._callback(fd => {
                    this._fd = fd
                    this._read()
                }))
            } else {
                const block = this._blocks.shift()
                const buffer = Buffer.alloc(block.length)
                fileSystem.read(this._fd, buffer, 0, buffer.length, block.position, this._callback((read) => {
                    let entries
                    try {
                        Delineate.Error.assert(read == buffer.length, 'BLOCK_SHORT_READ')
                        entries = this._player.split(buffer)
                        Delineate.Error.assert(entries.length == 1, 'BLOCK_MISSING')
                    } catch (error) {
                        this.destroy(error)
                        return
                    }
                    this.push(entries[0].parts[1])
                }))
            }
        }

        _destroy (error, callback) {
            if (this._fd != null) {
                this._close(callback, error)
            } else if (error) {
                callback(error)
            } else {
                callback()
            }
        }
    }

    constructor ({ directory, logs, checksum, blocks }) {
        this.directory = directory
        this._logs = logs
        this._recorder = Recorder.create(checksum)
        this._blocks = blocks
        this._checksum = checksum
        if (this._logs.length == 0) {
            this._blocks[0] = []
            this._logs.push(0)
        }
    }

    static async open ({ directory, checksum = () => 0 }, converter) {
        const dir = await fs.readdir(directory)
        const logs = dir.filter(file => /^\d+$/.test(file))
                        .map(log => +log)
                        .sort((left, right) => left - right)
        const player = new Player(checksum)
        const blocks = {}
        for (const log of logs) {
            blocks[log] = {}
            const readable = fileSystem.createReadStream(path.join(directory, String(log)))
            let position = 0, remainder = 0
            for await (const block of readable) {
                let offset = 0
                for (;;) {
                    const [ entry ] = player.split(block.slice(offset), 1)
                    if (entry == null) {
                        break
                    }
                    const keys = JSON.parse(String(entry.parts[0]))
                                     .map(key => Keyify.stringify(key))
                    const length = entry.sizes.reduce((sum, value) => sum + value, 0)
                    for (const key of keys) {
                        blocks[log][key] || (blocks[log][key] = [])
                        blocks[log][key].push({ position, length })
                    }
                    position += length
                    offset += length - remainder
                    remainder = 0
                }
                remainder = block.length - offset
            }
        }
        return new Delineate({ directory, logs, checksum, blocks })
    }

    // Write a batch of entries to the write-ahead log. `entries` is an array of
    // application specific objects to log. `converter` converts the entry to a
    // set of keys, header and body.
    //
    // The keys are used to reconstruct a file stream from the write-ahead log.
    // The body of the message will be included in the stream constructed for
    // any of the keys in the set of keys. It is up to the application to fish
    // out the relevant content from the body for a given key.

    //
    async write (entries, converter) {
        // **TODO** Capitalize `Recorder` and have a `create` method.
        // **TODO** Sip an entry from Player, read only a single part.
        const { _recorder: recorder } = this
        const log = this._logs[this._logs.length - 1]
        const filename = path.join(this.directory, String(log))
        const handle = await fs.open(filename, 'a')
        try {
            const stat = await handle.stat()
            let position = stat.size
            const buffers = [], positions = {}
            for (const entry of entries) {
                const { keys, body } = converter(entry)
                const keyified = keys.map(key => Keyify.stringify(key))
                const block = recorder([[ Buffer.from(JSON.stringify(keys)) ], [ body ]])
                for (const key of keyified) {
                    positions[key] || (positions[key] = [])
                    positions[key].push({ position, length: block.length })
                }
                position += block.length
                buffers.push(block)
            }
            handle.appendFile(Buffer.concat(buffers))
            handle.sync()
            for (const key in positions) {
                this._blocks[log][key] || (this._blocks[log][key] = [])
                this._blocks[log][key].push.apply(this._blocks[log][key], positions[key])
            }
        } finally {
            await handle.close()
        }
    }

    async rotate () {
        const log = this._logs[this._logs.length - 1] + 1
        const filename = path.join(this.directory, String(log))
        await fs.writeFile(filename, '', { flags: 'wx' })
        this._logs.push(log)
        this._blocks[log] = []
    }

    async shift () {
        if (this._logs.length == 0) {
            return false
        }
        /*
        if (this._logs[0].readers != 0) {
            this._logs[0].latch = {
                promise: new Promise(resolve => latch = { resolve }),
                ...latch
            }
            await this._logs[0].latch.promise
        }
        */
        const log = this._logs.shift()
        const filename = path.join(this.directory, String(log))
        await fs.unlink(filename)
        return true
    }
}

module.exports = Delineate
