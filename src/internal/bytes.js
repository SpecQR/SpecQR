export function getUtf8CanonicalInfo(text) {
  let byteLength = 0;
  let parity = 0;

  for (let index = 0; index < text.length;) {
    let codePoint = text.codePointAt(index);
    index += codePoint > 0xFFFF ? 2 : 1;
    if (codePoint >= 0xD800 && codePoint <= 0xDFFF) {
      codePoint = 0xFFFD;
    }

    if (codePoint <= 0x7F) {
      byteLength += 1;
      parity ^= codePoint;
    } else if (codePoint <= 0x7FF) {
      byteLength += 2;
      parity ^= 0xC0 | (codePoint >>> 6);
      parity ^= 0x80 | (codePoint & 0x3F);
    } else if (codePoint <= 0xFFFF) {
      byteLength += 3;
      parity ^= 0xE0 | (codePoint >>> 12);
      parity ^= 0x80 | ((codePoint >>> 6) & 0x3F);
      parity ^= 0x80 | (codePoint & 0x3F);
    } else {
      byteLength += 4;
      parity ^= 0xF0 | (codePoint >>> 18);
      parity ^= 0x80 | ((codePoint >>> 12) & 0x3F);
      parity ^= 0x80 | ((codePoint >>> 6) & 0x3F);
      parity ^= 0x80 | (codePoint & 0x3F);
    }
  }

  return { byteLength, parity };
}

export function countCodePoints(text) {
  let count = 0;
  for (const unused of text) {
    void unused;
    count += 1;
  }
  return count;
}
