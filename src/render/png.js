import { bytesToBase64 } from "./base64.js";
import { parseRgbaColor } from "./color.js";
import { getRasterGeometry } from "./geometry.js";

const PNG_SIGNATURE = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
const CRC_TABLE = createCrcTable();

export function renderPng(matrix, options) {
  const margin = options.margin;
  const scale = options.scale;
  const { dimension: width } = getRasterGeometry(matrix, options, "png");
  const height = width;
  const foreground = parseRgbaColor(options.foreground, "foreground", true);
  const background = parseRgbaColor(options.background, "background", true);
  const raw = rasterize(matrix, width, height, margin, scale, foreground, background);
  const compressed = createZlibStoredStream(raw);

  return concatBytes([
    Uint8Array.from(PNG_SIGNATURE),
    createChunk("IHDR", createIhdr(width, height)),
    createChunk("IDAT", compressed),
    createChunk("IEND", new Uint8Array(0))
  ]);
}

export function renderPngDataUrl(matrix, options) {
  getRasterGeometry(matrix, options, "png-data-url");
  return `data:image/png;base64,${bytesToBase64(renderPng(matrix, options))}`;
}

function rasterize(matrix, width, height, margin, scale, foreground, background) {
  const rowBytes = width * 4 + 1;
  const raw = new Uint8Array(rowBytes * height);
  const size = matrix.length;

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * rowBytes;
    raw[rowStart] = 0;
    const moduleY = Math.floor(y / scale) - margin;

    for (let x = 0; x < width; x += 1) {
      const moduleX = Math.floor(x / scale) - margin;
      const isDark =
        moduleX >= 0 &&
        moduleY >= 0 &&
        moduleX < size &&
        moduleY < size &&
        matrix[moduleY][moduleX];
      const color = isDark ? foreground : background;
      const offset = rowStart + 1 + x * 4;
      raw[offset] = color[0];
      raw[offset + 1] = color[1];
      raw[offset + 2] = color[2];
      raw[offset + 3] = color[3];
    }
  }

  return raw;
}

function createIhdr(width, height) {
  const data = new Uint8Array(13);
  writeUint32(data, 0, width);
  writeUint32(data, 4, height);
  data[8] = 8;
  data[9] = 6;
  data[10] = 0;
  data[11] = 0;
  data[12] = 0;
  return data;
}

function createChunk(type, data) {
  const typeBytes = asciiBytes(type);
  const chunk = new Uint8Array(12 + data.length);
  writeUint32(chunk, 0, data.length);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);
  writeUint32(chunk, 8 + data.length, crc32(concatBytes([typeBytes, data])));
  return chunk;
}

function createZlibStoredStream(data) {
  const chunks = [];
  chunks.push(Uint8Array.from([0x78, 0x01]));

  for (let offset = 0; offset < data.length; offset += 0xFFFF) {
    const length = Math.min(0xFFFF, data.length - offset);
    const isFinal = offset + length >= data.length;
    const block = new Uint8Array(5 + length);
    block[0] = isFinal ? 0x01 : 0x00;
    block[1] = length & 0xFF;
    block[2] = (length >>> 8) & 0xFF;
    const inverse = length ^ 0xFFFF;
    block[3] = inverse & 0xFF;
    block[4] = (inverse >>> 8) & 0xFF;
    block.set(data.subarray(offset, offset + length), 5);
    chunks.push(block);
  }

  const checksum = new Uint8Array(4);
  writeUint32(checksum, 0, adler32(data));
  chunks.push(checksum);
  return concatBytes(chunks);
}

function asciiBytes(text) {
  return Uint8Array.from(Array.from(text, (character) => character.charCodeAt(0)));
}

function concatBytes(parts) {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function writeUint32(target, offset, value) {
  target[offset] = (value >>> 24) & 0xFF;
  target[offset + 1] = (value >>> 16) & 0xFF;
  target[offset + 2] = (value >>> 8) & 0xFF;
  target[offset + 3] = value & 0xFF;
}

function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function createCrcTable() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let j = 0; j < 8; j += 1) {
      value = (value & 1) !== 0 ? 0xEDB88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
}

function adler32(bytes) {
  let a = 1;
  let b = 0;
  for (const byte of bytes) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}
