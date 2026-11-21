---
title: Getting started
description: Install Geo, then measure your first shape.
sidebar:
  order: 1
---

<!-- sync
samples/java.ts
-->

Geo needs Java 21 or later. ~~Java 17 is supported.~~ Java 17 support ended with 2.0.

## Install

Add the dependency with Gradle:

```kotlin
dependencies {
    implementation("com.example:geo:2.1.0")
}
```

Or with Maven:

```xml
<dependency>
  <groupId>com.example</groupId>
  <artifactId>geo</artifactId>
  <version>2.1.0</version>
</dependency>
```

## Measure a shape

```java
Shape circle = new Circle(2.0);
System.out.println(Shapes.area(circle));
```

```
12.566370614359172
```

The result is in the square of the unit you measured in; [Units](concepts/index.md#units) explains which.

## Checklist

- [x] Add the dependency
- [x] Measure a circle
- [ ] Read [the callouts page](concepts/alerts.md#before-you-start)

Questions go to <mailto:geo@example.com> or https://example.com/geo/issues. Back to [the top](#install).
