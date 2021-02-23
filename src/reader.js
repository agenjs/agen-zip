
import BufferReader from "./BufferReader.js";

export default function reader(buf) {
  return new BufferReader(buf);
}