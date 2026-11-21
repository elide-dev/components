// Generated from schema/apidocs-1.schema.json by scripts/gen-types.ts. Do not edit.

/** One module's model. */
export interface Model {
  /** The schema name. */
  schema: "apidocs/1";
  module: Module;
  /** Where references outside this model point, by name prefix; the first match wins. */
  externals?: External[];
  /** The documented packages, sorted by name. */
  packages?: Package[];
}

/** The documented module. */
export interface Module {
  /** The module's name, as pages show it. */
  name: string;
  /** The module's version. */
  version?: string;
  /** The named JPMS module the packages belong to; absent for the unnamed module. */
  javaModule?: string;
  /** The source languages, sorted: java, kotlin. */
  languages?: string[];
  doc?: Doc;
}

/** Documentation outside this model: a reference whose id starts with prefix links below url. */
export interface External {
  /** A package or name prefix, such as java. */
  prefix: string;
  /** The base URL (absolute) or path (relative to the model's root); {module} stands for a target's module. */
  url: string;
}

/** A package (Java) or a package's top-level declarations (Kotlin). */
export interface Package {
  /** The package's id: its qualified name. */
  id: string;
  /** The qualified name; empty for the unnamed package. */
  name: string;
  doc?: Doc;
  since?: string;
  deprecated?: Deprecation;
  /** Whether the package is JSpecify @NullMarked. */
  nullMarked?: boolean;
  /** The package's types, nested types included, sorted by name. */
  types?: Type[];
  /** Top-level functions (Kotlin). */
  functions?: Member[];
  /** Top-level properties (Kotlin). */
  properties?: Member[];
  /** Type aliases (Kotlin). */
  typeAliases?: TypeAlias[];
}

/** What a type declaration is. */
export type TypeKind = "class" | "interface" | "record" | "enum" | "annotation" | "object";

/** A type declaration. Its page is <package path>/<name>.html. */
export interface Type {
  /** The stable id: the binary name (p.Outer$Inner) for Java, Dokka's DRI for Kotlin. */
  id: string;
  /** The name inside its package, nesting joined with dots (Outer.Inner). */
  name: string;
  kind: TypeKind;
  /** java or kotlin. */
  language: string;
  /** Modifiers in canonical order, without implied ones. */
  modifiers?: string[];
  /** Documented annotations, each as tokens. */
  annotations?: Tokens[];
  typeParams?: TypeParam[];
  /** The declaration line as tokens. */
  signature: Tokens;
  /** The direct superclass as tokens; absent for interfaces. */
  superclass?: Tokens;
  /** Implemented or extended interfaces. */
  interfaces?: Tokens[];
  /** The superclass chain, nearest first. */
  ancestors?: Ref[];
  /** Permitted subtypes of a sealed type. */
  permits?: Ref[];
  /** The enclosing type's id. */
  enclosing?: string;
  /** Record components with their @param documentation. */
  components?: Param[];
  /** Declared members, in declaration order. */
  members?: Member[];
  /** Members inherited from supertypes, grouped by declaring type. */
  inherited?: Inherited[];
  doc?: Doc;
  deprecated?: Deprecation;
  since?: string;
  /** Whether the declaration is in a JSpecify @NullMarked scope. */
  nullMarked?: boolean;
  source?: Source;
}

/** What a member is. */
export type MemberKind = "constructor" | "method" | "field" | "enumConstant" | "annotationElement" | "function" | "property";

/** A member of a type, or a Kotlin top-level function or property. */
export interface Member {
  /** <type id>#<anchor> for Java, Dokka's DRI for Kotlin. */
  id: string;
  /** The fragment on its page; for Java the JDK doclet's, such as read(java.io.InputStream). */
  anchor: string;
  kind: MemberKind;
  /** The simple name; a constructor is named after its type. */
  name: string;
  modifiers?: string[];
  annotations?: Tokens[];
  typeParams?: TypeParam[];
  /** The receiver of a Kotlin extension function or property. */
  receiver?: Param;
  /** The declaration as tokens, on one line. */
  signature: Tokens;
  params?: Param[];
  returns?: Returns;
  /** The type of a field, property or enum constant. */
  type?: Tokens;
  nullness?: Nullness;
  /** Declared and documented exceptions, merged. */
  throws?: Thrown[];
  /** A compile-time constant's value as a source literal. */
  constant?: string;
  /** An annotation element's default as source text. */
  defaultValue?: string;
  /** The member this one overrides or implements. */
  overrides?: Ref;
  /** Whether the compiler declares it (a record's accessors, an enum's values()). */
  implicit?: boolean;
  doc?: Doc;
  deprecated?: Deprecation;
  since?: string;
  source?: Source;
}

/** A Kotlin type alias. */
export interface TypeAlias {
  id: string;
  name: string;
  typeParams?: TypeParam[];
  signature: Tokens;
  target: Tokens;
  doc?: Doc;
  deprecated?: Deprecation;
  since?: string;
  source?: Source;
}

/** Whether a reference type admits null; absent when unknown or not applicable. */
export type Nullness = "nullable" | "nonNull";

/** A value parameter or record component. */
export interface Param {
  name: string;
  type: Tokens;
  varargs?: boolean;
  /** A Kotlin default argument as source text. */
  defaultValue?: string;
  nullness?: Nullness;
  annotations?: Tokens[];
  doc?: Blocks;
}

/** A type parameter. */
export interface TypeParam {
  name: string;
  bounds?: Tokens[];
  doc?: Blocks;
}

/** A return value. */
export interface Returns {
  type: Tokens;
  nullness?: Nullness;
  doc?: Blocks;
}

/** An exception a member throws. */
export interface Thrown {
  type: Tokens;
  /** Whether the throws clause names it. */
  declared?: boolean;
  doc?: Blocks;
}

/** A deprecation. */
export interface Deprecation {
  doc?: Blocks;
  since?: string;
  forRemoval?: boolean;
}

/** Members a type inherits from one supertype. */
export interface Inherited {
  from: Ref;
  /** class or interface. */
  kind: string;
  members?: Ref[];
}

/** A declaration's place in its source. */
export interface Source {
  /** The file's path below its source root. */
  path: string;
  line: number;
}

/** A reference to a declaration. It links locally when the model has the id, else through url, else not at all. */
export interface Ref {
  id: string;
  /** The text to show, when not the target's own name. */
  text?: string;
  /** The target's URL, when outside this model and an external covers it. */
  url?: string;
}

/** What a signature token is. */
export type TokenKind = "keyword" | "name" | "type" | "typeParam" | "annotation" | "literal" | "punct" | "param";

/** One token of a signature. */
export interface Token {
  kind: TokenKind;
  text: string;
  /** The target's model id, for a type or annotation. */
  ref?: string;
  /** The target's URL when outside the model. */
  url?: string;
}

export type Tokens = Token[];

/** Documentation as a tree. Parameter, return and exception documentation live on those parts. */
export interface Doc {
  /** The first sentence. */
  summary?: Inlines;
  /** The full description, first sentence included. */
  body?: Blocks;
  notes?: Note[];
  see?: Inlines[];
  /** The member whose documentation this is, when inherited. */
  inheritedFrom?: Ref;
}

export type NoteKind = "apiNote" | "implSpec" | "implNote";

/** An @apiNote, @implSpec or @implNote section. */
export interface Note {
  kind: NoteKind;
  body?: Blocks;
}

export type Blocks = Block[];

export type Inlines = Inline[];

export type Block = Paragraph | ListBlock | CodeBlock | Table | Heading | Quote | RawBlock;

export interface Paragraph {
  kind: "paragraph";
  children?: Inlines;
}

export interface ListBlock {
  kind: "list";
  ordered?: boolean;
  items?: Blocks[];
}

export interface CodeBlock {
  kind: "code";
  /** Absent for the declaration's own language. */
  language?: string;
  text: string;
}

export interface Table {
  kind: "table";
  caption?: Inlines;
  head?: Row[];
  rows?: Row[];
}

export type Row = Blocks[];

export interface Heading {
  kind: "heading";
  level: number;
  children?: Inlines;
}

export interface Quote {
  kind: "quote";
  children?: Blocks;
}

export interface RawBlock {
  kind: "raw";
  html: string;
  text: string;
}

export type Inline = Text | Code | Emphasis | Strong | Link | Break | RawInline;

export interface Text {
  kind: "text";
  text: string;
}

export interface Code {
  kind: "code";
  text: string;
}

export interface Emphasis {
  kind: "emphasis";
  children?: Inlines;
}

export interface Strong {
  kind: "strong";
  children?: Inlines;
}

/** A link to a declaration (target) or a URL. An unresolved declaration link renders as its label. */
export interface Link {
  kind: "link";
  target?: Ref;
  url?: string;
  /** Whether the label is code ({@link}) rather than prose ({@linkplain}). */
  code?: boolean;
  children?: Inlines;
}

export interface Break {
  kind: "break";
}

export interface RawInline {
  kind: "raw";
  html: string;
  text: string;
}
