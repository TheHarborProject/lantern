/**
 * Build the minimal, deterministic HTML page that hosts a single isolated
 * component. Global stylesheets are inlined into the head; the component is
 * mounted into `#root` by the bundled harness entry (injected separately).
 */
export function generateHarnessDocument(styleContents: readonly string[]): string {
  const styles = styleContents.map((css) => `    <style>\n${css}\n    </style>`).join("\n");
  const head = ["    <meta charset=\"utf-8\" />", "    <title>Lantern Component Isolation</title>"];
  if (styles !== "") {
    head.push(styles);
  }

  return [
    "<!doctype html>",
    "<html lang=\"en\">",
    "  <head>",
    head.join("\n"),
    "  </head>",
    "  <body>",
    "    <div id=\"root\"></div>",
    "  </body>",
    "</html>",
    "",
  ].join("\n");
}
