package point

import (
    "testing"
)

func TestPoint (t *testing.T) {
    p := NewPoint(1, 1)
    if p.x != 1 || p.y != 1 {
        t.Errorf("bad point")
    }
}
