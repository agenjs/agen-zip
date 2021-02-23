export default class ZipBase {

  _decodeBuffer(buffer, start, end, isUtf8) {
    if (isUtf8) {
      return this._readUtf8(buffer, start, end);
    } else {
      return this._readCp437(buffer, start, end);
    }
  }

  _readUtf8(buffer, start, end) {
    const decoder = newDecoder();
    let result = '';
    for (let i = start; i < end; i++) {
      result += decoder(buffer[i]);
    }
    return result;
  }

  _readCp437(buffer, start, end) {
    const cp437 = '\u0000☺☻♥♦♣♠•◘○◙♂♀♪♫☼►◄↕‼¶§▬↨↑↓→←∟↔▲▼ !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~⌂ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ';
    let result = "";
    for (var i = start; i < end; i++) {
      result += cp437[buffer[i]];
    }
    return result;
  }

  _readUInt16LE(buffer, offset) {
    offset = offset >>> 0;
    return buffer[offset] | (buffer[offset + 1] << 8);
  }

  _readUInt32LE(buffer, offset) {
    offset = offset >>> 0;
    return ((buffer[offset]) |
      (buffer[offset + 1] << 8) |
      (buffer[offset + 2] << 16)) +
      (buffer[offset + 3] * 0x1000000);
  }

  _readUInt64LE(buffer, offset) {
    // there is no native function for this, because we can't actually store 64-bit integers precisely.
    // after 53 bits, JavaScript's Number type (IEEE 754 double) can't store individual integers anymore.
    // but since 53 bits is a whole lot more than 32 bits, we do our best anyway.
    var lower32 = this._readUInt32LE(buffer, offset);
    var upper32 = this._readUInt32LE(buffer, offset + 4);
    // we can't use bitshifting here, because JavaScript bitshifting only works on 32-bit integers.
    return upper32 * 0x100000000 + lower32;
    // as long as we're bounds checking the result of this function against the total file size,
    // we'll catch any overflow errors, because we already made sure the total file size was within reason.
  }

}

// Copy/paste from the @agen/enecoding package
function newDecoder(onError = (err) => { throw err }) {
  let char = 0, charLen = 1;
  return (c) => {
    let chr = '';
    if (charLen === 1) {
      if (c > 191 && c < 224) {
        char = (c & 31) << 6;
        charLen = 2;
      } else if (c > 223 && c < 240) {
        c = (c & 15) << 12;
        charLen = 3;
      } else if (c > 239 && c < 248) {
        char = (c & 7) << 18;
        charLen = 4;
      } else {
        char = c;
        charLen = 1;
      }
    } else {
      char |= (c & 63) << ((charLen - 2) * 6);
      charLen--;
    }
    if (charLen === 1) {
      if (char <= 0xffff) {
        chr = String.fromCharCode(char);
      } else if (char <= 0x10ffff) {
        char -= 0x10000;
        chr = String.fromCharCode(char >> 10 | 0xd800) +
          String.fromCharCode(char & 0x3FF | 0xdc00);
      } else {
        onError(new Error(`UTF-8 decode: code point 0x${char.toString(16)} exceeds UTF-16 reach`));
      }
    }
    return chr;
  }
}
