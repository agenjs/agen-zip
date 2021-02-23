import ZipBase from './ZipBase.js';

export default class ZipEntry extends ZipBase {

  constructor(reader, position) {
    super();
    this.startPosition = position;
    this.endPosition = position;
    this.reader = reader;
  }

  getFile() {
    if (!this._file) {
      const entry = this;
      this._file = {
        get path() { return entry.fileName.replace(/\\/gim, '/'); },
        get size() { return entry.uncompressedSize; },
        get type() { return ''; },
        content : async function* content() {
          let it = entry.readRawContent();
          // if (entry.isCompressed()) it = agen.inflate(it, { raw: true });
          yield* it;
        },
        get compressedSize() { return entry.compressedSize; },
        get modified() { return entry.getLastModDate(); },
        get compressed() { return entry.isCompressed(); }
      };
    }
    return this._file;
  }

  getLastModDate() {
    const date = this.lastModFileDate;
    const time = this.lastModFileTime;

    var day = date & 0x1f; // 1-31
    var month = (date >> 5 & 0xf) - 1; // 1-12, 0-11
    var year = (date >> 9 & 0x7f) + 1980; // 0-128, 1980-2108

    var millisecond = 0;
    var second = (time & 0x1f) * 2; // 0-29, 0-58 (even numbers)
    var minute = time >> 5 & 0x3f; // 0-59
    var hour = time >> 11 & 0x1f; // 0-23

    return new Date(year, month, day, hour, minute, second, millisecond);
  }

  isEncrypted() {
    return (this.generalPurposeBitFlag & 0x1) !== 0;
  }

  isCompressed() {
    return this.compressionMethod === 8;
  }


  get fileName() {
    if (this._fileName === undefined) {
      this._fileName = this._decode(this._fileNameBuf);
    }
    return this._fileName;
  }

  get fileComment() {
    if (this._fileComment === undefined) {
      this._fileComment = this._decode(this._commentsBuf);
    }
    return this._fileComment;
  }

  get binExtraFields() {
    if (!this._binExtraFields) {
      const buf = this._extraFieldsBuf;
      const fields = this._binExtraFields = [];
      var i = 0;
      while (i < buf.length - 3) {
        const headerId = this._readUInt16LE(buf, i + 0);
        const dataSize = this._readUInt16LE(buf, i + 2);
        const dataStart = i + 4;
        const dataEnd = dataStart + dataSize;
        if (dataEnd > buf.length) {
          throw new Error("Extra field length exceeds extra field buffer size");
        }
        const data = buf.slice(dataStart, dataEnd);
        fields.push({ id: headerId, data });
        i = dataEnd;
      }
    }
    return this._binExtraFields;
  }

  async* readRawContent() {
    // parameter validation
    var relativeStart = 0;
    var relativeEnd = this.compressedSize;
    const fileSize = this.reader.length;

    let buffer;
    buffer = await this.reader.read(this.relativeOffsetOfLocalHeader, this.relativeOffsetOfLocalHeader + 30);
    // 0 - Local file header signature = 0x04034b50
    var signature = this._readUInt32LE(buffer, 0);
    if (signature !== 0x04034b50) {
      throw new Error("invalid local file header signature: 0x" + signature.toString(16));
    }
    // all this should be redundant
    // 4 - Version needed to extract (minimum)
    // 6 - General purpose bit flag
    // 8 - Compression method
    // 10 - File last modification time
    // 12 - File last modification date
    // 14 - CRC-32
    // 18 - Compressed size
    // 22 - Uncompressed size
    // 26 - File name length (n)
    const fileNameLength = this._readUInt16LE(buffer, 26);
    // 28 - Extra field length (m)
    const extraFieldLength = this._readUInt16LE(buffer, 28);
    // 30 - File name
    // 30+n - Extra field

    const localFileHeaderEnd = this.relativeOffsetOfLocalHeader + buffer.length + fileNameLength + extraFieldLength;

    // let decompress;
    // if (this.compressionMethod === 0) {
    //   // 0 - The file is stored (no compression)
    //   decompress = false;
    // } else if (this.compressionMethod === 8) {
    //   // 8 - The file is Deflated
    //   decompress = true;
    // } else {
    //   throw new Error("unsupported compression method: " + this.compressionMethod);
    // }
    const fileDataStart = localFileHeaderEnd;
    const fileDataEnd = fileDataStart + this.compressedSize;

    if (this.compressedSize !== 0) {
      // bounds check now, because the read streams will probably not complain loud enough.
      // since we're dealing with an unsigned offset plus an unsigned size,
      // we only have 1 thing to check for.
      if (fileDataEnd > fileSize) {
        throw new Error("file data overflows file bounds: " +
          fileDataStart + " + " + this.compressedSize + " > " + fileSize);
      }
    }
    let it = this.reader.readRange(fileDataStart + relativeStart, fileDataStart + relativeEnd);
    yield* it;
  }

  async _load() {
    let buffer, len;

    len = 46;
    buffer = await this._loadBuffer(len);
    this._readFileHeader(buffer);

    // Read metadata block (file name + extra fields + file comment);
    len = this.fileNameLength + this.extraFieldLength + this.fileCommentLength;
    buffer = await this._loadBuffer(len);
    this._readMetadata(buffer);
  }

  _readFileHeader(buffer) {
    // 0 - Central directory file header signature
    const signature = this._readUInt32LE(buffer, 0);
    if (signature !== 0x02014b50) {
      throw new Error("Invalid central directory file header signature: 0x" + signature.toString(16));
    }
    // 4 - Version made by
    this.versionMadeBy = this._readUInt16LE(buffer, 4);
    // 6 - Version needed to extract (minimum)
    this.versionNeededToExtract = this._readUInt16LE(buffer, 6);
    // 8 - General purpose bit flag
    this.generalPurposeBitFlag = this._readUInt16LE(buffer, 8);
    // 10 - Compression method
    this.compressionMethod = this._readUInt16LE(buffer, 10);
    // 12 - File last modification time
    this.lastModFileTime = this._readUInt16LE(buffer, 12);
    // 14 - File last modification date
    this.lastModFileDate = this._readUInt16LE(buffer, 14);
    // 16 - CRC-32
    this.crc32 = this._readUInt32LE(buffer, 16);
    // 20 - Compressed size
    this.compressedSize = this._readUInt32LE(buffer, 20);
    // 24 - Uncompressed size
    this.uncompressedSize = this._readUInt32LE(buffer, 24);
    // 28 - File name length (n)
    this.fileNameLength = this._readUInt16LE(buffer, 28);
    // 30 - Extra field length (m)
    this.extraFieldLength = this._readUInt16LE(buffer, 30);
    // 32 - File comment length (k)
    this.fileCommentLength = this._readUInt16LE(buffer, 32);
    // 34 - Disk number where file starts
    // 36 - Internal file attributes
    this.internalFileAttributes = this._readUInt16LE(buffer, 36);
    // 38 - External file attributes
    this.externalFileAttributes = this._readUInt32LE(buffer, 38);
    // 42 - Relative offset of local file header
    this.relativeOffsetOfLocalHeader = this._readUInt32LE(buffer, 42);

    if (this.generalPurposeBitFlag & 0x40) {
      throw new Error("strong encryption is not supported");
    }
  }

  _readMetadata(buffer) {
    let i = 0;
    // 46 - File name
    this._fileNameBuf = buffer.slice(i, i += this.fileNameLength);
    // 46+n - Extra field
    this._extraFieldsBuf = buffer.slice(i, i += this.extraFieldLength);
    this._readZip64Fields();

    // Comment field
    this._commentsBuf = buffer.slice(i += this.fileCommentLength);
  }

  _readZip64Fields() {
    if ((this.uncompressedSize != 0xffffffff) &&
      (this.compressedSize !== 0xffffffff) &
      (this.relativeOffsetOfLocalHeader !== 0xffffffff)) return;

    // ZIP64 format
    // find the Zip64 Extended Information Extra Field
    var zip64EiefBuffer = null;
    const extraFields = this.binExtraFields;
    for (var i = 0; i < extraFields.length; i++) {
      var extraField = extraFields[i];
      if (extraField.id === 0x0001) {
        zip64EiefBuffer = extraField.data;
        break;
      }
    }
    if (zip64EiefBuffer == null) {
      throw new Error("expected zip64 extended information extra field");
    }
    var index = 0;
    // 0 - Original Size          8 bytes
    if (this.uncompressedSize === 0xffffffff) {
      if (index + 8 > zip64EiefBuffer.length) {
        throw new Error("zip64 extended information extra field does not include uncompressed size");
      }
      this.uncompressedSize = this._readUInt64LE(zip64EiefBuffer, index);
      index += 8;
    }
    // 8 - Compressed Size        8 bytes
    if (this.compressedSize === 0xffffffff) {
      if (index + 8 > zip64EiefBuffer.length) {
        throw new Error("zip64 extended information extra field does not include compressed size");
      }
      this.compressedSize = this._readUInt64LE(zip64EiefBuffer, index);
      index += 8;
    }
    // 16 - Relative Header Offset 8 bytes
    if (this.relativeOffsetOfLocalHeader === 0xffffffff) {
      if (index + 8 > zip64EiefBuffer.length) {
        throw new Error("zip64 extended information extra field does not include relative header offset");
      }
      this.relativeOffsetOfLocalHeader = this._readUInt64LE(zip64EiefBuffer, index);
      index += 8;
    }
    // 24 - Disk Start Number      4 bytes
  }

  _decode(buf) {
    return this._decodeBuffer(buf, 0, buf.length, this._isUtf8);
  }

  get _isUtf8() {
    return (this.generalPurposeBitFlag & 0x800) !== 0;
  }

  async _loadBuffer(size) {
    const buf = await this.reader.read(this.endPosition, this.endPosition + size);
    this.endPosition += size;
    return buf;
  }


}