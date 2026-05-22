import { InvalidGs1Error } from "../errors.js";

const GTIN_BODY_LENGTHS = new Set([7, 11, 12, 13]);
const GTIN_FULL_LENGTHS = new Set([8, 12, 13, 14]);

export function calculateGs1CheckDigit(digits) {
  const body = normalizeNumericString(digits, "GS1 check digit input");
  if (body.length === 0) {
    throw new InvalidGs1Error("GS1 check digit input must not be empty");
  }

  let sum = 0;
  for (let index = body.length - 1, position = 1; index >= 0; index -= 1, position += 1) {
    sum += Number(body[index]) * (position % 2 === 1 ? 3 : 1);
  }

  return String((10 - (sum % 10)) % 10);
}

export function validateGs1CheckDigit(digitsWithCheckDigit) {
  const value = normalizeNumericString(digitsWithCheckDigit, "GS1 check digit value");
  if (value.length < 2) {
    throw new InvalidGs1Error("GS1 check digit value must include body digits and one check digit");
  }

  return calculateGs1CheckDigit(value.slice(0, -1)) === value.at(-1);
}

export function calculateGtinCheckDigit(gtinWithoutCheckDigit) {
  const body = normalizeNumericString(gtinWithoutCheckDigit, "GTIN body");
  assertLengthSet(body, GTIN_BODY_LENGTHS, "GTIN body", "7, 11, 12, or 13 digits");
  return calculateGs1CheckDigit(body);
}

export function appendGtinCheckDigit(gtinWithoutCheckDigit) {
  const body = normalizeNumericString(gtinWithoutCheckDigit, "GTIN body");
  return `${body}${calculateGtinCheckDigit(body)}`;
}

export function validateGtinCheckDigit(gtin) {
  const value = normalizeNumericString(gtin, "GTIN");
  assertLengthSet(value, GTIN_FULL_LENGTHS, "GTIN", "8, 12, 13, or 14 digits");
  return validateGs1CheckDigit(value);
}

export function calculateSsccCheckDigit(ssccWithoutCheckDigit) {
  const body = normalizeNumericString(ssccWithoutCheckDigit, "SSCC body");
  assertLength(body, 17, "SSCC body");
  return calculateGs1CheckDigit(body);
}

export function appendSsccCheckDigit(ssccWithoutCheckDigit) {
  const body = normalizeNumericString(ssccWithoutCheckDigit, "SSCC body");
  return `${body}${calculateSsccCheckDigit(body)}`;
}

export function validateSsccCheckDigit(sscc) {
  const value = normalizeNumericString(sscc, "SSCC");
  assertLength(value, 18, "SSCC");
  return validateGs1CheckDigit(value);
}

function normalizeNumericString(value, label) {
  if (typeof value !== "string") {
    throw new InvalidGs1Error(`${label} must be a string to preserve leading zeroes`);
  }
  if (!/^\d+$/u.test(value)) {
    throw new InvalidGs1Error(`${label} must contain digits only`);
  }
  return value;
}

function assertLength(value, expected, label) {
  if (value.length !== expected) {
    throw new InvalidGs1Error(`${label} must be exactly ${expected} digits`);
  }
}

function assertLengthSet(value, allowedLengths, label, expectedDescription) {
  if (!allowedLengths.has(value.length)) {
    throw new InvalidGs1Error(`${label} must be ${expectedDescription}`);
  }
}
