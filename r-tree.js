class RTree {
    constructor (destructible, options) {
    }

    _insert (trampoline, area, shape, properties, entries) {
        const { path, miss } = this._choose(area, entries[0])
        entries.pop().forEach(entry => entry.release())
        if (miss != null) {
            trampoline.promised(async () => {
                entries[0].push(await this.load(miss))
                entries.unshift([])
                this._insert(trampoline, area, shape, properties, entries)
            })
        } else {
            for (const { page, index } of path) {
                const queue = this._queue(page.id)
                if (index != null) {
                    page[index].area.expand(area)
                    queue.writes.push({ method: 'expand', area: area.shape })
                } else {
                    page.items.push({
                        area: area.shape,
                        shape: shape,
                        properties: properties
                    })
                    queue.writes.push({ method: 'append', area: area.shape })
                }
                if (writes[queue.id] == null) {
                    writes[queue.id] = queue
                }
            }
        }
    }

    insert (trampoline, shape, properties, entries = [[], []]) {
        const area = new Area(shape)
        this._insert(trampoline, area, shape, properties, [[]])
    }
}

module.exports = 1
