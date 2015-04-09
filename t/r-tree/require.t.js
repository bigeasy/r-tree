#!/usr/bin/env node

require('proof')(1, prove)

function prove (assert) {
    assert(require('../..'), 'require')
}
