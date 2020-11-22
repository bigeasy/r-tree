const assert = require('assert')
const fs = require('fs').promises
const fileSystem = require('fs')
const path = require('path')
const Cache = require('magazine')
const Box = require('./box').Box
const Turnstile = require('turnstile')
const coalesce = require('extant')
const Fracture = require('./fracture')
Turnstile.Set = require('turnstile/set')

const Interrupt = require('interrupt')

function find (items, id) {
    let mid, low = 0, high = items.length - 1

    while (low <= high) {
        mid = low + ((high - low) >>> 1)
        const compare = id - items[mid].id
        if (compare < 0) high = mid - 1
        else if (compare > 0) low = mid + 1
        else return { found: true, index: mid }
    }

    return { found: false, index: low }
}

const { recorder, Player } = require('transcript')

const serialize = function () {
    const serialize = recorder(() => 0)
    return function (nodes) {
        const buffers = []
        for (const { method, node = {}, parts = [] } of nodes) {
            const json = JSON.stringify({ method, node: { ...node, parts: [] } })
            const buffer = serialize([ Buffer.from(json) ].concat(parts))
            buffers.push(buffer)
        }
        return Buffer.concat(buffers)
    }
} ()


const ROOT = { value: { items: [{ child: '0.0' }] } }

class RTree {
    static _instance = 0

    static Error = Interrupt.create('RTree.Error', {
        INVALID_NODE_ADD: 'invalid duplicate node, node with id %d already exists in page'
    })

    constructor (destructible, options) {
        function createTurnstile (name) {
            if (turnstiles[name]) {
                return turnstiles[name]
            }
            const subDestructible = destructible.durable(name)
            const turnstile = new Turnstile(subDestructible.durable('turnstile'))
            subDestructible.destruct(() => {
                subDestructible.ephemeral('shutdown', async () => {
                    await turnstile.terminate()
                })
            })
            return turnstile
        }
        this.cache = options.cache || new Cache
        this._checksum = function () { return 0 }
        this._recorder = recorder(this._checksum)
        this._cache = this.cache.magazine([ options.directory, RTree._instance++ ])
        this._openedAt = Date.now()
        this._version = 0
        this._balance = { split: 5, merge: 2 }
        const turnstiles = coalesce(options.turnstiles, {})
        this._fracture = {
            administrative: new Fracture(createTurnstile('administrative'), this._commit, this),
            append: new Fracture(createTurnstile('append'), this._append, this)
        }
        // **TODO** Common namespaced turnstiles.
        this._turnstile = new Turnstile(destructible.durable('turnstile'), { turnstiles: 1 })
        this.directory = options.directory
        this._commitId = 0
        destructible.destruct(() => {
            this._turnstile.terminate()
        })
    }

    static async open (destructible, options) {
        const rtree = new RTree(destructible, options)
        return destructible.ephemeral('open', async function () {
            if (options.create) {
                await rtree._create()
            } else {
                await rtree._open()
            }
            return rtree
        })
    }

    async _exists () {
    }

    async _open () {
    }

    // The Magazine documentation scolds the user who holds a reference
    // indefinately because if there are no additional references it will
    // eventually become both least-recently used and referenced and cache
    // eviction will stop immediately.
    //
    // We do reference the root on every descent so it is likely to be one of
    // the most-recently referenced and will not defeat eviction.
    //
    // We do not want our dummy root to be evicted since, although it wouldn't
    // matter much if it was, we can always create this page on every descent.
    // Hmm...

    //
    async _create () {
        await fs.mkdir(path.resolve(this.directory, '0.0'), { recursive: true })
        const branch = serialize([{ method: 'add', node: { id: 0, child: '0.1', box: [] } }])
        await fs.writeFile(path.resolve(this.directory, '0.0', 'page'), branch)
        await fs.mkdir(path.resolve(this.directory, '0.1'), { recursive: true })
        const leaf = serialize([{ method: 'leaf' }])
        await fs.writeFile(path.resolve(this.directory, '0.1', 'page'), leaf)
    }

    _choose (box, path) {
        let index = 0, node = { child: '0.0' }
        for (;;) {
            const entry = this._cache.hold(node.child)
            if (entry == null) {
                return node.child
            }
            if (entry.value.leaf) {
                path.push({ entry })
                return null
            } else {
                let maxIncrease = Infinity, maxArea = Infinity
                for (let i = 0, I = entry.value.items.length; i < I; i++) {
                    const item = entry.value.items[i]
                    const branch = new Box(item.box)
                    const extended = new Box(item.box).extend(box.points)
                    const increase = extended.area - box.area
                    if (increase < maxIncrease) {
                        maxIncrease = increase
                        index = i
                    } else if (increase == maxIncrease) {
                        if (extended.area < maxArea) {
                            maxArea = extended.area
                            index = i
                        }
                    }
                }
                node = entry.value.items[index]
                path.push({ entry, node })
            }
        }
    }

    _nextId (leaf) {
        let id
        do {
            id = this._id++
        } while (leaf ? id % 2 == 0 : id % 2 == 1)
        return String(this.instance) + '.' +  String(id)
    }

    // Logging works like this. We write out to a file in a transaction
    // directory a version number or id and a list of all the pages in the
    // transaction. This is just JSON. It's short. The hash of the file is in
    // the file name. Order of files in the directory does not matter.

    // We then perform the writes on each page, split up. Can we do this in
    // parallel? Sure we can use something like `Fracture`. We are not using our
    // queue for locking, so that is different from Strata.

    // When all our writes are finished we can unlink that file. When the file
    // is unlinked the writes are committed. If the file does not get unlinked
    // then the writes did not commit.

    // When we restart we read the directory. If there are files they indicate
    // pages with failed commits. We append an entry to those pages, a
    // 'rollback' entry.

    // When we read with gather up the changes into an array. If we see
    // 'rollback' we discard the array. When we see the version change we apply
    // the changes in the array.

    // We can have a copacetic function. That function can iterate the tree
    // using a recursive page id based iteration. We go by sets of pages seen
    // for each page. First unseen page in each branch. Check that the parent
    // contains the child correctly, fix it and log the fix if it does not. Need
    // to allow this to happen in parallel so do need a delete flag on the page
    // if it gets merged out of existence while we are iterating.

    //
    _enqeue (version, log, writes, path) {
        const commit = this._fracture.administrative.enqueue('commit', promise => {
            return { logs: [], promise, id: this._commitId++ }
        })
        commit.logs.push({ version, log, path })
        writes[commit.id] = commit
    }

    async _wally (filename, entries, converter) {
        const { _recorder: recorder } = this, buffers = []
        const handle = await fs.open(filename, 'a')
        try {
            let offset = (await handle.stat()).size
            const buffers = []
            for (const entry of entries) {
                const { header, body } = converter(offset, entry)
                const encoded = recorder([ header ])
                offset += encoded.length + body.length
                buffers.push(encoded, body)
            }
            handle.appendFile(Buffer.concat(buffers))
            handle.sync()
        } finally {
            await handle.close()
        }
    }

    async _headers (filename) {
    }

    async _commit ({ value }) {
        const ahead = []
        for (const entry of value.logs) {
            const { log, version } = entry
            const grouped = {}
            for (const entry of log) {
                grouped[entry.id] = true
            }
            ahead.push({ version: version, nodes: log, pages: Object.keys(grouped) })
        }
        const filename = path.resolve(this.directory, 'wal')
        await this._wally(filename, ahead, function (offset, { version, pages, nodes }) {
            const header = Buffer.from(JSON.stringify({ version, pages: Object.keys(pages) }))
            return { header: header, body: serialize(nodes) }
        })
        value.completed = true
    }

    async __commit ({ value }) {
        const { _recorder: recorder } = this, buffers = []
        const map = new Map
        const writes = {}
        for (const entry of value.logs) {
            const { log, version } = entry
            const grouped = {}
            for (const entry of log) {
                grouped[entry.id] = true
                writes[entry.id] || (writes[entry.id] = [])
                writes[entry.id].push(entry)
            }
            map.set(version, grouped)
            const commit = Buffer.from(JSON.stringify({ version, pages: Object.keys(grouped) }))
            buffers.push(recorder([ commit ]))
        }
        const filename = path.resolve(this.directory, 'commits', value.logs[0].version.join('-'))
        await fs.mkdir(path.dirname(filename), { recursive: true })
        await fs.writeFile(filename, Buffer.concat(buffers))
        const appends = {}
        for (const id in writes) {
            const append = this._fracture.append.enqueue(id, promise => {
                return { writes: [], promise, id: this._commitId++ }
            })
            append.writes.push.apply(append.writes, writes[id])
            appends[append.id] = appends
        }
        await this.flush(appends)
        await fs.unlink(filename)
        value.completed = true
    }

    async _write ({ key, value }) {
        const buffers = []
        for (const write of value.writes) {
            buffers.append(serialize(write))
        }
        fs.appendFile(path.resolve(this.directory, key, 'page'), Buffer.concat(buffers))
        value.completed = true
    }

    async flush (writes) {
        for (const key in writes) {
            if (!writes[key].completed) {
                await writes[key].promise
            }
        }
    }

    // **TODO** Gather by version and clear if you see a rollback.
    // **TODO** Determine the greatest node id per page.
    async load (id) {
        const player = new Player(() => 0)
        const readable = fileSystem.createReadStream(path.resolve(this.directory, id, 'page'))
        const page = { id: id, items: [], leaf: false, destroyed: false  }
        for await (const chunk of readable) {
            for (const entry of player.split(chunk)) {
                const header = JSON.parse(entry.parts.splice(0, 1).toString())
                switch (header.method) {
                case 'leaf': {
                        page.leaf = true
                    }
                    break
                case 'add': {
                        const { index, found } = find(page.items, header.node.id)
                        RTree.Error.assert(! found, [ 'INVALID_NODE_ADD', header.node.id ])
                        header.node.parts.push.apply(header.node.parts, entry.parts.slice(1))
                        page.items.splice(index, 0, header.node)
                    }
                    break
                }
            }
        }
        return this._cache.hold(id, page)
    }


    // Insert is recursed until all the pages necessary to perform the insert
    // are cached with references held. The `_chose` method descends the tree to
    // choose a leaf reading pages from the cache. If it has a cache miss, it
    // returns the id of the missed page.

    //
    _insert (trampoline, box, parts, writes, paths) {
        paths.unshift([])
        const miss = this._choose(box, paths[0])
        paths.pop().forEach(part => part.entry.release())
        if (miss != null) {
            trampoline.promised(async () => {
                paths[0].push({ entry: await this.load(miss) })
                this._insert(trampoline, box, parts, writes, paths)
            })
        } else {
            // All inserts and adjustments of areas must be synchronous, the
            // associated writes are pushed into the write-ahead log as a group
            // so the will re-run as a group.
            //
            // Write to specific pages are versioned, so they are only applied
            // if there is a commit message in each speciifc page. Wait, no,
            // then how does each page know if write is any good?
            //
            // Maybe we write the version in the leaf, then the parent, then the
            // grand parent, when descending the tree we take the version and
            // ignore anything that is younger?
            //
            // Or maybe it doesn't matter because we're only ever making
            // indempotent alterations to each page. Expand by this box is going
            // to go result in the same box when it is done. (Better.)
            //
            // But, we can't identify the box by index, we like to sort them
            // when we split , so we're going to need an id for each node. Okay,
            // so let's throw in an id. How do we determine the id? It just
            // needs to be the max id for that page, right?
            //
            // Maybe.
            //
            // And we can zero them when we vacuum.
            //
            // Maybe.
            //
            // What happens if we do reinsert? Not there yet, but it really is
            // just logging that the specific data is supposed to move.
            //
            // Okay. So an id based on page, so it is easy to know what the next
            // id is. That is a node id, and id for the given box. It has little
            // to do with the referrant.

            //
            paths[0].reverse()
            const log = []
            const { entry: { value: leaf } } = paths[0][0]
            // Does this look indempotent to you? You'd have to search the page
            // for the node on replay of the log, but on an in-process  write.
            //
            // When you replay a log it can be sorted by id so that searches are
            // faster, you binary search to find the node, but during operation
            // you can have references to the node in memory.
            //
            // Now you have custom replays so you won't be able to reuse your
            // b-tree serialization.

            // Okay, they are no longer indempotent, they are now versioned.
            const version = [ this._openedAt, this._version++ ]
            const node = { id: leaf.nextId++, box: box.points }
            log.push({
                method: 'add',
                version: version,
                id: leaf.id,
                node: node,
                parts: parts
            })
            // Tempting to have the log played in memory and then repeated as
            // part of recovery, but no, let's just do the work here.
            leaf.items.push(node)
            for (let i = 1, I = paths[0].length; i < I; i++) {
                const { entry: { value: branch }, node } = paths[0][i]
                // Does this look indempotent to you?
                log.push({
                    method: 'extend',
                    version: version,
                    id: branch.id,
                    node: { page: branch.id, node: node.id, box: box.points }
                })
                // Tempting to have the log played in memory and then repeated
                // as part of recovery, but no, let's just do the work here.
                node.box = new Box(node.box).extend(box.points).points
            }

            // Well, we can split now too, can't we? For this implementation we
            // can, but if split starts to include re-insertion I imagine we
            // could use a `Map` or `Set` to track the fact that a node is
            // moving and use that to de-duplicate a move. In fact, you could
            // simply have a `Set` of seen nodes, so long as you hold both pages
            // in memory during the move.
            //
            // Oh, oh. No, you where going to lock the page for a move. Yeesh,
            // is that actually simpiler? The `Set` would be when you visit each
            // node, but the lock would be only when you visit the page. The
            // lock was going to be null if there was no lock. Does this require
            // promises? No, the read lock is just a counter and when it reaches
            // zero you pull the exclusive lock forward. Whatever happened to
            // sequester?

            for (let i = 0, I = paths[0].length; i < I; i++) {
                const { entry: { value: page }, node } = paths[0][i]
                if (page.items.length > this._balance.split) {
                    const { reduced, created } = this._split(page)
                    log.push({ method: 'create', pageId: created.id })
                    const boxes = {
                        reduced: new Box(reduced.items[0].box),
                        created: new Box(created.items[0].box)
                    }
                    for (const item of created.page.items) {
                        boxes.created.extend(new Box(item.box))
                        log.push({ method: 'remove', pageId: reduced.id, item: item.id })
                        log.push({
                            method: 'add',
                            pageId: created.id,
                            nodeId: item.id,
                            properties: properties,
                            shape: item.shape,
                            box: item.box
                        })
                    }
                    reduced.items.forEach(item => boxes.reduced.extend(new Box(item.box)))
                    if (i + 1 == paths[0].length) {
                        // drain
                        log.push({
                            method: 'clear',
                            pageId: '0.0'
                        })
                        const page = createBranch()
                        log.push({
                            method: 'add',
                            pageId: reduced.id,
                            nodeId: item.id,
                            box: item.box,
                            childId: page.id
                        })
                        for (const item of reduced.page.items) {
                            log.push({
                                method: 'add',
                                pageId: page.id,
                                nodeId: item.id,
                                properties: properties,
                                shape: item.shape,
                                box: item.box
                            })
                        }
                    } else {
                        const { entry: { value: branch }, node } = paths[0][i + 1]
                        log.push({
                            method: 'resize',
                            pageId: branch.id,
                            node: node.id,
                            box: boxes.reduced.trbl
                        })
                        log.push({
                            method: 'add',
                            pageId: reduced.id,
                            nodeId: item.id,
                            box: item.box,
                            childId: page.id
                        })
                    }
                }
            }

            this._enqeue(version, log, writes, paths[0])
        }
    }

    insert (trampoline, box, parts, writes = {}) {
        this._insert(trampoline, box, parts, writes, [[]])
    }
}

module.exports = RTree
