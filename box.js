class Box {
    constructor (points) {
        this.min = points[0].slice()
        this.max = points[0].slice()
        for (let i = 1, I = points.length; i < I; i++) {
            this.extend(points[i])
        }
    }

    extend (point) {
        this.min[0] = Math.min(point[0], this.min[0])
        this.min[1] = Math.min(point[1], this.min[1])
        this.max[0] = Math.max(point[0], this.max[0])
        this.max[1] = Math.max(point[1], this.max[1])
        return this
    }

    get points () {
        return [ this.min, this.max ]
    }

    contains (box) {
        return box.min[0] >= this.min[0] &&
            box.min[0] >= this.min[1] &&
            box.max[0] <= this.max[0] &&
            box.max[1] <= this.max[1]
    }
}

exports.Box = Box
