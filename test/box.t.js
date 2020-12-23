require ('proof')(6, prove)

function prove (okay) {
    const Box = require('../box.js').Box

    {
        const box = new Box([[ 0, 0 ], [ 5, 5 ]])
        okay(box.points, [[ 0, 0 ], [ 5, 5 ]], 'constructor')
        okay(box.contains(new Box([[ 1, 1 ]])), 'contains')
        okay(new Box(box.points).points, [[ 0, 0 ], [ 5, 5 ]], 'clone')
        okay(box.intersects(new Box([[ 5, 5 ], [ 10, 10 ]])), 'intersects')
        okay(!box.intersects(new Box([[ 6, 5 ], [ 10, 10 ]])), 'does not intersect')
        okay(box.intersects(new Box([[ 0, 0 ], [ 10, 10 ]])), 'very much intersects')
    }
}
