/**
 * The Kotlin-flavored sample: what the Dokka plugin will write. Ids are Dokka
 * DRIs; anchors are readable names. It covers top-level functions and
 * properties, extensions with receivers, objects and companions, data, sealed,
 * value and enum classes, suspend and inline functions, type aliases, nullable
 * types and default arguments.
 */
import type { Guide, Model, Package, Token, Type } from "../src/model";
import { ADMON, an, blocks, CODE, deprecated, doc, guide, H, kotlinMember, kw, lit, nm, OL, P, prm, TABLE, tk, tp, ty, type, UL } from "./build";

const K = "org.example.kgeo";
const KC = "org.example.kgeo.coroutines";
const KE = "org.example.kgeo.experimental";

const dri = (pkg: string, cls: string) => `${pkg}/${cls}///PointingToDeclaration/`;
const t = (name: string, pkg = K) => ty(name, dri(pkg, name));
const std = (name: string, pkg = "kotlin") =>
  ty(name, dri(pkg, name), `https://kotlinlang.org/api/core/kotlin-stdlib/${pkg}/-${name.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()}/`);
const DOUBLE = std("Double");
const STRING = std("String");
const BOOLEAN = std("Boolean");
const list = (...item: Token[]) => tk(std("List", "kotlin.collections"), "<", ...item, ">");
const nullable = (...type: Token[]) => tk(...type, "?");
const f = (owner: string, spec: Parameters<typeof kotlinMember>[1]) => kotlinMember(owner, spec);

const shape: Type = type({
  id: dri(K, "Shape"), name: "Shape", kind: "class", modifiers: ["public", "sealed"],
  signature: tk(kw("sealed"), " ", kw("class"), " ", nm("Shape")),
  members: [
    f(`${K}/Shape`, { name: "area", kind: "property", mods: ["abstract"], type: [DOUBLE], nullness: "nonNull", doc: "The area in square meters; never negative." }),
    f(`${K}/Shape`, { name: "describe", mods: ["open"], returns: { type: [STRING], doc: "a description such as `circle r=2.0`" }, doc: "Describes the shape for logs." }),
  ],
  doc: doc({ body: "A closed plane figure.\n\nThe hierarchy is sealed, so a `when` over a shape needs no `else` branch.", notes: [["apiNote", "Subclasses live in this module only; a `when` over [[org.example.kgeo/Shape///PointingToDeclaration/|Shape]] is exhaustive."]] }),
  since: "1.0", source: { path: "org/example/kgeo/Shape.kt", line: 12 },
}, "kotlin");

const circle: Type = type({
  id: dri(K, "Circle"), name: "Circle", kind: "class", modifiers: ["public", "data"],
  signature: tk(kw("data"), " ", kw("class"), " ", nm("Circle"), "(", kw("val"), " ", prm("radius"), ": ", DOUBLE, ", ", kw("val"), " ", prm("label"), ": ", STRING, "? = ", lit("null"), ") : ", t("Shape"), "()"),
  superclass: [t("Shape")], ancestors: [{ id: dri(K, "Shape") }, { id: dri("kotlin", "Any"), url: "https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/-any/" }],
  members: [
    f(`${K}/Circle`, { name: "Circle", kind: "constructor", params: [{ name: "radius", type: [DOUBLE], doc: "the radius in meters" }, { name: "label", type: nullable(STRING), nullness: "nullable", defaultValue: "null", doc: "an optional label" }], doc: "Creates a circle." }),
    f(`${K}/Circle`, { name: "radius", kind: "property", type: [DOUBLE], doc: "The radius in meters." }),
    f(`${K}/Circle`, { name: "label", kind: "property", type: nullable(STRING), nullness: "nullable", doc: "An optional label, or `null`." }),
    f(`${K}/Circle`, { name: "area", kind: "property", mods: ["override"], type: [DOUBLE], overrides: { id: `${K}/Shape/area/#/PointingToDeclaration/` }, doc: "The area: `π r²`." }),
    f(`${K}/Circle`, { name: "copy", params: [{ name: "radius", type: [DOUBLE], defaultValue: "this.radius" }, { name: "label", type: nullable(STRING), nullness: "nullable", defaultValue: "this.label" }], returns: { type: [t("Circle")] }, implicit: true }),
  ],
  doc: doc("A circle: a data class with a default argument and a companion object."), since: "1.0",
}, "kotlin");

const companion: Type = type({
  id: `${K}/Circle.Companion///PointingToDeclaration/`, name: "Circle.Companion", kind: "object", modifiers: ["public", "companion"], enclosing: dri(K, "Circle"),
  signature: tk(kw("companion"), " ", kw("object"), " ", nm("Companion")),
  members: [
    f(`${K}/Circle.Companion`, { name: "UNIT", kind: "property", mods: ["const"], type: [DOUBLE], constant: "1.0", doc: "The unit radius." }),
    f(`${K}/Circle.Companion`, { name: "unit", returns: { type: [t("Circle")], doc: "a circle of radius [[org.example.kgeo/Circle.Companion/UNIT/#/PointingToDeclaration/|UNIT]]" }, doc: "The unit circle." }),
  ],
  doc: doc("Factories for circles."), since: "1.0",
}, "kotlin");

const rect: Type = type({
  id: dri(K, "Rectangle"), name: "Rectangle", kind: "class", modifiers: ["public", "data"],
  signature: tk(kw("data"), " ", kw("class"), " ", nm("Rectangle"), "(", kw("val"), " ", prm("width"), ": ", t("Meters"), ", ", kw("val"), " ", prm("height"), ": ", t("Meters"), " = ", prm("width"), ") : ", t("Shape"), "()"),
  superclass: [t("Shape")], ancestors: [{ id: dri(K, "Shape") }],
  members: [
    f(`${K}/Rectangle`, { name: "Rectangle", kind: "constructor", params: [{ name: "width", type: [t("Meters")], doc: "the width" }, { name: "height", type: [t("Meters")], defaultValue: "width", doc: "the height; a square when left out" }], doc: "Creates a rectangle, or a square when `height` is left out." }),
    f(`${K}/Rectangle`, { name: "area", kind: "property", mods: ["override"], type: [DOUBLE], doc: "Width times height." }),
  ],
  doc: doc("An axis-aligned rectangle."), since: "1.0",
}, "kotlin");

const meters: Type = type({
  id: dri(K, "Meters"), name: "Meters", kind: "class", modifiers: ["public", "value"],
  annotations: [[an("@JvmInline", dri("kotlin.jvm", "JvmInline"), "https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.jvm/-jvm-inline/")]],
  signature: tk(kw("value"), " ", kw("class"), " ", nm("Meters"), "(", kw("val"), " ", prm("value"), ": ", DOUBLE, ") : ", std("Comparable"), "<", t("Meters"), ">"),
  interfaces: [tk(std("Comparable"), "<", t("Meters"), ">")],
  members: [
    f(`${K}/Meters`, { name: "value", kind: "property", type: [DOUBLE], doc: "The length in meters." }),
    f(`${K}/Meters`, { name: "plus", mods: ["operator"], params: [{ name: "other", type: [t("Meters")], doc: "the length to add" }], returns: { type: [t("Meters")], doc: "the sum" }, doc: "Adds two lengths: `a + b`." }),
    f(`${K}/Meters`, { name: "compareTo", mods: ["override"], params: [{ name: "other", type: [t("Meters")] }], returns: { type: [std("Int")] }, doc: "Compares lengths." }),
  ],
  doc: doc({ body: "A length in meters, as a value class: no allocation on the JVM.", notes: [["implNote", "Compiles to a `double` wherever the type is not boxed."]] }), since: "1.1",
}, "kotlin");

const lengthUnit: Type = type({
  id: dri(K, "LengthUnit"), name: "LengthUnit", kind: "enum", modifiers: ["public"],
  signature: tk(kw("enum"), " ", kw("class"), " ", nm("LengthUnit"), "(", kw("val"), " ", prm("factor"), ": ", DOUBLE, ")"),
  members: [
    f(`${K}/LengthUnit`, { name: "METER", kind: "enumConstant", type: [t("LengthUnit")], doc: "The base unit." }),
    f(`${K}/LengthUnit`, { name: "FOOT", kind: "enumConstant", type: [t("LengthUnit")], doc: "International feet.", deprecated: deprecated("Use [[org.example.kgeo/LengthUnit/METER/#/PointingToDeclaration/|METER]].", "1.2") }),
    f(`${K}/LengthUnit`, { name: "factor", kind: "property", type: [DOUBLE], doc: "Meters per unit." }),
  ],
  doc: doc("Units of length."), since: "1.0",
}, "kotlin");

const geometry: Type = type({
  id: dri(K, "Geometry"), name: "Geometry", kind: "object", modifiers: ["public"],
  signature: tk(kw("object"), " ", nm("Geometry")),
  members: [
    f(`${K}/Geometry`, { name: "distance", params: [{ name: "a", type: [t("Point")] }, { name: "b", type: [t("Point")] }], returns: { type: [DOUBLE], doc: "the Euclidean distance" }, doc: "The distance between two points. One of two overloads." }),
    f(`${K}/Geometry`, { name: "distance", params: [{ name: "a", type: [t("Point")], doc: "the first point" }, { name: "b", type: [t("Point")], doc: "the second point" }, { name: "metric", type: [t("Metric")], defaultValue: "Metric.EUCLID", doc: "how to measure" }], returns: { type: [DOUBLE], doc: "the distance under `metric`" }, doc: "The distance between two points under a metric." }),
    f(`${K}/Geometry`, {
      name: "filterShapes", mods: ["inline"], typeParams: [{ name: "reified T", bounds: [[t("Shape")]], doc: "the shape type to keep" }],
      params: [{ name: "shapes", type: list(t("Shape")), doc: "the shapes" }], returns: { type: list(tp("T")), doc: "the shapes of type `T`" },
      doc: { body: [P("Keeps the shapes of one type."), CODE("kotlin", "val circles: List<Circle> = Geometry.filterShapes<Circle>(shapes)")] },
    }),
  ],
  doc: doc("Geometry functions, as a singleton object."), since: "1.0",
}, "kotlin");

const point: Type = type({
  id: dri(K, "Point"), name: "Point", kind: "class", modifiers: ["public", "data"],
  signature: tk(kw("data"), " ", kw("class"), " ", nm("Point"), "(", kw("val"), " ", prm("x"), ": ", DOUBLE, " = ", lit("0.0"), ", ", kw("val"), " ", prm("y"), ": ", DOUBLE, " = ", lit("0.0"), ")"),
  members: [
    f(`${K}/Point`, { name: "Point", kind: "constructor", params: [{ name: "x", type: [DOUBLE], defaultValue: "0.0", doc: "the x coordinate" }, { name: "y", type: [DOUBLE], defaultValue: "0.0", doc: "the y coordinate" }], doc: "Creates a point; both coordinates default to zero." }),
    f(`${K}/Point`, { name: "x", kind: "property", type: [DOUBLE], doc: "The x coordinate." }),
    f(`${K}/Point`, { name: "y", kind: "property", type: [DOUBLE], doc: "The y coordinate." }),
  ],
  doc: doc("A point in the plane."), since: "1.0",
}, "kotlin");

const metric: Type = type({
  id: dri(K, "Metric"), name: "Metric", kind: "interface", modifiers: ["public", "fun"],
  signature: tk(kw("fun"), " ", kw("interface"), " ", nm("Metric")),
  members: [f(`${K}/Metric`, { name: "measure", mods: ["abstract"], params: [{ name: "a", type: [t("Point")] }, { name: "b", type: [t("Point")] }], returns: { type: [DOUBLE] }, doc: "Measures the distance from `a` to `b`." })],
  doc: doc("How to measure distance: a functional interface."), since: "1.1",
}, "kotlin");

const experimental: Type = type({
  id: dri(KE, "ExperimentalGeometry"), name: "ExperimentalGeometry", kind: "annotation", modifiers: ["public"],
  annotations: [tk(an("@RequiresOptIn", dri("kotlin", "RequiresOptIn"), "https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/-requires-opt-in/"))],
  signature: tk(kw("annotation"), " ", kw("class"), " ", nm("ExperimentalGeometry")),
  doc: doc("Marks API that may change without notice. Opt in with `@OptIn(ExperimentalGeometry::class)`."), since: "2.0",
}, "kotlin");

// ---- Guides.

const fn = (owner: string, name: string, params: string[], receiver = "") => `${owner}/${name}/${receiver}#${params.join("#")}/PointingToDeclaration/`;

function guides(): Guide[] {
  const gettingStarted = guide({
    slug: "getting-started", title: "Getting started", order: 1,
    summary: "Add kgeo to a Gradle build and measure a first shape.",
    body: [
      P("kgeo is a small geometry library for Kotlin. This guide adds it to a build and measures two shapes."),
      H(2, "Install"),
      P("Add the dependency to `build.gradle.kts`:"),
      CODE("kotlin", 'dependencies {\n    implementation("org.example:kgeo:2.1.0")\n}'),
      H(2, "First steps"),
      P("Shapes are data classes such as [[org.example.kgeo/Circle///PointingToDeclaration/|Circle]] and [[org.example.kgeo/Rectangle///PointingToDeclaration/|Rectangle]]. Top-level functions such as [[" + fn("org.example.kgeo/", "area", ["Shape"]) + "|area]] measure them:"),
      CODE("kotlin", "fun main() {\n    val shapes = listOf(Circle(2.0), Rectangle(Meters(3.0)))\n    println(shapes.sumOf { area(it) })\n}"),
      ADMON("tip", "Lengths are [[org.example.kgeo/Meters///PointingToDeclaration/|Meters]], a value class: type safety at no cost at run time. [[guide:concepts#lengths|Lengths]] explains more."),
      H(2, "Next steps"),
      UL("[[guide:concepts|Concepts]]: shapes, lengths, distance and extensions.", "[[guide:coroutines/loading|Loading shapes]]: suspending APIs."),
    ],
  });

  const concepts = guide({
    slug: "concepts", title: "Concepts", order: 2,
    summary: "Shapes, lengths, distance and extensions in kgeo.",
    source: { path: "docs/guides/concepts.md", line: 1 },
    body: [
      P("kgeo leans on Kotlin's type system: sealed classes for shapes, a value class for lengths and extensions for convenience."),
      H(2, "Shapes"),
      P("[[org.example.kgeo/Shape///PointingToDeclaration/|Shape]] is a sealed class with these subclasses:"),
      UL(
        [P("[[org.example.kgeo/Circle///PointingToDeclaration/|Circle]], a data class."), UL("Its companion object [[org.example.kgeo/Circle.Companion///PointingToDeclaration/|Circle.Companion]] holds factories such as `unit()`.", "A `label` defaults to `null`.")],
        [P("[[org.example.kgeo/Rectangle///PointingToDeclaration/|Rectangle]], also a data class."), UL("Leave out `height` for a square.")],
      ),
      ADMON("note", "A `when` over a shape needs no `else` branch, because the hierarchy is sealed."),
      H(2, "Lengths"),
      P("[[org.example.kgeo/Meters///PointingToDeclaration/|Meters]] wraps a `Double`. Its [[" + fn("org.example.kgeo/Meters", "plus", ["Meters"]) + "|plus]] operator adds lengths with `+`."),
      TABLE("Length units", ["Unit", "Factor", "Status"], [
        ["[[org.example.kgeo/LengthUnit/METER/#/PointingToDeclaration/|METER]]", "`1.0`", "The base unit"],
        ["[[org.example.kgeo/LengthUnit/FOOT/#/PointingToDeclaration/|FOOT]]", "`0.3048`", "Deprecated since 1.2"],
      ]),
      ADMON("important", "Store lengths as `Meters`, never as a bare `Double`: the compiler then catches unit mix-ups."),
      ADMON("warning", "Boxing a value class (in a generic collection, for example) allocates. Prefer `DoubleArray` in hot loops.", "Boxing"),
      H(2, "Distance"),
      P("[[org.example.kgeo/Geometry///PointingToDeclaration/|Geometry]] has two `distance` overloads: [[" + fn("org.example.kgeo/Geometry", "distance", ["Point", "Point"]) + "|distance(Point, Point)]] and [[" + fn("org.example.kgeo/Geometry", "distance", ["Point", "Point", "Metric"]) + "|distance(Point, Point, Metric)]], which takes a [[org.example.kgeo/Metric///PointingToDeclaration/|Metric]]."),
      CODE("kotlin", "val manhattan = Metric { a, b -> abs(a.x - b.x) + abs(a.y - b.y) }\nGeometry.distance(Point(), Point(3.0, 4.0), manhattan) // 7.0"),
      ADMON("tip", "`Metric` is a `fun interface`, so a lambda converts to it."),
      H(2, "Extensions"),
      P("[[" + fn("org.example.kgeo/", "scaled", ["Double"], "Shape") + "|scaled]] and [[" + fn("org.example.kgeo/", "isDegenerate", [], "Shape") + "|isDegenerate]] extend `Shape`. Import them from `org.example.kgeo`."),
      ADMON("caution", "Extensions resolve statically: a `scaled` you declare on a subclass does not override this one."),
      H(2, "API notes"),
      ADMON("apiNote", "Every function in `Geometry` is pure."),
      ADMON("implSpec", "A `Metric` must be symmetric: `measure(a, b) == measure(b, a)`."),
      ADMON("implNote", "`Meters` compiles to a `double` wherever it is not boxed."),
      H(2, "Further reading"),
      UL(
        "[Sealed classes](https://kotlinlang.org/docs/sealed-classes.html) in the Kotlin documentation.",
        "[[guide:migrating-from-1x#deprecated-functions|Deprecated functions]], in the migration guide.",
        "[[org.example.kgeo/Triangle///PointingToDeclaration/|Triangle]] is not in this model, so the link renders as plain text.",
        "[[guide:faq|FAQ]] does not exist, so this link renders as plain text too.",
      ),
    ],
  });

  const migration = guide({
    slug: "migrating-from-1x", title: "Migrating from 1.x", order: 3,
    summary: "Replace the declarations 2.0 deprecates.",
    body: [
      P("2.0 deprecates a few 1.x declarations. Each has a replacement."),
      H(2, "Deprecated functions"),
      P("[[" + fn("org.example.kgeo/", "totalArea", ["List<Shape>"]) + "|totalArea]] is deprecated. Use `sumOf`:"),
      CODE("kotlin", "// 1.x\nval total = totalArea(shapes)\n\n// 2.0\nval total = shapes.sumOf { it.area }"),
      H(2, "Deprecated units"),
      P("[[org.example.kgeo/LengthUnit/FOOT/#/PointingToDeclaration/|LengthUnit.FOOT]] is deprecated; convert to [[org.example.kgeo/LengthUnit/METER/#/PointingToDeclaration/|METER]] once, at the edge."),
      H(2, "Nullable parsing"),
      P("[[" + fn("org.example.kgeo/", "parseShape", ["String"]) + "|parseShape]] now returns `null` for blank text instead of throwing."),
      ADMON("warning", "Code that caught the exception for blank text must now check for `null`."),
      OL("Update the dependency.", "Fix each deprecation warning.", "Check callers of `parseShape` for `null`."),
    ],
  });

  const loading = guide({
    slug: "coroutines/loading", title: "Loading shapes", group: "Coroutines", order: 1,
    summary: "Load and watch shape files without blocking a thread.",
    body: [
      P("[[" + fn("org.example.kgeo.coroutines/", "loadShapes", ["String"]) + "|loadShapes]] suspends while it reads a file; [[" + fn("org.example.kgeo.coroutines/", "watchShapes", ["String"]) + "|watchShapes]] returns a `Flow` that emits as the file changes."),
      CODE("kotlin", 'suspend fun report() {\n    val shapes = loadShapes("shapes.txt")\n    println("${shapes.size} shapes")\n}'),
      ADMON("note", "Call these from a coroutine, for example inside `runBlocking` or a `viewModelScope`."),
    ],
  });

  return [gettingStarted, concepts, migration, loading];
}

const top = `${K}/`;
const packages: Package[] = [
  {
    id: K, name: K, since: "1.0",
    doc: doc({ body: [P("Shapes and measurements in Kotlin."), UL("Shapes: [[org.example.kgeo/Shape///PointingToDeclaration/|Shape]] and its subclasses.", "Extensions on shapes, such as `scaled`; see [[guide:concepts#extensions|Extensions]]."), P("The [[guide:concepts|Concepts]] guide explains how these fit together.")] }),
    types: [circle, companion, geometry, lengthUnit, meters, metric, point, rect, shape],
    typeAliases: [
      { id: `${K}/ShapeList///PointingToDeclaration/`, name: "ShapeList", signature: tk(kw("typealias"), " ", nm("ShapeList"), " = ", list(t("Shape"))), target: list(t("Shape")), doc: doc("A list of shapes."), since: "1.0" },
      { id: `${K}/Transform///PointingToDeclaration/`, name: "Transform", typeParams: [{ name: "T", doc: blocks("the value type") }], signature: tk(kw("typealias"), " ", nm("Transform"), "<", tp("T"), "> = (", tp("T"), ") -> ", tp("T")), target: tk("(", tp("T"), ") -> ", tp("T")), doc: doc("A function from a value to a value of the same type."), since: "1.1" },
    ],
    functions: [
      f(top, { name: "area", params: [{ name: "shape", type: [t("Shape")], doc: "the shape" }], returns: { type: [DOUBLE], doc: "its area" }, doc: "The area of a shape: a top-level function.", since: "1.0" }),
      f(top, { name: "scaled", receiver: { name: "this", type: [t("Shape")], doc: "the shape to scale" }, params: [{ name: "by", type: [DOUBLE], defaultValue: "1.0", doc: "the scale factor" }], returns: { type: [t("Shape")], doc: "a scaled copy" }, doc: "Scales a shape: an extension function with a default argument." }),
      f(top, {
        name: "parseShape", annotations: [tk(an("@Throws", dri("kotlin", "Throws"), "https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/-throws/"), "(", ty("IOException", "java.io.IOException", "https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/io/IOException.html"), "::", kw("class"), ")")],
        params: [{ name: "text", type: [STRING], doc: "the text form" }], returns: { type: nullable(t("Shape")), nullness: "nullable", doc: "the shape, or `null` when `text` is blank" },
        throws: [{ type: [ty("IOException", "java.io.IOException", "https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/io/IOException.html")], declared: true, doc: "if the text names a file that cannot be read" }],
        doc: { body: "Parses a shape; blank text gives `null`.", notes: [["apiNote", "Returns `null` for blank input instead of throwing, unlike the Java API."]], see: ["[[guide:migrating-from-1x#nullable-parsing|Nullable parsing]], in the migration guide"] },
      }),
      f(top, { name: "totalArea", params: [{ name: "shapes", type: list(t("Shape")) }], returns: { type: [DOUBLE] }, deprecated: deprecated("Use `shapes.sumOf { it.area }`.", "1.2"), doc: "Sums areas." }),
    ],
    properties: [
      f(top, { name: "VERSION", kind: "property", mods: ["const"], type: [STRING], constant: '"2.1.0"', doc: "The library version." }),
      f(top, { name: "defaultUnit", kind: "property", mods: ["var"], type: [t("LengthUnit")], doc: "The unit lengths use when none is given. Mutable." }),
      f(top, { name: "isDegenerate", kind: "property", receiver: { name: "this", type: [t("Shape")] }, type: [BOOLEAN], doc: "Whether the shape has zero area: an extension property." }),
    ],
  },
  {
    id: KC, name: KC, since: "1.2", doc: doc("Suspending APIs for loading shapes."),
    functions: [
      f(`${KC}/`, { name: "loadShapes", mods: ["suspend"], params: [{ name: "path", type: [STRING], doc: "a file path" }], returns: { type: list(t("Shape")), doc: "the shapes in the file" }, doc: { body: [P("Loads shapes without blocking."), CODE("kotlin", 'runBlocking {\n    val shapes = loadShapes("shapes.txt")\n    println(shapes.size)\n}')] } }),
      f(`${KC}/`, { name: "watchShapes", params: [{ name: "path", type: [STRING] }], returns: { type: tk(ty("Flow", dri("kotlinx.coroutines.flow", "Flow")), "<", t("Shape"), ">") }, doc: "Emits shapes as the file changes. Links to a kotlinx type outside this model, so `Flow` renders as plain code." }),
    ],
  },
  { id: KE, name: KE, since: "2.0", doc: doc("Experimental API."), types: [experimental] },
  { id: `${K}.internal`, name: `${K}.internal`, doc: doc("Internal helpers. This package declares nothing public.") },
];

export const kotlinSample: Model = {
  schema: "apidocs/1",
  module: {
    name: "kgeo", version: "2.1.0", languages: ["kotlin"],
    doc: doc({ body: [
      P("A small Kotlin geometry library: the Kotlin-flavored sample for `@elide/apidocs`."),
      P("Start with [[guide:getting-started|Getting started]]."),
      P("It shows what the Dokka plugin writes. See `samples/FEATURES.md` for the list."),
    ] }),
    guides: guides(),
  },
  externals: [
    { prefix: "kotlin", url: "https://kotlinlang.org/api/core/kotlin-stdlib/" },
    { prefix: "java.", url: "https://docs.oracle.com/en/java/javase/25/docs/api/{module}/" },
  ],
  packages,
};
