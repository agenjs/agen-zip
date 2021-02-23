import ZipReader from './ZipReader.js';

export default function unzip(reader) {
  const z = new ZipReader({ reader });
  return async function*() {
    yield* z.readFiles();
  }
}