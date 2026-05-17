import { InvalidModeError } from "../errors.js";

let kanjiModeMap = null;
let decoderAvailable = true;
const SHIFT_JIS_TRAIL_BYTES = createShiftJisTrailBytes();

export function canEncodeKanjiModeCharacter(character) {
  if (character.length === 0 || character.charCodeAt(0) < 0x80) {
    return false;
  }
  return getKanjiModeMap().has(character);
}

export function assertKanjiModeText(text) {
  for (const character of Array.from(text)) {
    if (!canEncodeKanjiModeCharacter(character)) {
      throw new InvalidModeError(`kanji mode cannot encode character: ${character}`);
    }
  }
}

export function getKanjiModeValue(character) {
  const code = getKanjiModeMap().get(character);
  if (code === undefined) {
    throw new InvalidModeError(`kanji mode cannot encode character: ${character}`);
  }

  const adjusted = code <= 0x9FFC ? code - 0x8140 : code - 0xC140;
  return ((adjusted >>> 8) * 0xC0) + (adjusted & 0xFF);
}

export function getKanjiModeByteCount(text) {
  assertKanjiModeText(text);
  return Array.from(text).length * 2;
}

function getKanjiModeMap() {
  if (kanjiModeMap) {
    return kanjiModeMap;
  }

  const decoder = createShiftJisDecoder();
  if (!decoder) {
    return new Map();
  }

  kanjiModeMap = new Map();
  addRange(kanjiModeMap, decoder, 0x81, 0x9F);
  addRange(kanjiModeMap, decoder, 0xE0, 0xEB);
  return kanjiModeMap;
}

function createShiftJisDecoder() {
  if (!decoderAvailable || typeof TextDecoder !== "function") {
    return null;
  }

  try {
    return new TextDecoder("shift_jis", { fatal: true });
  } catch {
    decoderAvailable = false;
    return null;
  }
}

function addRange(map, decoder, leadStart, leadEnd) {
  for (let lead = leadStart; lead <= leadEnd; lead += 1) {
    for (const trail of SHIFT_JIS_TRAIL_BYTES) {
      const code = (lead << 8) | trail;
      const character = decodeCharacter(decoder, lead, trail);
      if (character && !map.has(character)) {
        map.set(character, code);
      }
    }
  }
}

function decodeCharacter(decoder, lead, trail) {
  try {
    const decoded = decoder.decode(Uint8Array.from([lead, trail]));
    const characters = Array.from(decoded);
    return characters.length === 1 && characters[0] !== "\uFFFD" ? characters[0] : null;
  } catch {
    return null;
  }
}

function createShiftJisTrailBytes() {
  const bytes = [];
  for (let value = 0x40; value <= 0x7E; value += 1) {
    bytes.push(value);
  }
  for (let value = 0x80; value <= 0xFC; value += 1) {
    bytes.push(value);
  }
  return bytes;
}
