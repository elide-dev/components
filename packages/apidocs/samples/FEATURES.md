# Sample features

Each feature the renderer supports, and the sample page that shows it. Paths are relative to the site root. Open
them with `bun run dev` (pick the sample in the dev bar) or `bun run sample`. `java` is `samples/java.ts`, the
doclet's flavor. `kotlin` is `samples/kotlin.ts`, the Dokka plugin's flavor. `render.test.ts` validates both against
`schema/apidocs-1.schema.json` and runs the output checker over both.

| Feature | Sample | Page |
| --- | --- | --- |
| Module overview, packages table, all-types table | java, kotlin | `index.html` |
| Package description with a heading and a see-also link | java | `com/example/geo/index.html` |
| Several packages with descriptions | java, kotlin | `index.html` |
| Empty package | java, kotlin | `com/example/geo/spi/index.html`, `org/example/kgeo/internal/index.html` |
| Class, abstract class, final class | java | `com/example/geo/Polygon.html`, `AbstractShape.html`, `Shapes.html` |
| Interface; sealed interface with permitted subtypes | java | `com/example/geo/Shape.html` |
| Record with documented components (`#param-radius`) | java | `com/example/geo/Circle.html` |
| Enum with a deprecated constant | java, kotlin | `com/example/geo/Units.html`, `org/example/kgeo/LengthUnit.html` |
| Annotation interface with element defaults | java, kotlin | `com/example/geo/Measured.html`, `org/example/kgeo/experimental/ExperimentalGeometry.html` |
| Exception (grouped under Exceptions) | java | `com/example/geo/GeometryException.html` |
| Nested types, two levels deep, in breadcrumbs and navigation | java | `com/example/geo/Shapes.Builder.Option.html` |
| Generics with bounds and wildcards | java | `com/example/geo/Shapes.html#largest(java.util.Collection)` |
| Constructors | java, kotlin | `com/example/geo/Circle.html`, `org/example/kgeo/Point.html` |
| Overloads | java, kotlin | `Shapes.html` `area(Circle)` and `area(Polygon)`; `org/example/kgeo/Geometry.html` `distance` |
| Fields and constants | java, kotlin | `Shapes.html#PRECISION`; `org/example/kgeo/index.html#VERSION` |
| Varargs | java | `Shapes.html#total(com.example.geo.Shape...)`, `Polygon.html` constructor |
| Parameters, returns and throws (declared and unchecked) | java | `Shapes.html#parse(java.lang.String)` |
| API note, implementation requirements and implementation note callouts | java | `Shapes.html#parse(java.lang.String)`, `Shape.html` |
| Deprecated with a replacement link, and deprecated for removal | java, kotlin | `Shapes.html#sum(java.util.List)`, `com/example/geo/LegacyShape.html`, `org/example/kgeo/index.html#totalArea(List<Shape>)` |
| Since badges | java, kotlin | most pages |
| Nullability badges (JSpecify and Kotlin `?`) | java, kotlin | `Shapes.html#find(java.util.Map,java.lang.String)`, `org/example/kgeo/index.html#parseShape(String)` |
| Null-marked badge | java | `com/example/geo/index.html` |
| Inherited members | java | `com/example/geo/Polygon.html#inherited-members` |
| Inherited description ("copied from") | java | `com/example/geo/Polygon.html#area()` |
| See-also: declaration link, labeled link, plain text, URL | java | `com/example/geo/Shapes.html` (type description) |
| Internal and external links (JDK, Kotlin stdlib) | java, kotlin | signatures on every page |
| Unresolved link rendered as plain code | java, kotlin | `Shapes.html#describe(com.example.geo.Shape)`, `org/example/kgeo/coroutines/index.html` `watchShapes` |
| Code samples in Java and Kotlin | java, kotlin | `Shapes.html` description; `org/example/kgeo/coroutines/index.html` |
| Tables, ordered and unordered lists, block quote | java | `Shapes.html` description |
| Raw HTML node (block and inline) | java | `Shapes.html` description (`<dl>`) and `describe` (`<sup>`) |
| Very long signature, one parameter per line | java | `Shapes.html` `transform` |
| A type with hundreds of members (generated) | java | `com/example/geo/registry/ShapeCatalog.html` |
| Top-level functions and properties | kotlin | `org/example/kgeo/index.html` |
| Extension function and property with a receiver | kotlin | `org/example/kgeo/index.html` `scaled` and `isDegenerate` |
| Object and companion object | kotlin | `org/example/kgeo/Geometry.html`, `org/example/kgeo/Circle.Companion.html` |
| Data, sealed, value and enum classes | kotlin | `Circle.html`, `Shape.html`, `Meters.html`, `LengthUnit.html` under `org/example/kgeo/` |
| Suspend function | kotlin | `org/example/kgeo/coroutines/index.html` `loadShapes` |
| Inline function with a reified type parameter | kotlin | `org/example/kgeo/Geometry.html` `filterShapes` |
| Operator function | kotlin | `org/example/kgeo/Meters.html` `plus` |
| Type aliases | kotlin | `org/example/kgeo/index.html#type-aliases` |
| Default arguments | kotlin | `org/example/kgeo/Point.html`, `scaled` |
| Markdown twin, `llms.txt`, `llms-full.txt`, `api.json`, `element-list` | java, kotlin | site root; `<page>.md` beside every page |
| Guides listed on the overview, ungrouped first, then by group | java, kotlin | `index.html#guides`, `index.md` |
| Guide ordering: `order` first, guides without one after; a group's second guide listed first in the model | java | `guides/migrating-from-1x.html` (no order, comes third); Advanced: `custom-shapes` (order 1) before `text-format` (order 2) |
| Guide with an install snippet (Gradle, Maven, module path) and a first example | java, kotlin | `guides/getting-started.html` |
| Guide sections: h2 sections and h3 subsections in the rail, self-links on headings | java, kotlin | `guides/concepts.html` |
| Duplicate heading text, deduplicated anchors | java | `guides/concepts.html#example` and `#example-2` |
| Admonitions: note, tip, important, warning, caution, API note, implementation requirements, implementation note; with and without a title | java, kotlin | `guides/concepts.html` |
| Table, nested lists and an ordered list in a guide | java, kotlin | `guides/concepts.html#shapes`, `#units` (java), `#lengths` (kotlin) |
| Guide links to types, members, an overload, a nested type and a package | java, kotlin | `guides/concepts.html#measuring` (java), `#distance` and `#shapes` (kotlin) |
| Guide links to deprecated declarations | java, kotlin | `guides/migrating-from-1x.html` |
| Guide link to a section of another guide | java, kotlin | `guides/concepts.html#further-reading` |
| External link and unresolved links (a declaration and a guide) in a guide | java, kotlin | `guides/concepts.html#further-reading` |
| Guide in a group, with a nested slug and a source link | java, kotlin | `guides/advanced/text-format.html`, `guides/coroutines/loading.html` |
| Previous and next guide links | java, kotlin | the foot of every guide page |
| Doc comment links into guides: module overview, package description, deprecation, `@see` to a section | java, kotlin | `index.html`, `com/example/geo/index.html`, `LegacyShape.html`, `Shapes.html#parse(java.lang.String)`; `org/example/kgeo/index.html` |
| Guides in `llms.txt` (before the reference pages), `llms-full.txt`, search and Markdown | java, kotlin | site root; `guides/*.md` |

## Adding a feature

1. Add the declaration to `samples/java.ts` or `samples/kotlin.ts` (or both), with the builders in `samples/build.ts`.
   Write what the doclet or the Dokka plugin would emit; when the model needs a new field, change
   `schema/apidocs-1.schema.json` first and run `bun run generate`. A guide goes in `module.guides` through the
   `guide()` builder; `[[guide:slug|label]]` and `[[guide:slug#section|label]]` link to a guide or a section.
2. Add a row above naming the page that shows it.
3. Run `bun test`: the samples must validate against the schema and pass the output checker.
