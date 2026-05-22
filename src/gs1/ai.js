import { InvalidGs1Error } from "../errors.js";
import { validateGtinCheckDigit, validateSsccCheckDigit } from "./check-digit.js";

export const GS1_FNC1_SEPARATOR = "\x1D";

const FIXED_LENGTH_AIS = new Map([
  ["00", { length: 18, content: "numeric", checkDigit: "sscc" }],
  ["01", { length: 14, content: "numeric", checkDigit: "gtin" }],
  ["02", { length: 14, content: "numeric", checkDigit: "gtin" }],
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
  ["415", { length: 13, content: "numeric" }],
  ["422", { length: 3, content: "numeric" }],
  ["424", { length: 3, content: "numeric" }],
  ["425", { length: 3, content: "numeric" }],
  ["426", { length: 3, content: "numeric" }]
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

export function normalizeGs1Element(element, index) {
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

  if (spec.checkDigit === "gtin" && !validateGtinCheckDigit(value)) {
    throw new InvalidGs1Error(`GS1 AI ${ai} value has an invalid GTIN check digit`);
  }
  if (spec.checkDigit === "sscc" && !validateSsccCheckDigit(value)) {
    throw new InvalidGs1Error(`GS1 AI ${ai} value has an invalid SSCC check digit`);
  }
}
