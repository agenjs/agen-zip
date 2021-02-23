import ZipBase from './ZipBase.js';
import ZipEntry from './ZipEntry.js';

export default class ZipReader extends ZipBase {

  constructor(options) {
    super();
    this.options = options;
  }

  get reader() { return this.options.reader; }

  async* readFiles() {
    const reader = this.reader;
    const totalSize = reader.length;
    if (typeof totalSize !== "number") throw new Error("expected totalSize parameter to be a number");
    if (totalSize > Number.MAX_SAFE_INTEGER) {
      throw new Error("zip file too large. only file sizes up to 2^52 are supported due to JavaScript's Number type being an IEEE 754 double.");
    }

    // eocdr means End of Central Directory Record.
    // search backwards for the eocdr signature.
    // the last field of the eocdr is a variable-length comment.
    // the comment size is encoded in a 2-byte field in the eocdr, which we can't find without trudging backwards through the comment to find it.
    // as a consequence of this design decision, it's possible to have ambiguous zip file metadata if a coherent eocdr was in the comment.
    // we search backwards for a eocdr signature, and hope that whoever made the zip file was smart enough to forbid the eocdr signature in the comment.
    var eocdrWithoutCommentSize = 22;
    var maxCommentSize = 0xffff; // 2-byte size
    var bufferSize = Math.min(eocdrWithoutCommentSize + maxCommentSize, totalSize);
    var bufferReadStart = totalSize - bufferSize;
    var buffer;

    buffer = await reader.read(bufferReadStart, bufferReadStart + bufferSize);

    for (var i = bufferSize - eocdrWithoutCommentSize; i >= 0; i--) {

      if (this._readUInt32LE(buffer, i) !== 0x06054b50) continue;

      // found eocdr
      const eocdrBuffer = buffer.slice(i);

      // 0 - End of central directory signature = 0x06054b50
      // 4 - Number of this disk
      var diskNumber = this._readUInt16LE(eocdrBuffer, 4);
      if (diskNumber !== 0) {
        throw new Error("multi-disk zip files are not supported: found disk number: " + diskNumber);
      }
      // 6 - Disk where central directory starts
      // 8 - Number of central directory records on this disk
      // 10 - Total number of central directory records
      let entryCount = this._readUInt16LE(eocdrBuffer, 10);

      // 12 - Size of central directory (bytes)
      // 16 - Offset of start of central directory, relative to start of archive
      let centralDirectoryOffset = this._readUInt32LE(eocdrBuffer, 16);

      // 20 - Comment length
      const commentLength = this._readUInt16LE(eocdrBuffer, 20);
      const expectedCommentLength = eocdrBuffer.length - eocdrWithoutCommentSize;
      if (commentLength !== expectedCommentLength) {
        throw new Error(`Invalid comment length. expected: ${expectedCommentLength}. found: ${commentLength}`);
      }

      // // 22 - Comment
      // // the encoding is always cp437.
      // const comment = decodeStrings
      // ? decodeBuffer(eocdrBuffer, 22, eocdrBuffer.length, false)
      // : eocdrBuffer.slice(22);

      if (entryCount === 0xffff || centralDirectoryOffset === 0xffffffff) {
        // ZIP64 format
        // ZIP64 Zip64 end of central directory locator
        const zip64EocdlBufferLength = 20;
        const zip64EocdlOffset = bufferReadStart + i - zip64EocdlBufferLength;
        const zip64EocdlBuffer = await reader.read(zip64EocdlOffset, zip64EocdlOffset + zip64EocdlBufferLength);
        // 0 - zip64 end of central dir locator signature = 0x07064b50
        if (this._readUInt32LE(zip64EocdlBuffer, 0) !== 0x07064b50) {
          throw new Error(`Invalid zip64 end of central directory locator signature`);
        }
        // 4 - number of the disk with the start of the zip64 end of central directory
        // 8 - relative offset of the zip64 end of central directory record
        var zip64EocdrOffset = this._readUInt64LE(zip64EocdlBuffer, 8);
        // 16 - total number of disks

        // ZIP64 end of central directory record
        const zip64EocdrBufferLength = 56;
        const zip64EocdrBuffer = await reader.read(zip64EocdrOffset, zip64EocdrOffset + zip64EocdrBufferLength);

        // 0 - zip64 end of central dir signature                           4 bytes  (0x06064b50)
        if (this._readUInt32LE(zip64EocdrBuffer, 0) !== 0x06064b50) {
          throw new Error("invalid zip64 end of central directory record signature");
        }
        // 4 - size of zip64 end of central directory record                8 bytes
        // 12 - version made by                                             2 bytes
        // 14 - version needed to extract                                   2 bytes
        // 16 - number of this disk                                         4 bytes
        // 20 - number of the disk with the start of the central directory  4 bytes
        // 24 - total number of entries in the central directory on this disk         8 bytes
        // 32 - total number of entries in the central directory            8 bytes
        entryCount = this._readUInt64LE(zip64EocdrBuffer, 32);
        // 40 - size of the central directory                               8 bytes
        // 48 - offset of start of central directory with respect to the starting disk number     8 bytes
        centralDirectoryOffset = this._readUInt64LE(zip64EocdrBuffer, 48);
        // 56 - zip64 extensible data sector                                (variable size)
      }
      yield* this._readZipEntries(reader, centralDirectoryOffset, entryCount);
      break;
    }
  }

  async* _readZipEntries(reader, position, entryCount) {
    for (let i = 0; i < entryCount; i++) {
      const entry = new ZipEntry(this.reader, position);
      await entry._load();
      position = entry.endPosition;
      yield entry.getFile();
    }
  }

} 