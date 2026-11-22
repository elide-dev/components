---
title: Custom shapes
description: Write a shape of your own and measure it like the built-in ones.
---

## The contract

A custom shape implements `area()` and `perimeter()`. Both must be finite and not negative.

```java
record Square(double side) implements Shape {
  public double area() { return side * side; }
  public double perimeter() { return 4 * side; }
}
```

## Checking a shape

`Shapes.check` measures a shape twice and compares the results. See [Units](../index.md#units) for the unit the
results are in, and [Getting started](../../getting-started.md) for the setup.
