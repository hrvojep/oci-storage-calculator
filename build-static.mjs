import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await mkdir("dist/server/public", { recursive: true });

const files = ["index.html", "styles.css", "script.js"];
const content = {};
for (const file of files) {
  await cp(file, `dist/server/public/${file}`);
  content[file] = await readFile(file, "utf8");
}
const worker = `const assets = ${JSON.stringify(content)};
const types = { "index.html": "text/html; charset=utf-8", "styles.css": "text/css; charset=utf-8", "script.js": "text/javascript; charset=utf-8" };
export default {
  async fetch(request) {
    const pathname = new URL(request.url).pathname;
    const key = pathname === "/" || pathname === "/index.html" ? "index.html" : pathname.slice(1);
    if (!(key in assets)) return new Response("Not found", { status: 404 });
    return new Response(assets[key], { headers: { "content-type": types[key], "cache-control": key === "index.html" ? "no-cache" : "public, max-age=3600" } });
  }
};
`;
await writeFile("dist/server/index.js", worker);
console.log("Built Cloudflare Worker site in dist/");
