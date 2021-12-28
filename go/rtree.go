package hello

import (
    "fmt"
    "math"
)

type Point struct {
    x float64
    y float64
}

func (p *Point) Clone () *Point {
    return &Point{x: p.x, y: p.y}
}

type Box struct {
    min *Point
    max *Point
}

func NewBox(points ...Point) *Box {
    b := Box{}
    for _, point := range points {
        b.Extend(&point)
    }
    return &b
}

func (b *Box) Extend (p *Point) {
    if b.min == nil && b.max == nil {
        b.min = p.Clone()
        b.max = p.Clone()
    } else {
        b.min.x = math.Min(b.min.x, p.x)
        b.min.y = math.Min(b.min.y, p.y)
        b.max.x = math.Max(b.max.x, p.x)
        b.max.y = math.Max(b.max.y, p.y)
    }
}

type RTree struct {
    value int
}

func (r *RTree) Search() int {
    return 1
}

func main () {
    fmt.Println("hello, world")
}
