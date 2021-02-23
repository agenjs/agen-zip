import RandomAccessReader from './RandomAccessReader.js';

export default class RandomAccessBufferReader extends RandomAccessReader {

  constructor(options) {
    super(options);
    this._file = this.options.file;
  }

  async read(start, end) {
    const blob = this.file.slice(start, end);
    return new Uint8Array(await blob.arrayBuffer());
  }

  get length() { 
    return this._file.size;
  }
  
}