#!/usr/bin/env node

require ('proof')(4, prove)

function prove (assert) {
    var rects = require('../..')

    var a = new rects.Area(0, 5, 0, 5)
    var b = new rects.Area(0, 7, 0, 7)
    var c = new rects.Area(5, 10, 5, 10)
    var d = new rects.Area(15, 5, 0, 20)

    assert(b.containsPoint(2,2), true , "Square(0,7,0,7) contains point(2,2)")
    assert(b.containsPoint(0,0), true , "Square(0,7,0,7) contains point(0,0)")
    assert(b.containsPoint(8,8), false , "Square(0,7,0,7) doesn't contain point(8,8)")
    assert(b.containsRect(a), true , "Square(0,7,0,7) contains Square(0,5,0,5)")
    assert(d.containsRect(a), false , "Square(15,5,0,20) doesn't intersect Square(0,5,0,5)")


}
