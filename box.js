class Box {
    constructor (left, top, bottom, right) { // :: Int -> Int -> Int -> Int -> Area
        this.left = left
        this.top = top
        this.bottom = bottom
        this.right = right
        this.height = this.top - bottom
        this.width = right - this.left
        this.area = this.width * this.height
    }

    intersect (other) { // :: Area -> Area
      var left = Math.max(this.left, other.left),
          top = Math.min(this.top, other.top),
          bottom = Math.max(this.bottom, other.bottom),
          right = Math.min(this.right, other.right),
          width = right - left,
          height = top - bottom
      if (width < 0 || height < 0) {
        return null
      }
      return new Box(left, top, bottom, right)
    }

    intersects (other) { // :; Area -> Bool
        return ((other.left < this.right && this.right < other.right) ||
               (other.left < this.left && this.right < other.right) ||
               (other.top  > this.top && this.top < other.bottom) ||
               (other.bottom < this.top && this.top < other.top))
    }

    combine (other) { // :: Box -> Box
        var left = Math.min(this.left, other.left)
        var top = Math.max(this.top, other.top)
        var bottom = Math.min(this.bottom, other.bottom)
        var right = Math.max(this.right, other.right)
        return new Box(left, top, bottom, right)
    }

    containsPoint (x, y) { // :: Int -> Int -> Bool
      return (x >= this.left && x <= this.right && y <= this.top && y >= this.bottom)
    }

    containsRect (other) { // :: Box -> Bool
      return this.containsPoint(other.left, other.top) && this.containsPoint(other.right, other.bottom)
    }

    splitX (split) { // :: [Box, Box]
        return [
            new Box(this.left, this.top, this.bottom, split),
            new Box(split, this.top, this.bottom, this.right)
        ]
    }

    splitY (split) { // :: [Box, Box]
        var bottom
        if (!isFinite(this.bottom)) {
            bottom = split
        }
        return [
            new Box(this.left, split, this.bottom, this.right),
            new Box(this.left, this.top, bottom || this.bottom + split, this.right)
        ]
    }

    static INFINATE = {
        constainsRect () { return true },
        containsPoint () { return true },
        intersects () { return true }
    }
}

exports.Box = Box
