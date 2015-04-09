#!/usr/bin/env node

require ('proof')(4, prove)

function prove (assert) {
    var rects = require('../../area.js')

    var a = new rects.Area(0, 5, 2, 5)
    var b = new rects.Area(0, 7, 0, 7)
    var c = new rects.Area(5, 10, 5, 10)
    var d = new rects.Area(15, 5, 0, 20)
    
    assert(b.intersect(a), new rects.Area(0, 5, 2, 5), "Intersect of (0, 5, 2, 5) and (0, 7, 0, 7) is (0, 5, 2, 5)")
    assert(a.intersect(c), new rects.Area(5, 5, 5, 5), "Intersect of (0, 5, 7, 5) and (5, 10, 5, 10) is (5, 5, 7, 5)")
    assert(b.intersect(c), new rects.Area(5, 7, 5, 7), "Intersect of (0, 7, 0, 7) and (5, 10, 5, 10) is (5, 7, 5, 7)")
    assert(c.intersect(d), null, "Intersect of (5, 10, 5, 10) and (15, 5, 0, 20) is null")
}
