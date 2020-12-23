class Box {
    constructor (points) {
        this._points = []
        this.extend(points)
    }

    extend (points) {
        for (const point of points) {
            if (this._points.length == 0) {
                this._points = [ point.slice(), point.slice() ]
            } else {
                this._points[0][0] = Math.min(point[0], this._points[0][0])
                this._points[0][1] = Math.min(point[1], this._points[0][1])
                this._points[1][0] = Math.max(point[0], this._points[1][0])
                this._points[1][1] = Math.max(point[1], this._points[1][1])
            }
        }
        return this
    }

    get points () {
        return this._points
    }

    get height () {
        return Math.abs(this._points[1][1] - this._points[0][1])
    }

    get width () {
        return Math.abs(this._points[1][0] - this._points[0][0])
    }

    get area () {
        return this._points.length != 0 ? this.height * this.width : 0
    }

    contains (box) {
        return box._points.length == 2 &&
            this._points.length == 2 &&
            box._points[0][0] >= this._points[0][0] &&
            box._points[0][0] >= this._points[0][1] &&
            box._points[1][0] <= this._points[1][0] &&
            box._points[1][1] <= this._points[1][1]
    }

    intersects (box) {
        return box._points.length == 2 &&
            this._points.length == 2 &&
            box._points[1][0] >= this._points[0][0] &&
            box._points[0][0] <= this._points[1][0] &&
            box._points[1][1] >= this._points[0][1] &&
            box._points[0][1] <= this._points[1][1]
    }
}

exports.Box = Box
