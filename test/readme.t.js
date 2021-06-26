require('proof')(2, async okay => {
    const Box = require('../box').Box
    const RTree = require('..')

    const Turnstile = require('turnstile')
    const Fracture = require('fracture')
    const Trampoline = require('reciprocate')
    const Destructible = require('destructible')
    const Cache = require('magazine')
    const WriteAhead = require('writeahead')

    const fs = require('fs').promises
    const path = require('path')

    const directory = path.resolve(__dirname, 'tmp')

    await fs.rmdir(directory, { recursive: true })
    await fs.mkdir(directory, { recursive: true })

    const destructible = new Destructible('r-tree')

    // How about we create it if it doesn't exist and report that it was
    // created? You can simply suppress the create behavior.


    const turnstile = new Turnstile(destructible.durable('turnstile'))

    //
    destructible.ephemeral($ => $(), 'test', async () => {
        const writeahead = new WriteAhead(destructible.durable('writeahead'), turnstile, await WriteAhead.open({ directory }))
        const rtree = new RTree(destructible.durable($ => $(), 'r-tree'), await RTree.open({
            turnstile: turnstile,
            writeahead: writeahead,
            directory: directory,
            cache: new Cache,
            create: true
        }))

        const trampoline = new Trampoline

        rtree.insert(trampoline, Fracture.stack(), new Box([[ 0, 0 ], [ 5, 5 ]]), [ Buffer.from('a') ])
        while (trampoline.seek()) {
            await trampoline.shift()
        }

        rtree.insert(trampoline, Fracture.stack(), new Box([[ 5, 5 ], [ 10, 10 ]]), [ Buffer.from('b') ])
        while (trampoline.seek()) {
            await trampoline.shift()
        }

        const found = await rtree.search(new Box([[ 0, 0 ], [ 3, 3 ]]))

        okay(found.map(node => node.parts[0].toString()), [ 'a' ], 'found')

        destructible.destroy()
    })

    await destructible.promise

    okay('done')
})
