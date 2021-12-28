pub struct Point {
    x: i32,
    y: i32,
}

pub struct Box {
    min: Point,
    max: Point,
}

impl Box {
    pub fn hieght(&self) -> i32 {
        (self.max.y - self.min.y).abs()
    }

    pub fn width(&self) -> i32 {
        (self.max.x - self.min.x).abs()
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn it_works() {
        let result = 2 + 2;
        assert_eq!(result, 4);
    }
}
