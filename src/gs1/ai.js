import { InvalidGs1Error } from "../errors.js";
import { getGs1AiSpec } from "./ai-dictionary.js";
import { validateGtinCheckDigit, validateSsccCheckDigit } from "./check-digit.js";

export const GS1_FNC1_SEPARATOR = "\x1D";

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

  const spec = getGs1AiSpec(ai);
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
