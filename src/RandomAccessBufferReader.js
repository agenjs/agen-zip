import RandomAccessReader from './RandomAccessReader.js';

export default class RandomAccessBufferReader extends RandomAccessReader {

  constructor(options) {
    super(options);
    this._buffer = this.options.buffer;
  }

  async read(start, end) {
    return this._buffer.slice(start, end);
  }

  get length() { 
    return this._buffer.length;
  }
  
}