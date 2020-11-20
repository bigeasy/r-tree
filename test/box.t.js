require ('proof')(3, prove)

function prove (okay) {
    const Box = require('../box.js').Box

    {
        const box = new Box([[ 0, 0 ], [ 5, 5 ]])
        okay(box.points, [[ 0, 0 ], [ 5, 5 ]], 'constructor')
        okay(box.contains(new Box([[ 1, 1 ]])), 'contains')
        okay(new Box(box.points).points, [[ 0, 0 ], [ 5, 5 ]], 'clone')
    }
}
