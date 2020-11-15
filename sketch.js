async function () {
    const destructible = new Destructible('r-tree')
    const index = async RTree.open(destructible, { directory: 'tmp/r-tree', minimum: 5, create: true })

    const trampoline = new Trampoline

    index.insert(trampoline, [[ 0, 0, 10, 10 ]])
    while (! trampoline.seek()) {
        await trampoline.shift()
    }

    index.contains(trampoline, [ 1, 1, 5, 5 ], items => {
        for (const item of items) {
            console.log(item)
        }
    })
    while (! trampoline.seek()) {
        await trampoline.shift()
    }

    index.intersects(trampoline, [ 5, 5, 12, 12 ], items => {
        for (const item of items) {
            console.log(item)
        }
    })
    while (! trampoline.seek()) {
        await trampoline.shift()
    }

    index.contains(trampoline, [ 1, 1, 5, 5 ], items => {
        for (const item of items) {
            index.remove(trampoline, item)
        }
    })
    while (! trampoline.seek()) {
        await trampoline.shift()
    }
}
