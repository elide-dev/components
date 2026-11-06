import { gzipSync } from "node:zlib";

// React remains a peer dependency. Guard leaf imports against heavyweight
// overlays or syntax highlighting accidentally entering their dependency graph.
for (const [name, exported] of [["button", "Button"], ["copy-command", "CopyCommand"]]) {
  const result = await Bun.build({
    entrypoints: [`./node_modules/@elide/ui/dist/components/${name}.js`],
    target: "browser", minify: true, external: ["react", "react/jsx-runtime", "react-dom"],
  });
  if (!result.success) throw new AggregateError(result.logs, `Failed to build ${exported}`);
  const source = await result.outputs[0].text();
  const gzipBytes = gzipSync(source).byteLength;
  if (gzipBytes > 14_000) throw new Error(`${exported} exceeds the 14 KB gzip budget: ${gzipBytes}`);
  if (/Prism|prism-react-renderer/.test(source)) throw new Error(`${exported} unexpectedly bundles Prism`);
  console.log(`${exported}: ${source.length} bytes minified, ${gzipBytes} bytes gzip (React external).`);
}
