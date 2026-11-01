// npm run package: builds <project>.zip to upload in MCP Express, with package.json, the
// lockfile, tsconfig.json and src/. MCP Express installs the dependencies and bundles
// src/tools.ts itself, and never receives your .env: set those values in the server's
// Environment Secrets tab.
//
// Plain Node, no dependencies, so it works the same on macOS, Linux and Windows.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";
import { deflateRawSync } from "node:zlib";

const root = process.cwd();
const include = ["package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lock", "tsconfig.json", "src"];
const skip = (name) => name === "node_modules" || name === ".DS_Store" || /^\.env(\..*)?$/.test(name);

const files = [];
const walk = (path) => {
  if (skip(basename(path))) return;
  if (statSync(path).isDirectory()) for (const name of readdirSync(path).sort()) walk(join(path, name));
  else files.push(path);
};
for (const entry of include) if (existsSync(join(root, entry))) walk(join(root, entry));
if (!files.some((f) => relative(root, f) === "package.json")) {
  console.error("Run this from the project folder (no package.json here).");
  process.exit(1);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

// DOS date/time of "now", stored on every entry.
const now = new Date();
const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

const locals = [];
const central = [];
let offset = 0;
for (const file of files) {
  const name = Buffer.from(relative(root, file).split(sep).join("/"));
  const data = readFileSync(file);
  const packed = deflateRawSync(data);
  const crc = crc32(data);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4); // version needed
  local.writeUInt16LE(0x0800, 6); // UTF-8 names
  local.writeUInt16LE(8, 8); // deflate
  local.writeUInt16LE(dosTime, 10);
  local.writeUInt16LE(dosDate, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(packed.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  locals.push(local, name, packed);

  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4); // version made by
  header.writeUInt16LE(20, 6); // version needed
  header.writeUInt16LE(0x0800, 8);
  header.writeUInt16LE(8, 10);
  header.writeUInt16LE(dosTime, 12);
  header.writeUInt16LE(dosDate, 14);
  header.writeUInt32LE(crc, 16);
  header.writeUInt32LE(packed.length, 20);
  header.writeUInt32LE(data.length, 24);
  header.writeUInt16LE(name.length, 28);
  header.writeUInt32LE(offset, 42);
  central.push(header, name);

  offset += local.length + name.length + packed.length;
}

const centralSize = central.reduce((n, b) => n + b.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralSize, 12);
end.writeUInt32LE(offset, 16);

const out = `${basename(root)}.zip`;
const zip = Buffer.concat([...locals, ...central, end]);
writeFileSync(join(root, out), zip);
console.log(`${out}: ${files.length} files, ${(zip.length / 1024).toFixed(1)} KB. Upload it in your server's Tools tab.`);
