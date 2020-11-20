const fs = require('fs').promises
const path = require('path')

const ROOT = {
    value: { items: [{ id: '0.0' }] }
}

class RTree {
    static _instance = 0

    constructor (options) {
        this.cache = options.cache
        this._cache = options.cache.cache([ options.directory, RTree._instance++ ])
        this.directory = options.directory
    }

    static async open (destructible, options) {
        const rtree = new RTree(options)
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
        await fs.writeFile(path.resolve(this.directory, '0.0', '0.0'), JSON.stringify([{ id: '0.1', box: [ 0, 0, 0, 0 ] }]))
        await fs.mkdir(path.resolve(this.directory, '0.1'), { recursive: true })
        await fs.writeFile(path.resolve(this.directory, '0.1', '0.0'), JSON.stringify([]))
    }

    _choose (area, entries) {
        let entry = ROOT
        for (;;) {
            const node = entry.value.items[index]
            let entry = this._cache.hold(node.id)
            if (entry == null) {
                return node.id
            }
            entries.push(entry)
            if (entry.value.leaf) {
                return null
            } else {
                for (let i = 0, I = entry.value.items.length; i < I; i++) {
                    const item = entry.value.items[i]
                    const box = new Box(item.area)
                    const extended = box.extend(item.box)
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
    async _write ({ log, path }) {
        for (const entry of log) {
            switch (entry.method) {
            }
        }
        path.forEach(part => part.entry.release())
    }

    _insert (trampoline, area, shape, properties, entries) {
        const miss = this._choose(area, entries[0])
        entries.pop().forEach(entry => entry.release())
        if (miss != null) {
            trampoline.promised(async () => {
                entries[0].push(await this.load(miss))
                entries.unshift([])
                this._insert(trampoline, area, shape, properties, entries)
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
            const node = {
                id: leaf.nextNodeId++,
                box: new Box(box.trbl),
                properties: properties,
                shape: new Shape(shape).points
            }
            log.push({
                method: 'add',
                pageId: leaf.id,
                nodeId: node.id,
                properties: properties,
                shape: shape.points,
                box: box.trbl
            })
            // Tempting to have the log played in memory and then repeated as
            // part of recovery, but no, let's just do the work here.
            leaf.items.push(node)
            for (let i = 1, I = paths[0].length; i < I; i++) {
                const { entry: { value: branch }, node } = paths[0][i]
                // Does this look indempotent to you?
                log.push({
                    method: 'extend',
                    pageId: branch.id,
                    nodeId: node.id,
                    box: box.trbl
                })
                // Tempting to have the log played in memory and then repeated
                // as part of recovery, but no, let's just do the work here.
                node.box.extend(box)
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
                if (page.items.length > this._size.split) {
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

            this._enqueue(log, path[0], writes)
        }
    }

    insert (trampoline, shape, properties, entries = [[], []]) {
        const area = new Area(shape)
        this._insert(trampoline, area, shape, properties, [[]])
    }
}

module.exports = RTree
