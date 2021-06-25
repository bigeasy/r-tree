const assert = require('assert')
const fs = require('fs').promises
const fileSystem = require('fs')
const path = require('path')
const Cache = require('magazine')

const ascension = require('ascension')
const whittle = require('whittle')

const Fracture = require('fracture')

const Destructible = require('destructible')

// An asynchronous write-ahead log.
const WriteAhead = require('writeahead')

const Trampoline = require('reciprocate')

const Interrupt = require('interrupt')

// Our bounding rectangle class.
const Box = require('./box').Box

const comparators = {
    findId: whittle(ascension([ Number, Number ]), item => item.id, id => id),
    sortId: whittle(ascension([ Number, Number ]), item => item.id)
}

function find (comparator, items, id) {
    let mid, low = 0, high = items.length - 1

    while (low <= high) {
        mid = low + ((high - low) >>> 1)
        const compare = comparator(items[mid].id, id)
        if (compare > 0) high = mid - 1
        else if (compare < 0) low = mid + 1
        else return { found: true, index: mid }
    }

    return { found: false, index: low }
}

const { Recorder, Player } = require('transcript')

const serialize = function () {
    const recorder = Recorder.create(() => 0)
    return function (nodes) {
        const buffers = []
        for (const entry of nodes) {
            if ('method' in entry) {
                const { method, page = null, json, node, parts = [] } = entry
                const _node = json || node || {}
                const _json = JSON.stringify({ method, page, json: { ..._node, parts: [] } })
                const buffer = recorder([[ Buffer.from(_json) ].concat(parts) ])
                buffers.push(buffer)
            } else {
                const [ object, ...parts ] = entry
                const json = JSON.stringify(object)
                const buffer = recorder([ [ Buffer.from(json) ].concat(parts) ])
                buffers.push(buffer)
            }
        }
        return Buffer.concat(buffers)
    }
} ()

class RTree {
    static _instance = 0

    static Error = Interrupt.create('RTree.Error', {
        INVALID_NODE_ADD: 'invalid duplicate node, node with id %d already exists in page'
    })

    constructor (destructible, options) {
        let capture
        this.cache = options.cache || new Cache
        this._fractures = {
            writeahead: new Fracture(destructible.durable($ => $(), 'writeahead'), options.turnstile, () => ({
                writes: [],
                id: this._writeId++,
                latch: {
                    completed: false,
                    promise: new Promise(resolve => capture = { resolve }),
                    ...capture
                }
            }), this._writeahead, this)
        }
        this._checksum = function () { return 0 }
        this._recorder = Recorder.create(this._checksum)
        this._cache = this.cache.subordinate([ options.directory, RTree._instance++ ])
        this._openedAt = Date.now()
        this._balance = { split: 5, merge: 2 }
        this.directory = options.directory
        this._writeId = 0
        this._version = 0
        this._nodeId = 0
    }

    static async open (destructible, options) {
        const rtree = new RTree(destructible, options)
        return destructible.exceptional('open', async function () {
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
        this._writeahead = await WriteAhead.open({ directory: options.directory })
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
        const branch = serialize([[{ method: 'add', page: '0.0', id: [ 0, 0 ], child: '0.1', box: [], parts: [] }]])
        await fs.writeFile(path.resolve(this.directory, '0.0', 'page'), branch)
        await fs.mkdir(path.resolve(this.directory, '0.1'), { recursive: true })
        const leaf = serialize([{ method: 'leaf', page: '0.1' }])
        await fs.writeFile(path.resolve(this.directory, '0.1', 'page'), leaf)
        await fs.mkdir(path.resolve(this.directory, 'wal'))
        this._writeahead = await WriteAhead.open({ directory: path.resolve(this.directory, 'wal') })
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
    _enqueue (keys, log, writes, path) {
        const commit = this._fractures.writeahead.enqueue('writeahead')
        commit.writes.push({ keys, log, path })
        writes[commit.id] = commit
    }

    // Version is timestamp plus ever incrementing increment.

    // Version is consistent for an update because we hold onto everything and
    // make our log entry synchronously, we push our log entry onto the WAL
    // synchronously, it is every increasing.

    // We write to the WAL in order. Versions only go up.

    // To play the log we gather up values for a given version, then we see a
    // commit entry for that version and we apply them. We start every log entry
    // with a reset instruction to indicate that the previous write did not
    // complete. Always applied regardless of key. Keep max version in page
    // memory. Do not apply changes if your version is greater than max version.

    // Thanks to WAL moves are now atomic. They are in the same file. Written to
    // same file.

    // Could link versions to detect truncations. Truncations of the WAL are
    // just losses. Truncation of primary file means we look in the WAL and hope
    // to pick up where we left off.

    // Start version of fill is [ 0, 0 ]. Maybe use Journalist to ensure that we
    // get a perfect stubby file in place, never have just an empty file due to
    // a bad initial write. Okay, vacuum and create can use Journalist.

    //
    async _writeahead ({ canceled, value: { writes, latch } }) {
        const append = writes.map(({ keys, log }) => ({ keys, body: serialize(log) }))
        await this._writeahead.write(append)
        writes.forEach(write => write.path.forEach(part => part.entry.release()))
        latch.completed = true
        latch.resolve.call(null)
    }

    async flush (writes) {
        for (const key in writes) {
            if (!writes[key].latch.completed) {
                await writes[key].latch.promise
            }
        }
    }

    // **TODO** Gather by version and clear if you see a rollback.
    // **TODO** Determine the greatest node id per page.

    // Note that because of how our cache interface works, if we are in a in a
    // race where two strands are loading loading the page at the same time, the
    // first one to call `hold()` will be the cached entry, the second entry
    // will be discarded.

    //
    async load (id) {
        const player = new Player(() => 0)
        const readable = fileSystem.createReadStream(path.resolve(this.directory, id, 'page'))
        const page = { id: id, items: [], leaf: false, destroyed: false, nextId: 0 }
        for await (const chunk of readable) {
            for (const entry of player.split(chunk)) {
                const header = JSON.parse(entry.parts.shift().toString())
                switch (header.method) {
                case 'leaf': {
                        page.leaf = true
                    }
                    break
                case 'add': {
                        const { index, found } = find(comparators.findId, page.items, header.id)
                        RTree.Error.assert(! found, 'INVALID_NODE_ADD', { id: header.id })
                        page.nextId = Math.max(page.nextId, header.id + 1)
                        header.parts.push.apply(header.parts, entry.parts)
                        page.items.splice(index, 0, header)
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
            // Okay, they are no longer indempotent, they are now versioned.
            const log = [[{
                method: 'version',
                version: [ this._openedAt, this._version++ ]
            }]]
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

            const node = { id: [ this._openedAt, this._nodeId++ ], box: box.points, parts: [] }
            const keys = new Set([ leaf.id ])
            log.push([{
                method: 'add',
                page: leaf.id,
                ...node,
            }].concat(parts))
            node.parts.push.apply(node.parts, parts)
            // Tempting to have the log played in memory and then repeated as
            // part of recovery, but no, let's just do the work here.
            leaf.items.push(node)
            for (let i = 1, I = paths[0].length; i < I; i++) {
                const { entry: { value: branch }, node } = paths[0][i]
                // Tempting to have the log played in memory and then repeated
                // as part of recovery, but no, let's just do the work here.
                const extended = new Box(node.box).extend(box.points)
                if (!new Box(node.box).contains(extended)) {
                    node.box = extended.points
                    keys.add(branch.id)
                    log.push([{
                        method: 'extend',
                        page: branch.id,
                        node: node.id,
                        box: box.points
                    }])
                }
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

            this._enqueue([ ...keys ], log, writes, paths[0])
        }
    }

    insert (trampoline, box, parts, writes = {}) {
        this._insert(trampoline, box, parts, writes, [[]])
    }
    //

    // For the first pass, a naive implementation that might load the entire
    // tree into memory, or else we could just do MVCC.

    // We could, but reshaping the tree would be difficult. We obviously simply
    // mark an entry as deleted, but we don't actually delete it until later.

    // Could leave the nodes sorted by id, so when we decend we can more easily
    // skip already considered entries.

    // We are only ever growing nodes or deleting them. If we have an interation
    // of the three that marks all the candidates in the root by version
    // somehow, when those iterations complete we can start to delete nodes.

    // It will sort itself out. We need to have an iterator iterface, though.

    //
    _descend (box, found, cartridges) {
        let candidates = [ '0.0' ]
        while (candidates.length != 0) {
            const candidate = candidates.shift()
            const cartridge = this._cache.hold(candidate)
            if (cartridge == null) {
                return candidate
            }
            cartridges[0].push(cartridge)
            const page = cartridge.value
            if (page.leaf) {
                for (const item of page.items) {
                    if (new Box(item.box).intersects(box)) {
                        found.push(item)
                    }
                }
            } else {
                for (const item of page.items) {
                    if (new Box(item.box).intersects(box)) {
                        candidates.push(item.child)
                    }
                }
            }
        }
        return null
    }

    _search (box, cartridges, trampoline, consumer) {
        cartridges.unshift([])
        const found = [], miss = this._descend(box, found, cartridges)
        cartridges.pop().forEach(cartridge => cartridge.release())
        if (miss == null) {
            cartridges.pop().forEach(cartridge => cartridge.release())
            consumer(found)
        } else {
            trampoline.promised(async () => {
                cartridges[0].push(await this.load(miss))
                this._search(box, cartridges, trampoline, consumer)
            })
        }
    }

    search (box, trampoline = new Trampoline, consumer = null) {
        if (consumer == null) {
            this._search(box, [[]], trampoline, value => trampoline.set(value))
            return trampoline
        } else {
            this._search(box, [[]], trampoline, consumer)
        }
    }
}

module.exports = RTree
