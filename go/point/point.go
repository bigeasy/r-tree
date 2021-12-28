package point

type Point struct {
    x float64
    y float64
}

func NewPoint (x float64, y float64) *Point {
    return &Point{x: x, y: y}
}
