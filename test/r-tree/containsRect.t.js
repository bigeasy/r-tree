require ('proof')(3, prove)

function prove (assert) {
    var rects = require('../../area.js')

    var a = new rects.Area(0, 5, 0, 5)
    var b = new rects.Area(0, 7, 0, 7)
    var c = new rects.Area(5, 10, 5, 10)
    var d = new rects.Area(-15, 5, 0, 20)

    assert(b.containsRect(a), true, "(0, 5, 0, 5) is contained by (0, 7, 0, 7)")
    assert(c.containsRect(d), false, "(5, 10, 5, 10) does not contain (15, 5, 0, 20)")
    assert(d.containsRect(a), true, "(-15, 5, 0, 20) contains (0, 5, 0, 5)")
}
