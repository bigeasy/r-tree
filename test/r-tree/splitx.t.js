require ('proof')(3, prove)

function prove (assert) {
    var rects = require('../../area.js')

    var area = new rects.Area(0, 10, 0, 10)

    assert(area.splitX(5), [
        new rects.Area(0, 10, 0, 5),
        new rects.Area(5, 10, 0, 10)
    ], "Split x by 5")
    assert(area.splitX(2), [
        new rects.Area(0, 10, 0, 2),
        new rects.Area(2, 10, 0, 10)
    ], "Split x by 2")

    area = new rects.Area(-Infinity, Infinity, -Infinity, Infinity)

    assert(area.splitX(5), [
        new rects.Area(-Infinity, Infinity, -Infinity, 5),
        new rects.Area(5, Infinity, -Infinity, Infinity)
    ], "Split x with infinite bounds by 5")
}
