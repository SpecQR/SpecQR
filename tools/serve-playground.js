import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const port = Number(process.env.PORT ?? process.argv[2] ?? 4173);

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"]
]);

const server = createServer(async (request, response) => {
  try {
    const filePath = await resolveRequestPath(request.url ?? "/");
    const file = await stat(filePath);
    if (!file.isFile()) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": mimeTypes.get(extname(filePath)) ?? "application/octet-stream"
    });
    createReadStream(filePath).pipe(response);
  } catch (error) {
    response.writeHead(error?.code === "ENOENT" ? 404 : 500);
    response.end(error?.code === "ENOENT" ? "Not found" : "Internal server error");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`SpecQR playground: http://127.0.0.1:${port}/playground/`);
  console.log(`Browser example:   http://127.0.0.1:${port}/examples/browser-blob-object-url.html`);
});

async function resolveRequestPath(rawUrl) {
  const url = new URL(rawUrl, `http://127.0.0.1:${port}`);
  const decodedPath = decodeURIComponent(url.pathname);
  const relativePath = normalize(decodedPath)
    .replace(/^[/\\]+/, "")
    .replace(/^(\.\.(?:\/|\\|$))+/, "");
  let filePath = join(root, relativePath);

  if (!filePath.startsWith(`${root}${sep}`) && filePath !== root) {
    throw Object.assign(new Error("Forbidden"), { code: "EACCES" });
  }

  const file = await stat(filePath).catch((error) => {
    if (error.code !== "ENOENT") {
      throw error;
    }
    return null;
  });

  if (file?.isDirectory()) {
    filePath = join(filePath, "index.html");
  }

  return filePath;
}
