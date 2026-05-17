import { InvalidGs1Error } from "./errors.js";

export const GS1_FNC1_SEPARATOR = "\x1D";

const FIXED_LENGTH_AIS = new Map([
  ["00", { length: 18, content: "numeric" }],
  ["01", { length: 14, content: "numeric" }],
  ["02", { length: 14, content: "numeric" }],
  ["11", { length: 6, content: "numeric" }],
  ["12", { length: 6, content: "numeric" }],
  ["13", { length: 6, content: "numeric" }],
  ["15", { length: 6, content: "numeric" }],
  ["16", { length: 6, content: "numeric" }],
  ["17", { length: 6, content: "numeric" }],
  ["20", { length: 2, content: "numeric" }],
  ["410", { length: 13, content: "numeric" }],
  ["411", { length: 13, content: "numeric" }],
  ["412", { length: 13, content: "numeric" }],
  ["413", { length: 13, content: "numeric" }],
  ["414", { length: 13, content: "numeric" }],
  ["415", { length: 13, content: "numeric" }]
]);

const VARIABLE_LENGTH_AIS = new Map([
  ["10", { maxLength: 20, content: "text" }],
  ["21", { maxLength: 20, content: "text" }],
  ["22", { maxLength: 20, content: "text" }],
  ["30", { maxLength: 8, content: "numeric" }],
  ["37", { maxLength: 8, content: "numeric" }],
  ["240", { maxLength: 30, content: "text" }],
  ["241", { maxLength: 30, content: "text" }],
  ["400", { maxLength: 30, content: "text" }],
  ["420", { maxLength: 20, content: "text" }]
]);

export function parseGs1HumanReadable(input) {
  if (typeof input !== "string") {
    throw new InvalidGs1Error("GS1 human-readable input must be a string");
  }
  if (input.length === 0) {
    throw new InvalidGs1Error("GS1 human-readable input must not be empty");
  }

  const elements = [];
  let position = 0;

  while (position < input.length) {
    if (input[position] !== "(") {
      throw new InvalidGs1Error(
        `GS1 human-readable input must contain an AI in parentheses at offset ${position}`
      );
    }

    const close = input.indexOf(")", position + 1);
    if (close === -1) {
      throw new InvalidGs1Error(`GS1 AI starting at offset ${position} is missing a closing parenthesis`);
    }

    const ai = input.slice(position + 1, close);
    const valueStart = close + 1;
    const nextAiStart = input.indexOf("(", valueStart);
    const valueEnd = nextAiStart === -1 ? input.length : nextAiStart;
    const value = input.slice(valueStart, valueEnd);
    const normalized = normalizeGs1Element({ ai, value }, elements.length);

    elements.push({ ai: normalized.ai, value: normalized.value });
    position = valueEnd;
  }

  return elements;
}

export function createGs1ElementString(elements) {
  if (!Array.isArray(elements)) {
    throw new InvalidGs1Error("GS1 elements must be an array of { ai, value } objects");
  }
  if (elements.length === 0) {
    throw new InvalidGs1Error("GS1 elements must not be empty");
  }

  return elements
    .map((element, index) => {
      const normalized = normalizeGs1Element(element, index);
      const needsSeparator = normalized.spec.variable && index < elements.length - 1;
      return `${normalized.ai}${normalized.value}${needsSeparator ? GS1_FNC1_SEPARATOR : ""}`;
    })
    .join("");
}

function normalizeGs1Element(element, index) {
  if (!element || typeof element !== "object") {
    throw new InvalidGs1Error(`GS1 element ${index} must be an object`);
  }

  if (typeof element.ai !== "string") {
    throw new InvalidGs1Error(`GS1 element ${index} AI must be a string`);
  }
  if (typeof element.value !== "string") {
    throw new InvalidGs1Error(`GS1 element ${index} value must be a string to preserve leading zeroes`);
  }

  const ai = element.ai;
  const value = element.value;
  validateAi(ai, index);

  const spec = getAiSpec(ai);
  if (!spec) {
    throw new InvalidGs1Error(`Unsupported GS1 AI ${ai}. Add explicit support before using it.`);
  }

  validateValue(ai, value, spec);
  return { ai, value, spec };
}

function validateAi(ai, index) {
  if (!/^\d{2,4}$/.test(ai)) {
    throw new InvalidGs1Error(`GS1 element ${index} has invalid AI ${JSON.stringify(ai)}; expected 2 to 4 digits`);
  }
}

function getAiSpec(ai) {
  const fixed = FIXED_LENGTH_AIS.get(ai);
  if (fixed) {
    return { ...fixed, variable: false };
  }

  const variable = VARIABLE_LENGTH_AIS.get(ai);
  if (variable) {
    return { ...variable, variable: true };
  }

  if (/^310[0-5]$/.test(ai) || /^320[0-5]$/.test(ai)) {
    return { length: 6, content: "numeric", variable: false };
  }

  if (/^9[1-9]$/.test(ai)) {
    return { maxLength: 90, content: "text", variable: true };
  }

  return null;
}

function validateValue(ai, value, spec) {
  if (value.length === 0) {
    throw new InvalidGs1Error(`GS1 AI ${ai} value must not be empty`);
  }
  if (value.includes(GS1_FNC1_SEPARATOR)) {
    throw new InvalidGs1Error(`GS1 AI ${ai} value must not contain the FNC1 separator`);
  }
  if (/[()]/u.test(value)) {
    throw new InvalidGs1Error(`GS1 AI ${ai} value must be raw data without human-readable parentheses`);
  }
  if (!/^[\x20-\x7E]+$/u.test(value)) {
    throw new InvalidGs1Error(`GS1 AI ${ai} value must use printable ASCII characters`);
  }
  if (spec.content === "numeric" && !/^\d+$/u.test(value)) {
    throw new InvalidGs1Error(`GS1 AI ${ai} value must contain digits only`);
  }

  if (spec.variable) {
    if (value.length > spec.maxLength) {
      throw new InvalidGs1Error(`GS1 AI ${ai} value must be at most ${spec.maxLength} characters`);
    }
  } else if (value.length !== spec.length) {
    throw new InvalidGs1Error(`GS1 AI ${ai} value must be exactly ${spec.length} characters`);
  }
}
