require('proof')(1, async okay => {
    const Delineate = require('../delineate')

    const path = require('path')
    const fs = require('fs').promises

    const directory = path.join(__dirname, 'tmp', 'delineate')

    await fs.rmdir(directory, { recusive: true })
})
