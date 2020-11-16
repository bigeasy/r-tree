require ('proof')(27, prove)

function prove (okay) {
    const Area = require('../area.js').Area

    {
        const a = new Area(0, 5, 0, 5)
        const b = new Area(0, 7, 0, 7)
        const c = new Area(5, 10, 5, 10)
        const d = new Area(15, 5, 0, 20)
        const e = new Area(-20, 10, -20, 10)

        okay(a.combine(b), b, "Combined (0, 5, 0, 5) and (0, 7, 0, 7)" )
        okay(b.combine(c), new Area(0, 10, 0, 10), "Combined (0, 5, 0, 5) and (0, 7, 0, 7)" )
        okay(c.combine(d), new Area(5, 10, 0, 20), "Combined (0, 5, 0, 5) and (0, 7, 0, 7)" )
        okay(e.combine(d), new Area(-20, 10, -20, 20), "Combined")
    }

    {
        const a = new Area(-10, 5, -5, 0)
        const b = new Area(0, 7, 0, 7)

        okay(a.containsPoint(-2, -2), true, "Square(-10, 5, -5, 0) contains point(-2, -2)")
        okay(b.containsPoint(2,2), true , "Square(0,7,0,7) contains point(2,2)")
        okay(b.containsPoint(0,0), true , "Square(0,7,0,7) contains point(0,0)")
        okay(b.containsPoint(8,8), false , "Square(0,7,0,7) doesn't contain point(8,8)")
    }

    {
        const a = new Area(0, 5, 0, 5)
        const b = new Area(0, 7, 0, 7)
        const c = new Area(5, 10, 5, 10)
        const d = new Area(-15, 5, 0, 20)

        okay(b.containsRect(a), true, "(0, 5, 0, 5) is contained by (0, 7, 0, 7)")
        okay(c.containsRect(d), false, "(5, 10, 5, 10) does not contain (15, 5, 0, 20)")
        okay(d.containsRect(a), true, "(-15, 5, 0, 20) contains (0, 5, 0, 5)")
    }

    {
        const a = new Area(0, 5, 2, 5)
        const b = new Area(0, 7, 0, 7)
        const c = new Area(5, 10, 5, 10)
        const d = new Area(15, 5, 0, 20)
        const e = new Area(-5, 5, -3, 2)

        okay(b.intersect(a), new Area(0, 5, 2, 5), "Intersect of (0, 5, 2, 5) and (0, 7, 0, 7) is (0, 5, 2, 5)")
        okay(a.intersect(c), new Area(5, 5, 5, 5), "Intersect of (0, 5, 7, 5) and (5, 10, 5, 10) is (5, 5, 7, 5)")
        okay(b.intersect(c), new Area(5, 7, 5, 7), "Intersect of (0, 7, 0, 7) and (5, 10, 5, 10) is (5, 7, 5, 7)")
        okay(c.intersect(d), null, "Intersect of (5, 10, 5, 10) and (15, 5, 0, 20) is null")
        okay(e.intersect(a), new Area(0, 5, 2, 2), "Intersect of (0, 5, 2, 5) and (-5, 5, -3, 2) is (0, 5, 2, 2)")
    }

    {
        const a = new Area(0, 5, 0, 5)
        const b = new Area(0, 7, 0, 7)
        const c = new Area(5, 10, 5, 10)
        const d = new Area(15, 5, 0, 20)
        const e = new Area(-15, 10, -5, 20)

        okay(a.intersects(b), true , "Square(0,7,0,7) intersects Square(0,5,0,5")
        okay(b.intersects(c), true , "Square(5,10,5,10) intersects Square(0,7,0,7")
        okay(d.intersects(a), false , "Square(15,5,0,20) doesn't intersect Square(0,5,0,5)")
        okay(d.intersects(a),  false, "Square(15,5,0,20) doesn't intersect Square(15,10,5,20)")
        okay(e.intersects(c), false, "Square(-15,10,-5,20) intersects Square(0,7,0,7")
    }

    {
        let area = new Area(0, 10, 0, 10)

        okay(area.splitX(5), [
            new Area(0, 10, 0, 5),
            new Area(5, 10, 0, 10)
        ], "Split x by 5")
        okay(area.splitX(2), [
            new Area(0, 10, 0, 2),
            new Area(2, 10, 0, 10)
        ], "Split x by 2")

        area = new Area(-Infinity, Infinity, -Infinity, Infinity)

        okay(area.splitX(5), [
            new Area(-Infinity, Infinity, -Infinity, 5),
            new Area(5, Infinity, -Infinity, Infinity)
        ], "Split x with infinite bounds by 5")
    }

    {
        let area = new Area(0, 10, 0, 10)

        okay(area.splitY(5), [
            new Area(0, 5, 0, 10),
            new Area(0, 10, 5, 10)
        ], "Split y by 5")
        okay(area.splitY(2), [
            new Area(0, 2, 0, 10),
            new Area(0, 10, 2, 10)
        ], "Split y by 2")

        area = new Area(-Infinity, Infinity, -Infinity, Infinity)

        okay(area.splitY(10), [
            new Area(-Infinity, 10, -Infinity, Infinity),
            new Area(-Infinity, Infinity, 10, Infinity)
        ], "Split y by 10 with infinite bounds")
    }
}
