import { InvalidGs1Error } from "../errors.js";
import { getGs1AiDictionaryEntry } from "./ai-dictionary.js";
import { GS1_FNC1_SEPARATOR, normalizeGs1Element } from "./ai.js";

const AI_LENGTHS = [4, 3, 2];

export function parseGs1ElementString(input) {
  assertRawElementString(input);

  const elements = [];
  let position = 0;

  while (position < input.length) {
    if (input[position] === GS1_FNC1_SEPARATOR) {
      throw new InvalidGs1Error(`GS1 element string has an unexpected FNC1 separator at offset ${position}`);
    }

    const ai = readSupportedAi(input, position);
    if (!ai) {
      throw new InvalidGs1Error(`Unsupported GS1 AI at offset ${position}`);
    }

    const metadata = getGs1AiDictionaryEntry(ai);
    const valueStart = position + ai.length;
    const valueEnd = getValueEnd(input, valueStart, metadata);
    const value = input.slice(valueStart, valueEnd);

    if (metadata.lengthType === "variable" && valueEnd === input.length) {
      assertFinalVariableValueIsUnambiguous(value, valueStart);
    }

    const normalized = normalizeGs1Element({ ai, value }, elements.length);
    elements.push({ ai: normalized.ai, value: normalized.value });

    position = valueEnd;
    if (input[position] === GS1_FNC1_SEPARATOR && metadata.lengthType === "variable") {
      position += 1;
      if (position >= input.length) {
        throw new InvalidGs1Error("GS1 element string must not end with an FNC1 separator");
      }
    }
  }

  return elements;
}

export function validateGs1ElementString(input) {
  parseGs1ElementString(input);
  return true;
}

function assertRawElementString(input) {
  if (typeof input !== "string") {
    throw new InvalidGs1Error("GS1 element string input must be a string");
  }
  if (input.length === 0) {
    throw new InvalidGs1Error("GS1 element string input must not be empty");
  }
  if (/[()]/u.test(input)) {
    throw new InvalidGs1Error("GS1 element string input must be raw data without human-readable parentheses");
  }
}

function getValueEnd(input, valueStart, metadata) {
  if (metadata.lengthType === "fixed") {
    return Math.min(input.length, valueStart + metadata.exactLength);
  }

  const separatorIndex = input.indexOf(GS1_FNC1_SEPARATOR, valueStart);
  return separatorIndex === -1 ? input.length : separatorIndex;
}

function readSupportedAi(input, position) {
  for (const length of AI_LENGTHS) {
    const ai = input.slice(position, position + length);
    if (ai.length === length && getGs1AiDictionaryEntry(ai)) {
      return ai;
    }
  }
  return null;
}

function assertFinalVariableValueIsUnambiguous(value, absoluteValueStart) {
  const separatorOffset = findLikelyMissingSeparatorOffset(value);
  if (separatorOffset !== -1) {
    throw new InvalidGs1Error(
      `GS1 variable-length element at offset ${absoluteValueStart} is missing an FNC1 separator before offset ${absoluteValueStart + separatorOffset}`
    );
  }
}

function findLikelyMissingSeparatorOffset(value) {
  for (let offset = 1; offset < value.length; offset += 1) {
    if (canParseCompleteFixedElement(value, offset)) {
      return offset;
    }
  }
  return -1;
}

function canParseCompleteFixedElement(value, offset) {
  const ai = readSupportedAi(value, offset);
  if (!ai) {
    return false;
  }

  const metadata = getGs1AiDictionaryEntry(ai);
  return metadata.lengthType === "fixed" && offset + ai.length + metadata.exactLength === value.length;
}
