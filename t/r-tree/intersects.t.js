#!/usr/bin/env node

require ('proof')(4, prove)

function prove (assert) {
    var rects = require('../..')

    var a = new rects.Area(0, 5, 0, 5)
    var b = new rects.Area(0, 7, 0, 7)
    var c = new rects.Area(5, 10, 5, 10)
    var d = new rects.Area(15, 5, 0, 20)
    var e = new rects.Area(15, 10, 5, 20)

    assert(a.intersects(b), true , "Square(0,7,0,7) intersects Square(0,5,0,5")
    assert(b.intersects(c), true , "Square(5,10,5,10) intersects Square(0,7,0,7")
    assert(d.intersects(a), false , "Square(15,5,0,20) doesn't intersect Square(0,5,0,5)")
    assert(d.intersects(a),  false, "Square(15,5,0,20) doesn't intersect Square(15,10,5,20)")
}
