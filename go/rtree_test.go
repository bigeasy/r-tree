package hello

import (
    "testing"
)

func TestBox (t *testing.T) {
    b := NewBox(Point{x: 0, y: 0}, Point{x: 5, y: 5})
    if b.min.x != 0 || b.min.y != 0 || b.max.x != 5 || b.max.y != 5 {
        t.Errorf("bad box")
    }
}
