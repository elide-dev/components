/**
 * The Java-flavored sample: what the Javadoc doclet writes for a small
 * geometry library. Hand-written, except the generated Registry type with
 * hundreds of members. samples/FEATURES.md lists what each page shows.
 */
import type { Guide, Member, Model, Package, Type } from "../src/model";
import {
  ADMON, an, blocks, CODE, deprecated, doc, guide, H, jdk, javaMember, kw, lit, nm, OL, P, QUOTE, RAW, TABLE, tk, tp, ty, type, UL,
} from "./build";

const G = "com.example.geo";
const IO = "com.example.geo.io";
const BIG = "com.example.geo.registry";
const EMPTY = "com.example.geo.spi";

const t = (name: string, pkg = G) => ty(name.replace(/\$/g, "."), `${pkg}.${name}`);
const STRING = jdk("java.lang", "String");
const OBJECT = jdk("java.lang", "Object");
const DOUBLE = kw("double");
const INT = kw("int");
const NULLABLE = an("@Nullable", "org.jspecify.annotations.Nullable", "https://jspecify.dev/docs/api/org/jspecify/annotations/Nullable.html");
const objectRef = { id: "java.lang.Object", url: `https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Object.html` };
const objectMembers = ["equals(java.lang.Object)", "getClass()", "hashCode()", "notify()", "notifyAll()", "toString()", "wait()", "wait(long)", "wait(long,int)"]
  .map(a => ({ id: `java.lang.Object#${a}`, text: a.replace(/\(.*/, ""), url: `${objectRef.url}#${a}` }));
const fromObject = { from: { ...objectRef, text: "Object" }, kind: "class", members: objectMembers };

const m = (owner: string, spec: Parameters<typeof javaMember>[2]) => javaMember(owner, owner.slice(owner.lastIndexOf(".") + 1).replace(/\$/g, "."), spec);

// ---- com.example.geo

const shape: Type = type({
  id: `${G}.Shape`, name: "Shape", kind: "interface", modifiers: ["public", "sealed"],
  signature: tk(kw("public"), " ", kw("sealed"), " ", kw("interface"), " ", nm("Shape"), " ", kw("extends"), " ", jdk("java.lang", "Comparable"), "<", t("Shape"), "> ", kw("permits"), " ", t("Circle"), ", ", t("Polygon")),
  interfaces: [tk(jdk("java.lang", "Comparable"), "<", t("Shape"), ">")],
  permits: [{ id: `${G}.Circle` }, { id: `${G}.Polygon` }],
  members: [
    m(`${G}.Shape`, { name: "area", returns: { type: [DOUBLE], doc: "the area in square meters, never negative" }, doc: "The shape's area.", line: 24 }),
    m(`${G}.Shape`, {
      name: "compareTo", mods: ["default"], params: [{ name: "other", type: [t("Shape")], nullness: "nonNull", doc: "the shape to compare with" }],
      returns: { type: [INT], doc: "a negative number, zero or a positive number as this shape is smaller, equal or larger" },
      doc: { body: "Compares shapes by area.", notes: [["implSpec", "The default compares `area()` with `Double.compare`."]] }, line: 31,
    }),
    m(`${G}.Shape`, { name: "name", mods: ["default"], returns: { type: tk(NULLABLE, " ", STRING), nullness: "nullable", doc: "the name, or `null` for an anonymous shape" }, doc: "Returns the shape's name, or `null` for an anonymous shape.", since: "1.1", line: 40 }),
  ],
  doc: doc({
    body: [P("A closed plane figure."), P("Every shape reports its area in square [[com.example.geo.Units#METERS|meters]]. Shapes order by area, so a `List<Shape>` sorts from smallest to largest.")],
    notes: [["apiNote", "The hierarchy is **sealed**: only [[com.example.geo.Circle]] and [[com.example.geo.Polygon]] implement it, so a `switch` over a shape is exhaustive."]],
  }),
  since: "1.0", nullMarked: true, source: { path: "com/example/geo/Shape.java", line: 18 },
});

const circle: Type = type({
  id: `${G}.Circle`, name: "Circle", kind: "record", modifiers: ["public"],
  signature: tk(kw("public"), " ", kw("record"), " ", nm("Circle"), "(", DOUBLE, " ", { kind: "param", text: "radius" }, ", ", NULLABLE, " ", STRING, " ", { kind: "param", text: "label" }, ") ", kw("implements"), " ", t("Shape")),
  superclass: [jdk("java.lang", "Record")], ancestors: [{ id: "java.lang.Record", url: "https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Record.html" }, objectRef],
  interfaces: [[t("Shape")]],
  components: [
    { name: "radius", type: [DOUBLE], doc: blocks("the radius in meters; not negative") },
    { name: "label", type: tk(NULLABLE, " ", STRING), nullness: "nullable", doc: blocks("an optional label shown by [[com.example.geo.Shape#name()]]") },
  ],
  members: [
    m(`${G}.Circle`, { name: "Circle", kind: "constructor", mods: ["public"], params: [{ name: "radius", type: [DOUBLE], doc: "the radius in meters; not negative" }, { name: "label", type: tk(NULLABLE, " ", STRING), nullness: "nullable", doc: "an optional label" }], throws: [{ type: [jdk("java.lang", "IllegalArgumentException")], doc: "if `radius` is negative" }], doc: "Checks the radius.", line: 22 }),
    m(`${G}.Circle`, { name: "of", mods: ["public", "static"], params: [{ name: "radius", type: [DOUBLE], doc: "the radius in meters" }], returns: { type: [t("Circle")], nullness: "nonNull", doc: "an unlabeled circle" }, doc: "Creates an unlabeled circle.", line: 34 }),
    m(`${G}.Circle`, { name: "area", mods: ["public"], returns: { type: [DOUBLE], doc: "the area in square meters, never negative" }, overrides: { id: `${G}.Shape#area()` }, doc: { body: "The shape's area. For a circle this is `π r²`.", inheritedFrom: undefined }, line: 40 }),
    m(`${G}.Circle`, { name: "radius", mods: ["public"], returns: { type: [DOUBLE], doc: "the radius in meters; not negative" }, implicit: true }),
    m(`${G}.Circle`, { name: "label", mods: ["public"], returns: { type: tk(NULLABLE, " ", STRING), nullness: "nullable", doc: "an optional label" }, implicit: true }),
    m(`${G}.Circle`, { name: "toString", mods: ["public", "final"], returns: { type: [STRING], nullness: "nonNull" }, implicit: true }),
  ],
  inherited: [{ from: { id: `${G}.Shape`, text: "Shape" }, kind: "interface", members: [{ id: `${G}.Shape#compareTo(com.example.geo.Shape)`, text: "compareTo" }, { id: `${G}.Shape#name()`, text: "name" }] }],
  doc: doc("A circle, the simplest shape.\n\nCircles compare by radius as well as by area: their order is the same."),
  since: "1.0", nullMarked: true, source: { path: "com/example/geo/Circle.java", line: 16 },
});

const abstractShape: Type = type({
  id: `${G}.AbstractShape`, name: "AbstractShape", kind: "class", modifiers: ["public", "abstract"],
  signature: tk(kw("public"), " ", kw("abstract"), " ", kw("class"), " ", nm("AbstractShape")),
  superclass: [OBJECT], ancestors: [objectRef],
  members: [
    m(`${G}.AbstractShape`, { name: "perimeter", mods: ["public", "abstract"], returns: { type: [DOUBLE], doc: "the perimeter in meters" }, doc: "The length of the shape's boundary.", line: 20 }),
    m(`${G}.AbstractShape`, { name: "describe", mods: ["public"], returns: { type: [STRING], nullness: "nonNull", doc: "a description such as `polygon, 4 sides`" }, doc: "Describes the shape for logs.", line: 28 }),
  ],
  inherited: [fromObject],
  doc: doc("Shared behavior for shapes with a boundary."), since: "1.0", nullMarked: true,
});

const polygon: Type = type({
  id: `${G}.Polygon`, name: "Polygon", kind: "class", modifiers: ["public", "non-sealed"],
  signature: tk(kw("public"), " ", kw("non-sealed"), " ", kw("class"), " ", nm("Polygon"), " ", kw("extends"), " ", t("AbstractShape"), " ", kw("implements"), " ", t("Shape")),
  superclass: [t("AbstractShape")], ancestors: [{ id: `${G}.AbstractShape` }, objectRef], interfaces: [[t("Shape")]],
  members: [
    m(`${G}.Polygon`, { name: "Polygon", kind: "constructor", mods: ["public"], params: [{ name: "sides", type: tk(DOUBLE, "..."), varargs: true, doc: "each side's length in meters; at least three" }], throws: [{ type: [jdk("java.lang", "IllegalArgumentException")], doc: "if there are fewer than three sides" }], doc: "Creates a regular polygon from its sides.", line: 25 }),
    m(`${G}.Polygon`, { name: "area", mods: ["public"], returns: { type: [DOUBLE], doc: "the area in square meters, never negative" }, overrides: { id: `${G}.Shape#area()` }, doc: { body: "The shape's area.", inheritedFrom: { id: `${G}.Shape#area()` } }, line: 36 }),
    m(`${G}.Polygon`, { name: "perimeter", mods: ["public"], returns: { type: [DOUBLE], doc: "the perimeter in meters" }, overrides: { id: `${G}.AbstractShape#perimeter()` }, doc: "The sum of the sides.", line: 44 }),
  ],
  inherited: [
    { from: { id: `${G}.AbstractShape`, text: "AbstractShape" }, kind: "class", members: [{ id: `${G}.AbstractShape#describe()`, text: "describe" }] },
    fromObject,
    { from: { id: `${G}.Shape`, text: "Shape" }, kind: "interface", members: [{ id: `${G}.Shape#compareTo(com.example.geo.Shape)`, text: "compareTo" }, { id: `${G}.Shape#name()`, text: "name" }] },
  ],
  doc: doc("A regular polygon. Not sealed: applications may extend it."), since: "1.0", nullMarked: true,
});

const units: Type = type({
  id: `${G}.Units`, name: "Units", kind: "enum", modifiers: ["public"],
  signature: tk(kw("public"), " ", kw("enum"), " ", nm("Units")),
  superclass: tk(jdk("java.lang", "Enum"), "<", t("Units"), ">"), ancestors: [{ id: "java.lang.Enum", url: "https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Enum.html" }, objectRef],
  members: [
    m(`${G}.Units`, { name: "values", mods: ["public", "static"], returns: { type: tk(t("Units"), "[]"), nullness: "nonNull" }, implicit: true }),
    m(`${G}.Units`, { name: "valueOf", mods: ["public", "static"], params: [{ name: "name", type: [STRING], nullness: "nonNull" }], returns: { type: [t("Units")], nullness: "nonNull" }, implicit: true }),
    m(`${G}.Units`, { name: "METERS", kind: "enumConstant", type: [t("Units")], doc: "Meters: the base unit." }),
    m(`${G}.Units`, { name: "FEET", kind: "enumConstant", type: [t("Units")], doc: "International feet.", deprecated: deprecated("Use [[com.example.geo.Units#METERS]]; mixing units causes rounding errors.", "1.2"), annotations: [tk(an("@Deprecated", "java.lang.Deprecated", "https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Deprecated.html"), "(", { kind: "param", text: "since" }, " = ", lit('"1.2"'), ")")] }),
    m(`${G}.Units`, { name: "toMeters", mods: ["public"], params: [{ name: "value", type: [DOUBLE], doc: "a length in this unit" }], returns: { type: [DOUBLE], doc: "the length in meters" }, doc: "Converts a length in this unit to meters." }),
  ],
  doc: doc("Units of length."), since: "1.0", nullMarked: true,
});

const measured: Type = type({
  id: `${G}.Measured`, name: "Measured", kind: "annotation", modifiers: ["public"],
  annotations: [[an("@Documented", "java.lang.annotation.Documented", "https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/annotation/Documented.html")]],
  signature: tk(kw("public"), " ", kw("@interface"), " ", nm("Measured")),
  members: [
    m(`${G}.Measured`, { name: "unit", kind: "annotationElement", returns: { type: [t("Units")], doc: "the unit" }, defaultValue: "METERS", doc: "The unit of the values." }),
    m(`${G}.Measured`, { name: "precision", kind: "annotationElement", returns: { type: [INT], doc: "the number of digits" }, defaultValue: "3", doc: "Significant digits." }),
  ],
  doc: doc("Marks a declaration whose values are lengths, and in which unit."), since: "1.1", nullMarked: true,
});

const geoException: Type = type({
  id: `${G}.GeometryException`, name: "GeometryException", kind: "class", modifiers: ["public"],
  signature: tk(kw("public"), " ", kw("class"), " ", nm("GeometryException"), " ", kw("extends"), " ", jdk("java.lang", "Exception")),
  superclass: [jdk("java.lang", "Exception")],
  ancestors: ["Exception", "Throwable"].map(n => ({ id: `java.lang.${n}`, url: `https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/${n}.html` })).concat([objectRef]),
  members: [m(`${G}.GeometryException`, { name: "GeometryException", kind: "constructor", mods: ["public"], params: [{ name: "message", type: [STRING], doc: "what was wrong" }], doc: "Creates an exception." })],
  doc: doc("A shape that cannot exist, such as a triangle whose sides violate the triangle inequality."), since: "1.0", nullMarked: true,
});

const legacyShape: Type = type({
  id: `${G}.LegacyShape`, name: "LegacyShape", kind: "class", modifiers: ["public", "final"],
  signature: tk(kw("public"), " ", kw("final"), " ", kw("class"), " ", nm("LegacyShape")),
  superclass: [OBJECT], ancestors: [objectRef],
  deprecated: deprecated("Use [[com.example.geo.Polygon]]; this class predates sealed shapes and will be removed in 3.0. See [[guide:migrating-from-1x#classes-to-replace|Classes to replace]] in the migration guide.", "2.0", true),
  doc: doc("A shape from the 1.x API."), since: "1.0",
});

const shapesId = `${G}.Shapes`;
const shapes: Type = type({
  id: shapesId, name: "Shapes", kind: "class", modifiers: ["public", "final"],
  signature: tk(kw("public"), " ", kw("final"), " ", kw("class"), " ", nm("Shapes")),
  superclass: [OBJECT], ancestors: [objectRef],
  members: [
    m(shapesId, { name: "PRECISION", kind: "field", mods: ["public", "static", "final"], type: [INT], constant: "6", doc: "The default number of significant digits: `6`.", line: 60 }),
    m(shapesId, { name: "NAME", kind: "field", mods: ["public", "static", "final"], type: [STRING], nullness: "nonNull", constant: '"geo"', doc: "The library's name as tools report it." }),
    m(shapesId, { name: "area", mods: ["public", "static"], params: [{ name: "circle", type: [t("Circle")], nullness: "nonNull", doc: "the circle" }], returns: { type: [DOUBLE], doc: "its area" }, doc: "The area of a circle. One of two overloads." }),
    m(shapesId, { name: "area", mods: ["public", "static"], params: [{ name: "polygon", type: [t("Polygon")], nullness: "nonNull", doc: "the polygon" }], returns: { type: [DOUBLE], doc: "its area" }, doc: "The area of a polygon. One of two overloads." }),
    m(shapesId, {
      name: "largest", mods: ["public", "static"],
      typeParams: [{ name: "T", bounds: [[t("Shape")], tk(jdk("java.lang", "Comparable"), "<? ", kw("super"), " ", tp("T"), ">")], doc: "the shape type" }],
      params: [{ name: "shapes", type: tk(jdk("java.util", "Collection"), "<? ", kw("extends"), " ", tp("T"), ">"), nullness: "nonNull", doc: "the shapes; not empty" }],
      returns: { type: [tp("T")], doc: "the largest of `shapes`" },
      throws: [{ type: [jdk("java.util", "NoSuchElementException")], doc: "if `shapes` is empty" }],
      doc: { body: "Returns the largest shape.", notes: [["implSpec", "Compares with [[java.lang.Comparable#compareTo(T)|Comparable.compareTo]], keeping the first of equal shapes."]] },
    }),
    m(shapesId, {
      name: "total", mods: ["public", "static"], annotations: [tk(an("@Measured", `${G}.Measured`), "(", { kind: "param", text: "precision" }, " = ", lit("6"), ")")],
      params: [{ name: "shapes", type: tk(t("Shape"), "..."), varargs: true, nullness: "nonNull", doc: "the shapes" }],
      returns: { type: [DOUBLE], doc: "the total area in square meters; `0` for no shapes" }, doc: "Sums the shapes' areas.",
    }),
    m(shapesId, {
      name: "parse", mods: ["public", "static"], params: [{ name: "text", type: [STRING], nullness: "nonNull", doc: "the text form, such as `circle 2.5`" }],
      returns: { type: [t("Shape")], nullness: "nonNull", doc: "the shape" },
      throws: [
        { type: [jdk("java.io", "IOException")], declared: true, doc: "if the text names a file that cannot be read" },
        { type: [t("GeometryException")], declared: true, doc: "if the text describes an impossible shape" },
        { type: [jdk("java.lang", "IllegalStateException")], doc: "if the parser was closed" },
      ],
      doc: {
        body: [P("Parses a shape from its text form."), CODE("java", 'Shape s = Shapes.parse("circle 2.5");\nassert s instanceof Circle c && c.radius() == 2.5;')],
        notes: [
          ["apiNote", "The text form is **not stable** across releases: store shapes some other way. Parsing `circle -1` throws rather than returning an empty shape."],
          ["implNote", "Parses with a hand-written scanner; no regular expressions."],
        ],
        see: ["[[com.example.geo.io.ShapeReader]]", "[[guide:advanced/text-format#grammar|The text format: grammar]]", "[Shape text format](https://example.com/geo/format)"],
      },
    }),
    m(shapesId, {
      name: "sum", mods: ["public", "static"], params: [{ name: "shapes", type: tk(jdk("java.util", "List"), "<", t("Shape"), ">"), nullness: "nonNull", doc: "the shapes" }],
      returns: { type: [DOUBLE], doc: "the total area" },
      deprecated: deprecated("Use [[com.example.geo.Shapes#total(com.example.geo.Shape...)|total(Shape...)]], which takes any number of shapes.", "1.1", true),
      annotations: [tk(an("@Deprecated", "java.lang.Deprecated", "https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Deprecated.html"), "(", { kind: "param", text: "since" }, " = ", lit('"1.1"'), ", ", { kind: "param", text: "forRemoval" }, " = ", lit("true"), ")")],
      doc: "Sums the areas of a list of shapes.",
    }),
    m(shapesId, {
      name: "find", mods: ["public", "static"], since: "1.1",
      params: [
        { name: "shapes", type: tk(jdk("java.util", "Map"), "<", STRING, ", ? ", kw("extends"), " ", t("Shape"), ">"), nullness: "nonNull", doc: "shapes by name" },
        { name: "name", type: [STRING], nullness: "nonNull", doc: "the name to look up" },
      ],
      returns: { type: tk(NULLABLE, " ", t("Shape")), nullness: "nullable", doc: "the shape, or `null` when there is none" },
      doc: { body: [P("Finds a shape by name. Unlike [[com.example.geo.Shapes$Registry|the registry]], this never throws for a missing name.")] },
    }),
    m(shapesId, {
      name: "transform", mods: ["public", "static"],
      typeParams: [{ name: "S", bounds: [[t("Shape")]] }, { name: "R", bounds: [tk(jdk("java.lang", "Comparable"), "<? ", kw("super"), " ", tp("R"), ">")] }],
      params: [
        { name: "shapes", type: tk(jdk("java.util", "Collection"), "<? ", kw("extends"), " ", tp("S"), ">"), doc: "the input shapes" },
        { name: "mapper", type: tk(jdk("java.util.function", "Function"), "<? ", kw("super"), " ", tp("S"), ", ? ", kw("extends"), " ", tp("R"), ">"), doc: "maps each shape" },
        { name: "filter", type: tk(jdk("java.util.function", "Predicate"), "<? ", kw("super"), " ", tp("R"), ">"), doc: "keeps a result when it returns `true`" },
        { name: "comparator", type: tk(jdk("java.util", "Comparator"), "<? ", kw("super"), " ", tp("R"), ">"), doc: "orders the results" },
        { name: "limit", type: [INT], doc: "the most results to return" },
        { name: "units", type: [t("Units")], doc: "the unit for measured results" },
        { name: "label", type: tk(NULLABLE, " ", STRING), nullness: "nullable", doc: "a label for diagnostics, or `null`" },
      ],
      returns: { type: tk(jdk("java.util", "List"), "<", tp("R"), ">"), nullness: "nonNull", doc: "the sorted, filtered results" },
      throws: [{ type: [t("GeometryException")], declared: true, doc: "if a shape cannot be measured in `units`" }],
      doc: "Maps, filters and sorts shapes in one pass. A long signature, laid out one parameter per line.",
    }),
    m(shapesId, {
      name: "describe", mods: ["public", "static"], params: [{ name: "shape", type: [t("Shape")], doc: "the shape" }],
      returns: { type: [STRING], doc: "the description" },
      doc: { body: [P("Describes a shape. This links to [[com.example.geo.Ellipse|an ellipse type]] that this model does not contain, so the link renders as plain code."), { kind: "paragraph", children: [{ kind: "text", text: "Also an inline raw node: E = mc" }, { kind: "raw", html: "<sup>2</sup>", text: "2" }, { kind: "text", text: "." }] }] },
    }),
  ],
  inherited: [fromObject],
  doc: doc({
    body: [
      P("Operations on [[com.example.geo.Shape|shapes]]."),
      P("Every method is *pure*: it never modifies its arguments. **Thread safety:** every method is safe to call concurrently."),
      UL("[[com.example.geo.Shapes#largest(java.util.Collection)]] picks the largest shape.", "[[com.example.geo.Shapes#total(com.example.geo.Shape...)]] sums areas."),
      OL("Measure each shape.", "Compare the results with `compareTo`."),
      TABLE("Unit factors", ["Unit", "Factor"], [["[[com.example.geo.Units#METERS]]", "1.0"], ["[[com.example.geo.Units#FEET]]", "0.3048"]]),
      H(2, "Java and Kotlin"),
      CODE("java", "Shape big = Shapes.largest(List.of(Circle.of(1), new Polygon(1, 1, 1)));\ndouble total = Shapes.total(big, Circle.of(3)); // 0x1F, 3.5e2"),
      CODE("kotlin", "val big = Shapes.largest(listOf(Circle.of(1.0), Polygon(1.0, 1.0, 1.0)))\nval total: Double = Shapes.total(big, Circle.of(3.0))"),
      QUOTE("Measure twice, cut once."),
      RAW('<dl class="legacy"><dt>Precision</dt><dd>Six digits</dd></dl>', "Precision: Six digits"),
    ],
    notes: [["implNote", "Areas are computed in double precision."]],
    see: ["[[com.example.geo.Shape]]", "[[com.example.geo.Shape#area()|the area of a shape]]", '"Euclid, Elements, Book I"', "[Area on Wikipedia](https://en.wikipedia.org/wiki/Area)"],
  }),
  since: "1.0", nullMarked: true, source: { path: "com/example/geo/Shapes.java", line: 50 },
});

const builder: Type = type({
  id: `${G}.Shapes$Builder`, name: "Shapes.Builder", kind: "class", modifiers: ["public", "static", "final"], enclosing: shapesId,
  signature: tk(kw("public"), " ", kw("static"), " ", kw("final"), " ", kw("class"), " ", nm("Shapes.Builder")),
  superclass: [OBJECT], ancestors: [objectRef],
  members: [
    m(`${G}.Shapes$Builder`, { name: "Builder", kind: "constructor", mods: ["public"], doc: "Creates an empty builder." }),
    m(`${G}.Shapes$Builder`, { name: "with", mods: ["public"], params: [{ name: "option", type: [t("Shapes$Builder$Option")], doc: "the option to set" }], returns: { type: [t("Shapes$Builder")], doc: "this builder" }, doc: "Sets an option." }),
  ],
  inherited: [fromObject], doc: doc("Builds a list of shapes one at a time."), since: "1.2", nullMarked: true,
});

const option: Type = type({
  id: `${G}.Shapes$Builder$Option`, name: "Shapes.Builder.Option", kind: "enum", modifiers: ["public"], enclosing: `${G}.Shapes$Builder`,
  signature: tk(kw("public"), " ", kw("enum"), " ", nm("Shapes.Builder.Option")),
  members: [
    m(`${G}.Shapes$Builder$Option`, { name: "SORTED", kind: "enumConstant", type: [t("Shapes$Builder$Option")], doc: "Keep shapes sorted by area." }),
    m(`${G}.Shapes$Builder$Option`, { name: "DISTINCT", kind: "enumConstant", type: [t("Shapes$Builder$Option")], doc: "Drop shapes equal to one already added." }),
  ],
  doc: doc("Options for a builder: a type nested two levels deep."), nullMarked: true,
});

const registry: Type = type({
  id: `${G}.Shapes$Registry`, name: "Shapes.Registry", kind: "interface", modifiers: ["public", "static"], enclosing: shapesId,
  signature: tk(kw("public"), " ", kw("interface"), " ", nm("Shapes.Registry")),
  members: [m(`${G}.Shapes$Registry`, { name: "lookup", params: [{ name: "name", type: [STRING], doc: "the shape's name" }], returns: { type: [t("Shape")], doc: "the shape" }, throws: [{ type: [jdk("java.util", "NoSuchElementException")], doc: "if no shape has that name" }], doc: "Looks up a shape by name." })],
  doc: doc("Shapes by name."), nullMarked: true,
});

// ---- com.example.geo.io

const reader: Type = type({
  id: `${IO}.ShapeReader`, name: "ShapeReader", kind: "class", modifiers: ["public", "final"],
  signature: tk(kw("public"), " ", kw("final"), " ", kw("class"), " ", nm("ShapeReader"), " ", kw("implements"), " ", jdk("java.lang", "AutoCloseable")),
  superclass: [OBJECT], ancestors: [objectRef], interfaces: [[jdk("java.lang", "AutoCloseable")]],
  members: [
    m(`${IO}.ShapeReader`, { name: "read", mods: ["public", "static"], params: [{ name: "in", type: [jdk("java.io", "InputStream")], doc: "the stream; not closed" }], returns: { type: tk(jdk("java.util", "List"), "<", t("Shape"), ">"), doc: "the shapes, in order" }, throws: [{ type: [jdk("java.io", "IOException")], declared: true, doc: "if reading fails" }], doc: "Reads every shape from a stream of UTF-8 text." }),
    m(`${IO}.ShapeReader`, { name: "read", mods: ["public", "static"], params: [{ name: "reader", type: [jdk("java.io", "Reader")], doc: "the reader; not closed" }, { name: "charset", type: [jdk("java.nio.charset", "Charset")], doc: "the charset the text was decoded from" }], returns: { type: tk(jdk("java.util", "List"), "<", t("Shape"), ">"), doc: "the shapes, in order" }, throws: [{ type: [jdk("java.io", "IOException")], declared: true, doc: "if reading fails" }], doc: "Reads every shape from a reader." }),
    m(`${IO}.ShapeReader`, { name: "close", mods: ["public"], throws: [{ type: [jdk("java.io", "IOException")], declared: true, doc: "if closing the reader fails" }], doc: "Closes the underlying reader.", overrides: { id: "java.lang.AutoCloseable#close()", url: "https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/AutoCloseable.html#close()" } }),
  ],
  inherited: [fromObject],
  doc: doc({ body: "Reads shapes in their text form, one per line.", see: ["[[com.example.geo.Shapes#parse(java.lang.String)]]"] }), since: "1.0",
});

// ---- com.example.geo.registry: one type with hundreds of members.

function generated(): Type {
  const id = `${BIG}.ShapeCatalog`;
  const members: Member[] = [];
  const families = ["circle", "square", "triangle", "hexagon", "octagon", "ellipse", "star", "arc", "ring", "sector"];
  const verbs = ["area", "perimeter", "scale", "rotate", "translate", "mirror", "contains", "intersects", "union", "bounds"];
  for (let i = 0; i < 40; i++) {
    members.push(m(id, { name: `${families[i % 10]!.toUpperCase()}_${Math.floor(i / 10) + 1}`, kind: "field", mods: ["public", "static", "final"], type: [STRING], constant: `"${families[i % 10]}-${i}"`, doc: `The catalog key of ${families[i % 10]} variant ${Math.floor(i / 10) + 1}.` }));
  }
  for (const family of families) {
    for (const verb of verbs) {
      for (const arity of [1, 2, 3]) {
        const cap = family[0]!.toUpperCase() + family.slice(1);
        members.push(m(id, {
          name: `${verb}${cap}`, mods: ["public"],
          params: Array.from({ length: arity }, (_, k) => ({ name: ["shape", "factor", "origin"][k]!, type: [k === 0 ? t("Shape", G) : DOUBLE], doc: ["the shape", "the factor", "the origin offset"][k] })),
          returns: { type: [verb === "contains" || verb === "intersects" ? kw("boolean") : DOUBLE], doc: `the ${verb} result` },
          doc: `Computes ${verb} for a ${family}${arity > 1 ? ` with ${arity} arguments` : ""}.`,
        }));
      }
    }
  }
  return type({
    id, name: "ShapeCatalog", kind: "class", modifiers: ["public", "final"],
    signature: tk(kw("public"), " ", kw("final"), " ", kw("class"), " ", nm("ShapeCatalog")),
    superclass: [OBJECT], ancestors: [objectRef], members, inherited: [fromObject],
    doc: doc("A catalog with hundreds of members, generated to exercise long pages, the member summary and the table of contents."),
    since: "2.0",
  });
}

// ---- Guides. Listed out of reading order on purpose: the migration guide has no order, and the Advanced group
// lists its second guide first, so the pages show how the renderer orders them.

function guides(): Guide[] {
  const gettingStarted = guide({
    slug: "getting-started", title: "Getting started", order: 1,
    summary: "Add geo to a build and measure a first shape.",
    source: { path: "docs/guides/getting-started.md", line: 1 },
    body: [
      P("geo measures plane shapes: circles, polygons and shapes you build from them. This guide adds it to a build and runs a first program."),
      H(2, "Install"),
      P("geo needs Java 21 or later. With Gradle, add the dependency to `build.gradle.kts`:"),
      CODE("kotlin", 'dependencies {\n    implementation("com.example:geo:2.1.0")\n}'),
      P("With Maven, add it to `pom.xml`:"),
      CODE("xml", "<dependency>\n  <groupId>com.example</groupId>\n  <artifactId>geo</artifactId>\n  <version>2.1.0</version>\n</dependency>"),
      P("On the module path, require the module:"),
      CODE("java", "module my.app {\n    requires com.example.geo;\n}"),
      H(2, "Your first shape"),
      P("Create shapes with [[com.example.geo.Circle#of(double)|Circle.of]] and the [[com.example.geo.Polygon#<init>(double...)|Polygon]] constructor, then measure them with [[com.example.geo.Shapes]]:"),
      CODE("java", 'import com.example.geo.*;\n\nclass First {\n    public static void main(String[] args) {\n        Shape circle = Circle.of(2);\n        Shape triangle = new Polygon(3, 3, 3);\n        System.out.printf("total area: %.2f m²%n", Shapes.total(circle, triangle));\n    }\n}'),
      ADMON("tip", "Every length is in meters. To work in other units, see [[guide:concepts#units|Units]] in the concepts guide."),
      H(2, "Next steps"),
      UL(
        "[[guide:concepts|Concepts]] explains shapes, measuring and units.",
        "[[guide:migrating-from-1x|Migrating from 1.x]] lists what changed in 2.0.",
        "The [[com.example.geo]] package is the reference for everything above.",
      ),
    ],
  });

  const concepts = guide({
    slug: "concepts", title: "Concepts", order: 2,
    summary: "Shapes, measuring and units: the ideas the reference pages assume.",
    body: [
      P("Three ideas carry the whole library: a closed set of shapes, pure functions that measure them, and one unit of length. Each section below links to the declarations it describes."),
      H(2, "Shapes"),
      P("Every shape implements the sealed interface [[com.example.geo.Shape]]. Two classes implement it:"),
      UL(
        [P("[[com.example.geo.Circle]], a record of a radius and an optional label."), UL("Create one with [[com.example.geo.Circle#of(double)|Circle.of(double)]].", "Its [[com.example.geo.Circle#area()|area()]] is `π r²`.")],
        [P("[[com.example.geo.Polygon]], a regular polygon built from its sides."), UL("It extends [[com.example.geo.AbstractShape]], which adds [[com.example.geo.AbstractShape#perimeter()|perimeter()]].", "It is not sealed: [[guide:advanced/custom-shapes|Custom shapes]] shows how to extend it.")],
      ),
      ADMON("note", "Because the hierarchy is sealed, a `switch` over a shape needs no `default` branch, and the compiler tells you when a new shape appears."),
      H(3, "Example"),
      CODE("java", 'String describe(Shape shape) {\n    return switch (shape) {\n        case Circle c -> "circle of radius " + c.radius();\n        case Polygon p -> "polygon with perimeter " + p.perimeter();\n    };\n}'),
      H(2, "Measuring"),
      P("[[com.example.geo.Shapes]] holds the operations. They are pure: none modifies its arguments. `area` is overloaded, so the compiler picks [[com.example.geo.Shapes#area(com.example.geo.Circle)|area(Circle)]] or [[com.example.geo.Shapes#area(com.example.geo.Polygon)|area(Polygon)]] from the argument's static type."),
      OL("Build the shapes.", "Measure each one, or sum them with [[com.example.geo.Shapes#total(com.example.geo.Shape...)|total(Shape...)]].", "Compare the results: shapes order by area."),
      ADMON("tip", "To collect shapes as you go, use [[com.example.geo.Shapes$Builder|Shapes.Builder]] with the options of its nested enum [[com.example.geo.Shapes$Builder$Option|Shapes.Builder.Option]], such as [[com.example.geo.Shapes$Builder$Option#SORTED|SORTED]].", "Collecting shapes"),
      H(3, "Example"),
      CODE("java", "double small = Shapes.area(Circle.of(1));\ndouble large = Shapes.area(new Polygon(4, 4, 4, 4));\nassert small < large;"),
      H(2, "Units"),
      P("Every length is in meters, and every area in square meters. [[com.example.geo.Units]] converts other units at the edges of a program:"),
      TABLE("Units of length", ["Unit", "Meters per unit", "Status"], [
        ["[[com.example.geo.Units#METERS]]", "`1.0`", "The base unit"],
        ["[[com.example.geo.Units#FEET]]", "`0.3048`", "Deprecated since 1.2"],
      ]),
      ADMON("important", "Methods take and return meters. Convert once, when a value enters the program, with [[com.example.geo.Units#toMeters(double)|toMeters(double)]]."),
      ADMON("warning", "Converting back and forth between units loses precision. Keep lengths in meters until you show them.", "Round trips lose precision"),
      H(2, "Parsing"),
      P("[[com.example.geo.Shapes#parse(java.lang.String)|Shapes.parse]] reads the text form of one shape. The [[guide:advanced/text-format#grammar|text format guide]] has the grammar."),
      ADMON("caution", "The text form is not stable across releases. Store shapes some other way, and never parse text you do not trust without a size limit."),
      H(2, "Threads"),
      ADMON("apiNote", "Every method of [[com.example.geo.Shapes]] is safe to call from several threads at once."),
      ADMON("implSpec", "A subclass of [[com.example.geo.Polygon]] must keep `area()` free of side effects, so that callers may cache it."),
      ADMON("implNote", "The library keeps no caches and allocates only the results it returns."),
      H(2, "Further reading"),
      UL(
        "[Polygon](https://en.wikipedia.org/wiki/Polygon) on Wikipedia.",
        "[[guide:migrating-from-1x#classes-to-replace|Classes to replace]], in the migration guide.",
        "[[com.example.geo.Ellipse|Ellipse]] is planned for a later release. This model does not contain it, so the link renders as plain text.",
        "[[guide:recipes|Recipes]] is a guide that does not exist yet, so this link renders as plain text too.",
      ),
    ],
  });

  const migration = guide({
    slug: "migrating-from-1x", title: "Migrating from 1.x",
    summary: "What changed in 2.0, and how to update code written for 1.x.",
    body: [
      P("Version 2.0 keeps every 1.x class, but deprecates a few for removal in 3.0. This guide lists each one with its replacement."),
      ADMON("important", "Compile with `-Xlint:deprecation` to list every use of a deprecated declaration in your code."),
      H(2, "Classes to replace"),
      P("[[com.example.geo.LegacyShape]] predates sealed shapes. Replace it with [[com.example.geo.Polygon]] or [[com.example.geo.Circle]]:"),
      TABLE("Replacements", ["1.x", "2.0"], [
        ["[[com.example.geo.LegacyShape]]", "[[com.example.geo.Polygon]]"],
        ["[[com.example.geo.Shapes#sum(java.util.List)|Shapes.sum(List)]]", "[[com.example.geo.Shapes#total(com.example.geo.Shape...)|Shapes.total(Shape...)]]"],
        ["[[com.example.geo.Units#FEET]]", "[[com.example.geo.Units#METERS]], converting with `toMeters`"],
      ]),
      H(2, "Changed methods"),
      P("[[com.example.geo.Shapes#sum(java.util.List)|sum(List)]] becomes [[com.example.geo.Shapes#total(com.example.geo.Shape...)|total(Shape...)]], which takes any number of shapes:"),
      CODE("java", "// 1.x\ndouble before = Shapes.sum(List.of(a, b));\n\n// 2.0\ndouble after = Shapes.total(a, b);"),
      H(2, "Units"),
      P("[[com.example.geo.Units#FEET]] is deprecated: mixing units caused rounding errors. Convert to meters at the edge, as [[guide:concepts#units|Units]] describes."),
      ADMON("caution", "When `FEET` goes in 3.0, the ordinals of later constants change. Do not store `ordinal()` values."),
      H(2, "Checklist"),
      OL("Update the dependency to 2.1.0.", "Fix each deprecation warning with the table above.", "Run your tests."),
    ],
  });

  const textFormat = guide({
    slug: "advanced/text-format", title: "The text format", group: "Advanced", order: 2,
    summary: "The grammar `Shapes.parse` reads, and how to read files of shapes.",
    source: { path: "docs/guides/advanced/text-format.md", line: 1 },
    body: [
      P("Shapes have a one-line text form, for logs and test fixtures. [[com.example.geo.Shapes#parse(java.lang.String)|Shapes.parse]] reads one; [[com.example.geo.io.ShapeReader]] reads a stream of them."),
      H(2, "Grammar"),
      CODE("text", "shape   = circle | polygon\ncircle  = \"circle\" number\npolygon = \"polygon\" number number number { number }\nnumber  = digit { digit } [ \".\" digit { digit } ]"),
      P("Numbers are lengths in meters. Blank lines and lines starting with `#` are skipped."),
      H(2, "Reading files"),
      P("[[com.example.geo.io.ShapeReader#read(java.io.InputStream)|read(InputStream)]] reads UTF-8 text; the [[com.example.geo.io.ShapeReader#read(java.io.Reader,java.nio.charset.Charset)|read(Reader, Charset)]] overload reads text you have already decoded."),
      CODE("java", 'try (var in = Files.newInputStream(Path.of("shapes.txt"))) {\n    List<Shape> shapes = ShapeReader.read(in);\n}'),
      ADMON("warning", "A malformed line throws [[com.example.geo.GeometryException]] and stops the read. Validate files from users before you read them."),
    ],
  });

  const customShapes = guide({
    slug: "advanced/custom-shapes", title: "Custom shapes", group: "Advanced", order: 1,
    summary: "Extend `Polygon` to add a shape of your own.",
    body: [
      P("[[com.example.geo.Shape]] is sealed, but [[com.example.geo.Polygon]] is not: extend it to add a shape the library does not have."),
      CODE("java", "public final class Square extends Polygon {\n    public Square(double side) {\n        super(side, side, side, side);\n    }\n}"),
      P("Override [[com.example.geo.AbstractShape#perimeter()|perimeter()]] only when you can compute it faster than summing the sides."),
      ADMON("tip", "Keep custom shapes immutable, like the built-in ones; [[guide:concepts#threads|Threads]] explains why."),
    ],
  });

  return [migration, gettingStarted, concepts, textFormat, customShapes];
}

const packages: Package[] = [
  {
    id: G, name: G, nullMarked: true, since: "1.0",
    doc: doc({
      body: [P("Shapes, units and measurements."), H(2, "Where to start"), P("Start with [[com.example.geo.Shape]] and the operations in [[com.example.geo.Shapes]]. Readers live in [[com.example.geo.io]]. The [[guide:concepts#shapes|Shapes]] section of the concepts guide explains how they fit together.")],
      see: ["[[com.example.geo.io]]", "[[guide:concepts|Concepts]]"],
    }),
    types: [abstractShape, circle, geoException, legacyShape, measured, polygon, shape, shapes, builder, option, registry, units].sort((a, b) => a.name.localeCompare(b.name)),
  },
  { id: IO, name: IO, since: "1.0", doc: doc("Reading shapes from streams. Not null-marked: nullness here is unspecified unless annotated."), types: [reader] },
  { id: BIG, name: BIG, since: "2.0", doc: doc("A generated catalog, for performance."), types: [generated()] },
  { id: EMPTY, name: EMPTY, since: "2.1", doc: doc("Service-provider interfaces. Reserved: this package declares nothing public yet.") },
];

export const javaSample: Model = {
  schema: "apidocs/1",
  module: {
    name: "geo", version: "2.1.0", languages: ["java"],
    doc: doc({ body: [
      P("A small geometry library: the Java-flavored sample for `@elide/apidocs`."),
      P("New here? Start with [[guide:getting-started|Getting started]], then read [[guide:concepts|Concepts]]."),
      P("It shows every construct the doclet writes. See `samples/FEATURES.md` for the list."),
    ] }),
    guides: guides(),
  },
  externals: [
    { prefix: "java.", url: "https://docs.oracle.com/en/java/javase/25/docs/api/{module}/" },
    { prefix: "org.jspecify.", url: "https://jspecify.dev/docs/api/" },
  ],
  packages,
};

