#!/usr/bin/env node

require ('proof')(3, prove)

function prove (assert) {
    var rects = require('../../area.js')

    var a = new rects.Area(0, 5, 0, 5)
    var b = new rects.Area(0, 7, 0, 7)
    var c = new rects.Area(5, 10, 5, 10)
    var d = new rects.Area(15, 5, 0, 20)

    assert(a.combine(b), b, "Combined (0, 5, 0, 5) and (0, 7, 0, 7)" )
    assert(b.combine(c), new rects.Area(0, 10, 0, 10), "Combined (0, 5, 0, 5) and (0, 7, 0, 7)" )
    assert(c.combine(d), new rects.Area(5, 10, 0, 20), "Combined (0, 5, 0, 5) and (0, 7, 0, 7)" )
}
