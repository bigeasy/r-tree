require('proof')(1, async okay => {
    const Box = require('../box').Box
    const RTree = require('..')

    const Turnstile = require('turnstile')
    const Fracture = require('fracture')
    const Trampoline = require('reciprocate')
    const Destructible = require('destructible')
    const Cache = require('magazine')

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
    destructible.rescue($ => $(), 'test', async () => {
        const rtree = await RTree.open(destructible.durable($ => $(), 'r-tree'), {
            turnstile: turnstile,
            directory: directory,
            cache: new Cache,
            create: true
        })

        const trampoline = new Trampoline

        rtree.insert(trampoline, new Box([[ 0, 0 ], [ 5, 5 ]]), [ Buffer.from('a') ])
        while (trampoline.seek()) {
            await trampoline.shift()
        }

        rtree.insert(trampoline, new Box([[ 5, 5 ], [ 10, 10 ]]), [ Buffer.from('b') ])
        while (trampoline.seek()) {
            await trampoline.shift()
        }

        destructible.destroy()
    })

    await destructible.rejected

    okay('done')
})
