/**
 * The renderer bundle's entry: one classic script that defines the global
 * ApiDocs = { schema, render }. A JVM tool runs it in an external JavaScript
 * runtime with a small runner; nothing here touches files or the network.
 */
export { render, SCHEMA as schema } from "./render";
