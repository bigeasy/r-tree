require('proof')(1, async okay => {
    const RTree = require('..')

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

    //
    const rtree = await RTree.open(destructible, {
        directory: directory,
        cache: new Cache,
        create: true
    })

    await destructible.destroy().rejected

    okay('done')
})
