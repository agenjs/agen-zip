
import RandomAccessBufferReader from "./RandomAccessBufferReader.js";
import RandomAccessFileReader from "./RandomAccessFileReader.js";

export function bufferReader(buffer) {
  return new RandomAccessBufferReader({ buffer });
}

export function fileReader(file) {
  return new RandomAccessFileReader({ file });
}