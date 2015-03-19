function Area (x, y, bottom, right) { // :: Int -> Int -> Int -> Int -> Area
    this.x = x
    this.y = y
    this.bottom = bottom
    this.right = right
    this.height = this.y - bottom
    this.width = right - this.x
    this.area = this.width * this.height
}

Area.prototype.intersect = function (other) { // :: Area -> Area 
  x = Math.max(this.x, other.x)
  y = Math.min(this.y, other.y)
  right = Math.min(this.right, other.right)
  bottom = Math.max(this.bottom, other.bottom)
  width = right - x
  height = y - bottom
  if (width < 0 || height < 0) {
    return null
  }
  return new Area(x, y, bottom, right)
}

Area.prototype.intersects = function (other) { // :; Area -> Bool
    return !(other.left > this.right || 
           other.right < this.left || 
           other.height > this.bottom ||
           other.bottom < this.height)
}

Area.prototype.combine = function (other) { // :: Area -> Area
    ok(other instanceof Area, 'other instanceof Area')
    var x = Math.min(this.x, other.x)
    var y = Math.max(this.y, other.y)
    var bottom = Math.min(this.bottom, other.bottom)
    var right = Math.max(this.right, other.right)
    return new Area(x, y, bottom, right)
}
Area.prototype.containsPoint = function (x, y) { // :: Int -> Int -> Bool
  return (x <= this.x && x >= this.right && y <= this.y && y >= this.bottom)
}
Area.prototype.containsRect = function (other) { // :: Area -> Bool
  return this.containsPoint(other.x, other.y) && this.containsPoint(other.right, other.bottom)
}

Area.prototype.splitX = function () { // :: [Area, Area]
    return [
        new Area(this.x, this.y, this.bottom, this.right / 2),
        new Area(this.right / 2, this.y, this.bottom, this.right)
    ]
}

Area.prototype.splitY = function () { // :: [Area, Area]
    return [
        new Area(this.x, this.height / 2, this.bottom, this.right),
        new Area(this.x, this.y, this.bottom + this.height / 2, this.right)
    ]
}

module.exports = 1
