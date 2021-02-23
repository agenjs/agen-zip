export default class RandomAccessReader {

  constructor(options) {
    this.options = options || {};
  }

  get bufferSize() { return this.options.bufferSize || 64 * 1024; }
    
  async* readRange(start, end) {
    let bufSize = this.bufferSize;
    const length = this.length;
    start = Math.min(start, length - 1);
    end = Math.min(end, length - 1);
    while (start < end) {
      let size = Math.min(end - start, bufSize);
      const block = await this.read(start, start + size);
      if (!block.length) break;
      yield block;
      start += block.length;
    }
  }

  async read(/* start, end */) {
    throw new Error('Not implemented');
  }

  get length() { 
    throw new Error('Not implemented');
  }
  
}