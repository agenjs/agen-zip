export default class BufferReader {

  constructor(buffer) {
    this.buffer = buffer;
  }

  get bufferSize() { return 64 * 1024; }
    
  async* readRange(from, to) {
    let bufSize = this.bufferSize;
    const length = this.length;
    from = Math.min(from, length - 1);
    to = Math.min(to, length - 1);
    while (from < to) {
      let size = Math.min(to - from, bufSize);
      const block = await this.read(from, from + size);
      if (!block.length) break;
      yield block;
      from += block.length;
    }
  }

  async read(start, end) {
    return this.buffer.slice(start, end);
  }

  get length() { 
    return this.buffer.length;
  }
  
}