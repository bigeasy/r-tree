const Keyify = require('keyify')

let intercept

class Fracture {
    constructor (turnstile, method, object = null) {
        this.turnstile = turnstile
        this._method = method
        this._object = object
        this._map = new Map
        this._key = []
    }

    _enqueue (stringified) {
        const { queue } = this._map.get(stringified)
        this.turnstile.enter({
            method: async entry => {
                queue[0].occupied = true
                const { resolve, key, value } = queue[0]
                resolve(await this._method.call(this._object, { key, value }))
                queue.shift()
                if (queue.length != 0) {
                    this._enqueue(stringified)
                } else {
                    this._map.delete(key)
                }
            },
            body: null,
            vargs: []
        })
    }

    enqueue (key, constructor) {
        const stringified = Keyify.stringify(key)
        let set = this._map.get(stringified)
        if (set == null) {
            this._map.set(stringified, set = {
                queue: [{
                    occupied: false,
                    key: key,
                    value: constructor(new Promise((resolve, reject) => intercept = { resolve, reject })),
                    ...intercept
                }]
            })
            this._enqueue(stringified)
        }
        if (set.queue.length == 1 && set.queue[0].occupied) {
            queue.push({
                occupied: false,
                key: key,
                value: constructor(new Promise((resolve, reject) => intercept = { resolve, reject })),
                ...intercept
            })
        }
        return set.queue[set.queue.length - 1].value
    }
}

module.exports = Fracture
