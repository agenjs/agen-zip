import tape from "tape-await";
import zlib from "zlib";
import fs from "fs";
import path from "path";
import { reader, unzip } from "../src/index.js";
const { promisify } = require("util");

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

tape(`ZipReader`, async function() {
  const dir = path.resolve(__dirname, './data');
  for await (let file of loadControl(dir)) {
    await testUnzip(file);
  }
});

async function testUnzip({ path : filePath, content, buf }) {
  tape(`ZipReader - ${filePath}`,  async function(t) {
    const files = unzip(reader(buf));
    let count = 0;
    for await (let f of files()) {
      const isDirectory = f.path[f.path.length - 1] === '/';
      if (isDirectory) continue;
      const control = content[f.path];
      t.equal(typeof control, 'object')
      t.equal(f.path, control.path);
      t.equal(f.size, control.size);
      const buf = await readContent(f.content(), f.compressed);
      t.deepEqual(buf, control.content);
      count++;
    }
  })
}

async function readContent(it, inflate) {
  const blocks = [];
  for await (let block of it) {
    blocks.push(block);
  }
  let result = Buffer.concat(blocks);
  if (inflate) result = zlib.inflateRawSync(result);
  return result.toString('UTF-8');
}

async function* loadControl(dir) {
  for await (let file of list(dir, false)) {
    const filePath = file.path;
    const controlDir = filePath.replace(/\.zip$/gi, '');
    if (controlDir === filePath) continue;
    const buf = fs.readFileSync(filePath);
    const content = await loadControlDirContent(controlDir);
    yield {
      path : path.relative(dir, controlDir),
      // Transform to Uint8Array to be sure that everything works with arrays
      buf : new Uint8Array(buf),
      content
    }
  }
}

async function loadControlDirContent(dir) {
  const index = {};
  for await (let file of list(dir, true)) {
    const filePath = path.relative(dir, file.path);
    const isDirectory = file.directory;
    const info = { path: filePath };
    info.directory = isDirectory;
    info.file = !isDirectory;
    if (!isDirectory) {
      info.size = file.size;
      info.content = fs.readFileSync(file.path, 'UTF-8');
    }
    index[filePath] = info;
  }
  return index;
}

async function* list(filePath, recursive) {
  yield* _readDir(filePath);
  
  async function* _readDir(dir) {
    let filePaths = await readdir(dir);
    for (let filePath of filePaths) {
      filePath = path.resolve(dir, filePath);
      const fileStat = await stat(filePath);
      const isDirectory = fileStat.isDirectory();
      const info = {
        path: filePath, // path.relative(rootDir, filePath),
        size: fileStat.size,
        directory: isDirectory
      }
      yield info;
      if (recursive && isDirectory) yield* _readDir(filePath);
    }
  }
}