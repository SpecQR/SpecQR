const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function bytesToBase64(bytes) {
  let result = "";
  let index = 0;

  for (; index + 2 < bytes.length; index += 3) {
    const value = (bytes[index] << 16) | (bytes[index + 1] << 8) | bytes[index + 2];
    result += BASE64_ALPHABET[(value >>> 18) & 0x3F];
    result += BASE64_ALPHABET[(value >>> 12) & 0x3F];
    result += BASE64_ALPHABET[(value >>> 6) & 0x3F];
    result += BASE64_ALPHABET[value & 0x3F];
  }

  if (index < bytes.length) {
    const remaining = bytes.length - index;
    const value = bytes[index] << 16 | (remaining === 2 ? bytes[index + 1] << 8 : 0);
    result += BASE64_ALPHABET[(value >>> 18) & 0x3F];
    result += BASE64_ALPHABET[(value >>> 12) & 0x3F];
    result += remaining === 2 ? BASE64_ALPHABET[(value >>> 6) & 0x3F] : "=";
    result += "=";
  }

  return result;
}
