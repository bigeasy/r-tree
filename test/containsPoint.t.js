require ('proof')(4, prove)

function prove (assert) {
    var rects = require('../area.js')

    var a = new rects.Area(-10, 5, -5, 0)
    var b = new rects.Area(0, 7, 0, 7)

    assert(a.containsPoint(-2, -2), true, "Square(-10, 5, -5, 0) contains point(-2, -2)")
    assert(b.containsPoint(2,2), true , "Square(0,7,0,7) contains point(2,2)")
    assert(b.containsPoint(0,0), true , "Square(0,7,0,7) contains point(0,0)")
    assert(b.containsPoint(8,8), false , "Square(0,7,0,7) doesn't contain point(8,8)")
}
