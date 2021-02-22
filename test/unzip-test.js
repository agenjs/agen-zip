import tape from "tape-await";
import * as agen from '../dist/agen-zip-esm.js';

// import { Buffer } from "buffer";
import fs from "fs";
import path from "path";
const { promisify } = require('util');
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

import { BufferReader, ZipReader } from "../src/index.js";

tape(`ZipReader should be able to read files`, async function() {
  // const buf = fs.readFileSync(path.resolve(__dirname, './assets/big-compression.zip'));
  // const buf = fs.readFileSync(path.resolve(__dirname, './assets/zip64/zip64.zip_fragment'))

  const dir = path.resolve(__dirname, './data');
  for await (let file of loadControl(dir)) {
    await testUnzip(file);
  }

  
  // t.equal(test.length, control.length);
  // t.deepEqual(test, control);
});

async function testUnzip({ path : filePath, content, buf }) {
  tape(`ZipReader - ${filePath}`,  async function(t) {
    const reader = new agen.BufferReader(buf);
    const z = new agen.ZipReader({ reader });
    let count = 0;
    for await (let f of z.readFiles()) {
      const isDirectory = f.path[f.path.length - 1] === '/';
      if (isDirectory) continue;
      const control = content[f.path];
      t.equal(typeof control, 'object')
      t.equal(f.path, control.path);
      t.equal(f.size, control.size);
      count++;
    }
    // t.equal(count, Object.keys(content).length);
  })
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
      buf,
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
    if (!isDirectory) info.size = file.size;
    index[filePath] = info;
  }
  return index;
}

async function* list(filePath, recursive) {
  const rootDir = path.dirname(filePath);
  yield* readDir(filePath);
  
  async function* readDir(dir) {
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
      if (recursive && isDirectory) yield* readDir(filePath, rootDir);
    }
  }
}

async function call(action) {
  return new Promise((resolve, reject) => {
    try {
      action((error, result) => (error ? reject(error) : resolve(result)));
    } catch (err) {
      reject(err);
    }
  });
}
