const fs = require('fs')

class Delineate {
    constructor (directory) {
        this.directory = directory
    }

    static async open (directory, converter) {
        const dir = await fs.readdir(directory)
        const logs = dir.filter(file => /^d+/.test(file))
        const ordered = logs.sort((left, right) => +left - +right)
        const max = ordered.reduce((max, file) => Math.max(+file, max), 0)
    }

    async write (entries, converter) {
    }
}

module.exports = Delineate
