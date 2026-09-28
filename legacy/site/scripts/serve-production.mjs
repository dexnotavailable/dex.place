import { createReadStream } from "node:fs";
import { open, readFile, realpath, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { gzip } from "node:zlib";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(process.env.DEX_SITE_ROOT || path.join(path.dirname(fileURLToPath(import.meta.url)), "../dist"));
const sp13Root = path.resolve(process.env.DEX_SP13_ROOT || "D:/Dex/GameDev/Deploy/SP13/WebGL");
const host = process.env.DEX_SITE_HOST || "127.0.0.1";
const port = Number(process.env.DEX_SITE_PORT || 8088);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid production origin port");

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".data": "application/octet-stream",
  ".exe": "application/vnd.microsoft.portable-executable",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".otf": "font/otf",
  ".png": "image/png",
  ".sha256": "text/plain; charset=utf-8",
  ".sha1": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".unityweb": "application/octet-stream",
  ".wasm": "application/wasm",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".zip": "application/zip",
  ".wav": "audio/wav",
  ".opus": "audio/ogg; codecs=opus",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
};

const sp13RootFiles = new Set([
  "index.html",
  "sp13-launcher.js",
  "sp13.css",
  "current.json",
]);

const sp13ReleasePath =
  /^releases\/[a-z0-9][a-z0-9-]{0,159}\/(?:release\.json|player\/.+)$/;

const sendText = (response, status, body) => {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
    "Content-Type": "text/plain; charset=utf-8",
  });
  response.end(body);
};

const parseRange = (header, size) => {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header?.trim() || "");
  if (!match || (!match[1] && !match[2]) || size === 0) return false;

  let start = match[1] ? Number(match[1]) : null;
  let end = match[2] ? Number(match[2]) : null;

  if (start === null && end !== null) {
    start = Math.max(0, size - end);
    end = size - 1;
  } else {
    start ??= 0;
    end ??= size - 1;
  }

  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    end < start ||
    start >= size
  ) {
    return false;
  }

  return { start, end: Math.min(end, size - 1) };
};

const isWithin = (base, candidate) => {
  const relative = path.relative(base, candidate);
  return (
    relative === "" ||
    (
      relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative)
    )
  );
};

const resolveContainedFile = async (base, relative) => {
  if (relative.includes("\\") || relative.includes("\0")) return null;
  const candidate = path.resolve(base, ...relative.split("/"));
  if (!isWithin(base, candidate)) return null;

  try {
    const [canonicalBase, canonicalCandidate] = await Promise.all([
      realpath(base),
      realpath(candidate),
    ]);
    if (!isWithin(canonicalBase, canonicalCandidate)) return null;

    const details = await stat(canonicalCandidate);
    return details.isFile() ? canonicalCandidate : null;
  } catch {
    return null;
  }
};

const resolveSp13Request = async (pathname) => {
  const relative =
    pathname === "/sp13/"
      ? "index.html"
      : pathname.slice("/sp13/".length);

  if (
    !relative ||
    relative.includes("\\") ||
    relative.split("/").some(
      (segment) => !segment || segment === "." || segment === ".."
    )
  ) {
    return null;
  }

  if (!sp13RootFiles.has(relative) && !sp13ReleasePath.test(relative)) {
    return null;
  }

  return resolveContainedFile(sp13Root, relative);
};

const resolveRequest = async (pathname) => {
  const relative = pathname.replace(/^\/+/, "").replace(/\/+$/, "") || "index.html";
  if (relative.split("/").some(segment => segment.startsWith(".") || segment === "..")
    || /^(?:src|scripts|node_modules|source|provenance|donors)(?:\/|$)/i.test(relative)
    || /^world\/trials(?:\/|$)/i.test(relative)
    || /\.(?:map|mjs|cjs|ts|tsx|ps1|env|pem|key)$/i.test(relative)) return null;
  const file = await resolveContainedFile(root, relative);
  if (file) return file;
  const directoryIndex = await resolveContainedFile(root, `${relative}/index.html`);
  if (directoryIndex) return directoryIndex;
  if (path.extname(relative)) return null;
  return resolveContainedFile(root, "index.html");
};

const describeRepresentation = (filePath) => {
  let mediaPath = filePath.toLowerCase();
  let contentEncoding = null;

  if (mediaPath.endsWith(".br")) {
    mediaPath = mediaPath.slice(0, -3);
    contentEncoding = "br";
  } else if (mediaPath.endsWith(".gz")) {
    mediaPath = mediaPath.slice(0, -3);
    contentEncoding = "gzip";
  }

  return {
    contentEncoding,
    contentType:
      contentTypes[path.extname(mediaPath)] || "application/octet-stream",
  };
};

// Cache only bounded text representations. Binary downloads and explicitly
// precompressed Unity files retain their exact bytes and existing range path.
const compressGzip = promisify(gzip);
const compressionPolicy = Object.freeze({ maxSourceBytes: 4 * 1024 * 1024, maxCacheBytes: 16 * 1024 * 1024, maxEntries: 64, maxJobs: 2 });
const textExtensions = new Set([".html", ".js", ".css", ".json", ".svg", ".md", ".txt", ".sha1", ".sha256"]);
const compressedCache = new Map();
const compressionJobs = new Map();
let compressedCacheBytes = 0;

const acceptedEncoding = (header) => {
  const values = new Map();
  for (const field of String(header || "").split(",")) {
    const [rawName, ...parameters] = field.trim().split(";");
    const name = rawName.trim().toLowerCase();
    if (!name) continue;
    let quality = 1;
    for (const parameter of parameters) {
      const match = /^\s*q\s*=\s*(0(?:\.\d{0,3})?|1(?:\.0{0,3})?)\s*$/i.exec(parameter);
      if (!match) { quality = 0; break; }
      quality = Number(match[1]);
    }
    values.set(name, Math.max(values.get(name) ?? 0, quality));
  }
  const gzipQuality = values.get("gzip") ?? values.get("*") ?? 0;
  const identityQuality = values.get("identity") ?? (values.get("*") === 0 ? 0 : 1);
  return { identity: identityQuality > 0, gzip: gzipQuality > 0 && (!values.has("identity") || gzipQuality >= identityQuality) };
};

const cachedGzip = async (filePath, details) => {
  const key = `${filePath}\0${details.size}\0${details.mtimeMs}`;
  const hit = compressedCache.get(key);
  if (hit) { compressedCache.delete(key); compressedCache.set(key, hit); return hit; }
  if (compressionJobs.has(key)) return compressionJobs.get(key);
  // Do not accumulate a queue or create a zlib instance for every request.
  if (compressionJobs.size >= compressionPolicy.maxJobs) return null;
  const work = (async () => {
    const file = await open(filePath, "r");
    let source;
    try {
      const before = await file.stat();
      if (!before.isFile() || before.size !== details.size || before.mtimeMs !== details.mtimeMs || before.size > compressionPolicy.maxSourceBytes) return null;
      source = Buffer.alloc(before.size);
      let offset = 0;
      while (offset < source.length) {
        const { bytesRead } = await file.read(source, offset, source.length - offset, offset);
        if (!bytesRead) return null;
        offset += bytesRead;
      }
      const after = await file.stat();
      if (after.size !== before.size || after.mtimeMs !== before.mtimeMs) return null;
    } finally { await file.close(); }
    const body = await compressGzip(source, { level: 6 });
    const entry = { body, etag: `"${createHash("sha256").update(body).digest("hex")}-gzip"` };
    // A revised source supersedes cached variants of that same file.
    for (const [oldKey, old] of compressedCache) if (oldKey.startsWith(`${filePath}\0`)) { compressedCache.delete(oldKey); compressedCacheBytes -= old.body.length; }
    while (compressedCache.size && (compressedCache.size >= compressionPolicy.maxEntries || compressedCacheBytes + body.length > compressionPolicy.maxCacheBytes)) {
      const oldest = compressedCache.keys().next().value;
      compressedCacheBytes -= compressedCache.get(oldest).body.length; compressedCache.delete(oldest);
    }
    compressedCache.set(key, entry); compressedCacheBytes += body.length;
    return entry;
  })().catch(() => null).finally(() => compressionJobs.delete(key));
  compressionJobs.set(key, work);
  return work;
};

let websiteService = null;
export async function attachWebsiteService(options = {}) {
  if (websiteService) throw new Error("Website service already attached");
  const runtimePath = options.runtimePath || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../server/runtime.mjs");
  const { createWebsiteService } = await import(pathToFileURL(runtimePath).href);
  const map = options.map || JSON.parse(await readFile(path.join(root, "world/rooms-v2.json"), "utf8"));
  websiteService = await createWebsiteService({ ...options, map });
  return websiteService;
}
const server = createServer(async (request, response) => {
  let parsedUrl;
  let pathname;
  try {
    if (!request.url || !request.url.startsWith("/") || request.url.startsWith("//") || request.url.includes("\\")) throw new Error("invalid request target");
    parsedUrl = new URL(request.url, `http://${host}`);
    pathname = decodeURIComponent(parsedUrl.pathname);
    if (/[\x00-\x1f\x7f]/.test(pathname) || pathname.includes("\\") || pathname.includes(":")) throw new Error("invalid path");
  } catch {
    sendText(response, 400, "bad request");
    return;
  }

  // One public origin owns versioned download identity. Preserve deep routes
  // when a visitor arrives through the existing alternate hostname.
  if (String(request.headers.host || "").toLowerCase().split(":")[0] === "www.dex.place") {
    response.writeHead(308, {
      "Cache-Control": "public, max-age=3600",
      Location: `https://dex.place${parsedUrl.pathname}${parsedUrl.search}`,
    });
    response.end();
    return;
  }

  if (pathname === "/api" || pathname.startsWith("/api/")) {
    // The same process owns static delivery and private website sessions. API
    // failures never fall through to an HTML page or a cacheable static file.
    if (websiteService) return websiteService.handler(request, response);
    response.writeHead(503, {"Cache-Control":"no-store", "Content-Type":"application/json; charset=utf-8", "X-Content-Type-Options":"nosniff"});
    response.end(JSON.stringify({code:"service-unavailable",message:"Account and nearby services are temporarily unavailable."}));
    return;
  }
  if (!["GET", "HEAD"].includes(request.method || "")) {
    response.setHeader("Allow", "GET, HEAD");
    sendText(response, 405, "method not allowed");
    return;
  }

  if (pathname === "/healthz") {
    sendText(response, 200, "ok");
    return;
  }

  if (pathname === "/sp13") {
    response.writeHead(308, {
      "Cache-Control": "no-store",
      Location: `/sp13/${parsedUrl.search}`,
    });
    response.end();
    return;
  }

  const isSp13 = pathname.startsWith("/sp13/");
  const filePath = isSp13
    ? await resolveSp13Request(pathname)
    : await resolveRequest(pathname);
  if (!filePath) {
    sendText(response, 404, "not found");
    return;
  }

  let details;
  try {
    details = await stat(filePath);
  } catch {
    sendText(response, 404, "not found");
    return;
  }

  const isHtml = path.extname(filePath).toLowerCase() === ".html";
  const isDownload = pathname.startsWith("/downloads/") && !isHtml
    && /\.(?:exe|zip|sha1|sha256)$/i.test(filePath);
  const isVersionedDownload = pathname.startsWith("/files/") && /\.zip$/i.test(filePath);
  const isImmutableAsset = !isHtml && (
    /^\/assets\/.+-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$/i.test(pathname)
    || /^\/files\/[^/]+\/v[0-9][^/]*\//.test(pathname)
    || /^\/content\/documentation\/v[0-9][^/]*\//.test(pathname)
    || /^\/audio\/world-v[0-9]+\/.+\.(?:wav|opus|m4a|ogg|mp3)$/.test(pathname)
    || /^\/world\/assets\/.+-v[0-9]+\.png$/.test(pathname)
  );
  const isSp13Current = pathname === "/sp13/current.json";
  const isSp13Release = pathname.startsWith("/sp13/releases/");
  const cacheControl = isSp13Current
    ? "no-store"
    : isSp13Release
      ? "public, max-age=31536000, immutable"
      : isSp13
        ? "no-cache"
        : isDownload
          ? "private, no-store"
          : isImmutableAsset
            ? "public, max-age=31536000, immutable"
            : isHtml
              ? "no-cache, no-transform"
              : "no-cache";
  const representation = describeRepresentation(filePath);
  const negotiable = !representation.contentEncoding && textExtensions.has(path.extname(filePath).toLowerCase()) && details.size <= compressionPolicy.maxSourceBytes && !isDownload;
  const accepted = acceptedEncoding(request.headers["accept-encoding"]);
  let compressed = null;
  // Explicit Range always selects identity, including an If-Range mismatch
  // that subsequently falls back to the full identity response.
  if (negotiable && !request.headers.range && accepted.gzip && (details.size >= 256 || !accepted.identity)) compressed = await cachedGzip(filePath, details);
  if (!representation.contentEncoding && !compressed && !accepted.identity) {
    response.setHeader("Vary", "Accept-Encoding");
    if (negotiable && !request.headers.range && accepted.gzip) {
      response.setHeader("Retry-After", "1"); sendText(response, 503, "representation temporarily unavailable");
    } else sendText(response, 406, "no acceptable representation");
    return;
  }
  const etag = compressed?.etag || `W/"${details.size.toString(16)}-${Math.trunc(details.mtimeMs).toString(16)}"`;
  let range = request.headers.range ? parseRange(request.headers.range, details.size) : null;
  if (range && request.headers["if-range"]) {
    const validatorDate = Date.parse(String(request.headers["if-range"]));
    if (!Number.isFinite(validatorDate) || Math.floor(details.mtimeMs / 1000) * 1000 > validatorDate) range = null;
  }

  if (
    !isSp13Current &&
    request.headers["if-none-match"] &&
    String(request.headers["if-none-match"]).split(",").some(value => value.trim() === "*" || value.trim().replace(/^W\//, "") === etag.replace(/^W\//, ""))
  ) {
    const notModifiedHeaders = {
      "Cache-Control": cacheControl,
      ETag: etag,
      "Last-Modified": details.mtime.toUTCString(),
    };
    if (negotiable) notModifiedHeaders.Vary = "Accept-Encoding";
    if (compressed) notModifiedHeaders["Content-Encoding"] = "gzip";
    if (isSp13) {
      notModifiedHeaders["Cloudflare-CDN-Cache-Control"] = cacheControl;
    }
    response.writeHead(304, notModifiedHeaders);
    response.end();
    return;
  }

  if (range === false) {
    response.writeHead(416, { "Cache-Control": "no-store", "Content-Range": `bytes */${details.size}`, "Content-Length": "0" });
    response.end();
    return;
  }

  const headers = {
    "Accept-Ranges": "bytes",
    "Cache-Control": cacheControl,
    "Content-Type": representation.contentType,
    ETag: etag,
    "Last-Modified": details.mtime.toUTCString(),
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
  };

  if (negotiable) headers.Vary = "Accept-Encoding";
  if (compressed) headers["Content-Encoding"] = "gzip";

  if (representation.contentEncoding) {
    headers["Content-Encoding"] = representation.contentEncoding;
  }

  if (isSp13) {
    headers["Cloudflare-CDN-Cache-Control"] = cacheControl;
  }

  if (isDownload || isVersionedDownload) {
    headers["Content-Disposition"] = `attachment; filename="${path.basename(filePath)}"`;
  }

  const start = range ? range.start : 0;
  const end = range ? range.end : details.size - 1;
  headers["Content-Length"] = String(range ? end - start + 1 : compressed?.body.length ?? details.size);

  if (range) {
    headers["Content-Range"] = `bytes ${start}-${end}/${details.size}`;
  }

  response.writeHead(range ? 206 : 200, headers);
  if (request.method === "HEAD" || details.size === 0) {
    if (request.method !== "HEAD" && compressed) response.end(compressed.body);
    else response.end();
    return;
  }

  if (compressed) { response.end(compressed.body); return; }

  const stream = createReadStream(filePath, { start, end });
  stream.on("error", () => response.destroy());
  response.on("close", () => stream.destroy());
  stream.pipe(response);
});

const compressionDiagnostics = () => ({ ...compressionPolicy, cacheBytes: compressedCacheBytes, cacheEntries: compressedCache.size, activeJobs: compressionJobs.size });
export { server, parseRange, resolveContainedFile, describeRepresentation, compressionDiagnostics };
export async function startProductionOrigin() {
  if (!await resolveContainedFile(root, "index.html")) throw new Error("Production root requires a contained index.html");
  if (process.env.DEX_SITE_SERVICES === "1") await attachWebsiteService();
  server.listen(port, host, () => console.log(`dex production origin: http://${host}:${port}`));
  let closing=false;
  const shutdown = () => {if(closing)return;closing=true;server.close(async () => {await websiteService?.close?.();process.exit(0);});server.closeIdleConnections();setTimeout(()=>process.exit(1),10000).unref();};
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await startProductionOrigin();
