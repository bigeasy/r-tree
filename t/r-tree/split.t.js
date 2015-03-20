#!/usr/bin/env node

require ('proof')(6, prove)

function prove (assert) {
    var rects = require('../..')

    var area = new rects.Area(0, 10, 0, 10)

    assert(area.splitX(5), [
        new rects.Area(0, 10, 0, 5),
        new rects.Area(5, 10, 0, 10)
    ], "Split x by 5")
    assert(area.splitX(2), [
        new rects.Area(0, 10, 0, 2),
        new rects.Area(2, 10, 0, 10)
    ], "Split x by 2")
    assert(area.splitY(5), [
        new rects.Area(0, 5, 0, 10),
        new rects.Area(0, 10, 5, 10)
    ], "Split y by 5")
    assert(area.splitY(2), [
        new rects.Area(0, 2, 0, 10),
        new rects.Area(0, 10, 2, 10)
    ], "Split y by 2")

    area = new rects.Area(-Infinity, Infinity, -Infinity, Infinity)

    assert(area.splitX(5), [
        new rects.Area(-Infinity, Infinity, -Infinity, 5),
        new rects.Area(5, Infinity, -Infinity, Infinity)
    ], "Split x by 5")
    assert(area.splitY(10), [
        new rects.Area(-Infinity, 10, -Infinity, Infinity),
        new rects.Area(-Infinity, Infinity, 10, Infinity)
    ], "Split x by 10")
}
