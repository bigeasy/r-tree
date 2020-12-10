require('proof')(11, async okay => {
    const Delineate = require('../delineate')

    const { Recorder, Player } = require('transcript')

    const recorder = Recorder.create(() => 0)

    const path = require('path')
    const fs = require('fs').promises

    const directory = path.join(__dirname, 'tmp', 'delineate')

    await fs.rmdir(directory, { recursive: true })
    await fs.mkdir(directory, { recursive: true })

    const writes = [{
        version: 0,
        nodes: [{
            page: 0,
            node: 1
        }, {
            page: 0,
            node: 2
        }, {
            page: 1,
            node: 3
        }]
    }, {
        version: 2,
        nodes: [{
            page: 1,
            node: 3
        }]
    }, {
        version: 3,
        nodes: [{
            page: 0,
            node: 3
        }]
    }]

    function writable (entry) {
        const pages = new Set
        for (const node of entry.nodes) {
            pages.add(node.page)
        }
        return {
            keys: [...pages],
            body: recorder([ entry.nodes.map(node => Buffer.from(JSON.stringify(node))) ])
        }
    }

    {
        const delineate = await Delineate.open({ directory })

        await delineate.write(writes, writable)

        const readable = new Delineate.Stream(delineate, 0)

        const player = new Player(() => 0), gathered = []
        for await (const block of readable) {
            for (const entry of player.split(block)) {
                for (const node of entry.parts.map(part => JSON.parse(String(part)))) {
                    gathered.push(node)
                }
            }
        }

        okay(gathered, [{
            page: 0, node: 1
        }, {
            page: 0, node: 2
        }, {
            page: 1, node: 3
        }, {
            page: 0, node: 3
        }], 'write')
    }

    {
        const delineate = await Delineate.open({ directory })

        const readable = new Delineate.Stream(delineate, 0)

        const player = new Player(() => 0), gathered = []
        for await (const block of readable) {
            for (const entry of player.split(block)) {
                for (const node of entry.parts.map(part => JSON.parse(String(part)))) {
                    gathered.push(node)
                }
            }
        }

        okay(gathered, [{
            page: 0, node: 1
        }, {
            page: 0, node: 2
        }, {
            page: 1, node: 3
        }, {
            page: 0, node: 3
        }], 'reopened')
    }

    {
        const delineate = await Delineate.open({ directory })

        await delineate.rotate()

        await delineate.write([{
            version: 3,
            nodes: [{
                page: 2, node: 0
            }, {
                page: 0, node: 4
            }]
        }].concat(writes), writable)

        const readable = new Delineate.Stream(delineate, 0)

        const player = new Player(() => 0), gathered = []
        for await (const block of readable) {
            for (const entry of player.split(block)) {
                for (const node of entry.parts.map(part => JSON.parse(String(part)))) {
                    gathered.push(node)
                }
            }
        }

        okay(gathered, [{
            page: 0, node: 1
        }, {
            page: 0, node: 2
        }, {
            page: 1, node: 3
        }, {
            page: 0, node: 3
        }, {
            page: 2, node: 0
        }, {
            page: 0, node: 4
        }, {
            page: 0, node: 1
        }, {
            page: 0, node: 2
        }, {
            page: 1, node: 3
        }, {
            page: 0, node: 3
        }], 'rotated')
    }

    {
        const delineate = await Delineate.open({ directory })

        const readable = new Delineate.Stream(delineate, 0)

        const player = new Player(() => 0), gathered = []
        for await (const block of readable) {
            for (const entry of player.split(block)) {
                for (const node of entry.parts.map(part => JSON.parse(String(part)))) {
                    gathered.push(node)
                }
            }
        }

        okay(gathered, [{
            page: 0, node: 1
        }, {
            page: 0, node: 2
        }, {
            page: 1, node: 3
        }, {
            page: 0, node: 3
        }, {
            page: 2, node: 0
        }, {
            page: 0, node: 4
        }, {
            page: 0, node: 1
        }, {
            page: 0, node: 2
        }, {
            page: 1, node: 3
        }, {
            page: 0, node: 3
        }], 'rotated reopened')

        await delineate.shift()

        {
            const readable = new Delineate.Stream(delineate, 0)
            gathered.length = 0
            for await (const block of readable) {
                for (const entry of player.split(block)) {
                    for (const node of entry.parts.map(part => JSON.parse(String(part)))) {
                        gathered.push(node)
                    }
                }
            }
        }

        okay(gathered, [{
            page: 2, node: 0
        }, {
            page: 0, node: 4
        }, {
            page: 0, node: 1
        }, {
            page: 0, node: 2
        }, {
            page: 1, node: 3
        }, {
            page: 0, node: 3
        }], 'shifted')
    }

    {
        const delineate = await Delineate.open({ directory })

        const readable = new Delineate.Stream(delineate, 0)

        const player = new Player(() => 0), gathered = []
        for await (const block of readable) {
            for (const entry of player.split(block)) {
                for (const node of entry.parts.map(part => JSON.parse(String(part)))) {
                    gathered.push(node)
                }
            }
        }

        okay(gathered, [{
            page: 2, node: 0
        }, {
            page: 0, node: 4
        }, {
            page: 0, node: 1
        }, {
            page: 0, node: 2
        }, {
            page: 1, node: 3
        }, {
            page: 0, node: 3
        }], 'shifted reopened')

        await delineate.shift()

        {
            const readable = new Delineate.Stream(delineate, 0)
            gathered.length = 0
            for await (const block of readable) {
                for (const entry of player.split(block)) {
                    for (const node of entry.parts.map(part => JSON.parse(String(part)))) {
                        gathered.push(node)
                    }
                }
            }
        }

        okay(gathered, [], 'shifted to empty')

        await delineate.shift()
    }

    {
        const delineate = await Delineate.open({ directory })

        function writable (entry) {
            const pages = new Set
            for (const node of entry.nodes) {
                pages.add(node.page)
            }
            return {
                keys: [...pages],
                body: recorder([ entry.nodes.map(node => Buffer.from(JSON.stringify(node))) ])
            }
        }

        await delineate.write(writes, writable)

        const readable = new Delineate.Stream(delineate, 0)

        await fs.unlink(path.join(__dirname, 'tmp', 'delineate', '0'))

        const errors = []

        try {
            const player = new Player(() => 0), gathered = []
            for await (const block of readable) {
                for (const entry of player.split(block)) {
                    for (const node of entry.parts.map(part => JSON.parse(String(part)))) {
                        gathered.push(node)
                    }
                }
            }
        } catch (error) {
            errors.push(error.code)
        }

        okay(errors, [ 'IO_ERROR' ], 'open error')
    }

    {
        const delineate = await Delineate.open({ directory })

        await delineate.write(writes, writable)

        const readable = new Delineate.Stream(delineate, 0)

        const errors = []

        const player = new Player(() => 0), gathered = []

        try {
            for await (const block of readable) {
                for (const entry of player.split(block)) {
                    readable.destroy(new Error('foo'))
                }
            }
        } catch (error) {
            errors.push(error.message)
        }

        okay(errors, [ 'foo' ], 'user initiated destroy with error')
    }

    // Checking to make sure the above behavior is correct.
    {
        const fileSystem = require('fs')
        const readable = fileSystem.createReadStream(__filename)
        try {
            for await (const block of readable) {
                readable.destroy(new Error('oof'))
            }
        } catch (error) {
            console.log(error.stack)
        }
    }

    {
        const delineate = await Delineate.open({ directory })

        await delineate.write(writes, writable)

        const readable = new Delineate.Stream(delineate, 0)

        const player = new Player(() => 0), gathered = []
        const iterator = readable[Symbol.asyncIterator]()
        await iterator.next()
        await new Promise((resolve, reject) => {
            require('fs').close(readable._fd, error => {
                if (error) {
                    reject(error)
                } else {
                    resolve()
                }
            })
        })
        readable.destroy()
        const error = await new Promise(resolve => readable.once('error', resolve))
        okay(error.code, 'EBADF', 'destroy with bad close')
    }

    {
        const delineate = await Delineate.open({ directory })
        delineate._blocks[0][0][0].length = 0
        const readable = new Delineate.Stream(delineate, 0), errors = []
        try {
            const player = new Player(() => 0)
            for await (const block of readable) {
            }
        } catch (error) {
            errors.push(error.code)
        }
        okay(errors, [ 'IO_ERROR' ], 'assertion error')
    }
})
