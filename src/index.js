import {
  appendGtinCheckDigit,
  appendSsccCheckDigit,
  calculateGs1CheckDigit,
  calculateGtinCheckDigit,
  calculateSsccCheckDigit,
  createGs1DigitalLink,
  createGs1ElementString,
  getGs1AiInfo,
  getSupportedGs1Ais,
  GS1_FNC1_SEPARATOR,
  normalizeGs1DigitalLink,
  parseGs1DigitalLink,
  parseGs1HumanReadable,
  validateGs1CheckDigit,
  validateGs1DigitalLink,
  validateGs1Elements,
  validateGs1ElementString,
  validateGtinCheckDigit,
  validateSsccCheckDigit
} from "./gs1.js";
import {
  analyzeSegments,
  drawToCanvas,
  estimate,
  generate,
  generateSegments,
  parseGs1ElementString
} from "./internal/generation.js";
import { getCapacity } from "./internal/planning.js";
import {
  calculateStructuredAppendSegmentsParity,
  generateSegmentsStructuredAppend,
  generateStructuredAppend
} from "./internal/structured-append.js";
import {
  calculateStructuredAppendParity,
  mergeStructuredAppendParts
} from "./structured-append.js";

export {
  analyzeSegments,
  appendGtinCheckDigit,
  appendSsccCheckDigit,
  calculateGs1CheckDigit,
  calculateGtinCheckDigit,
  calculateSsccCheckDigit,
  calculateStructuredAppendParity,
  calculateStructuredAppendSegmentsParity,
  createGs1DigitalLink,
  createGs1ElementString,
  drawToCanvas,
  estimate,
  generate,
  generateSegments,
  generateSegmentsStructuredAppend,
  generateStructuredAppend,
  getCapacity,
  getGs1AiInfo,
  getSupportedGs1Ais,
  GS1_FNC1_SEPARATOR,
  mergeStructuredAppendParts,
  normalizeGs1DigitalLink,
  parseGs1DigitalLink,
  parseGs1ElementString,
  parseGs1HumanReadable,
  validateGs1CheckDigit,
  validateGs1DigitalLink,
  validateGs1Elements,
  validateGs1ElementString,
  validateGtinCheckDigit,
  validateSsccCheckDigit
};

export {
  DataTooLongError,
  InvalidCanvasTargetError,
  InvalidColorError,
  InvalidEciError,
  InvalidGs1Error,
  InvalidInputError,
  InvalidModeError,
  InvalidOutputError,
  InvalidVersionError,
  SpecQRError
} from "./errors.js";

export class QRCode {
  static generate(input, options = {}) {
    return generate(input, options);
  }

  static estimate(input, options = {}) {
    return estimate(input, options);
  }

  static analyzeSegments(segments, options = {}) {
    return analyzeSegments(segments, options);
  }

  static getCapacity(options) {
    return getCapacity(options);
  }

  static generateStructuredAppend(input, options = {}) {
    return generateStructuredAppend(input, options);
  }

  static generateSegmentsStructuredAppend(segments, options = {}) {
    return generateSegmentsStructuredAppend(segments, options);
  }

  static calculateStructuredAppendParity(input) {
    return calculateStructuredAppendParity(input);
  }

  static calculateStructuredAppendSegmentsParity(segments, options = {}) {
    return calculateStructuredAppendSegmentsParity(segments, options);
  }

  static mergeStructuredAppendParts(parts, options = {}) {
    return mergeStructuredAppendParts(parts, options);
  }

  static generateSegments(segments, options = {}) {
    return generateSegments(segments, options);
  }

  static drawToCanvas(target, input, options = {}) {
    return drawToCanvas(target, input, options);
  }

  static createGs1ElementString(elements) {
    return createGs1ElementString(elements);
  }

  static createGs1DigitalLink(input, options) {
    return createGs1DigitalLink(input, options);
  }

  static parseGs1DigitalLink(uri, options) {
    return parseGs1DigitalLink(uri, options);
  }

  static validateGs1DigitalLink(uri, options = undefined) {
    return validateGs1DigitalLink(uri, options);
  }

  static normalizeGs1DigitalLink(uri, options = {}) {
    return normalizeGs1DigitalLink(uri, options);
  }

  static parseGs1HumanReadable(input) {
    return parseGs1HumanReadable(input);
  }

  static parseGs1ElementString(input) {
    return parseGs1ElementString(input);
  }

  static getSupportedGs1Ais() {
    return getSupportedGs1Ais();
  }

  static getGs1AiInfo(ai) {
    return getGs1AiInfo(ai);
  }

  static validateGs1Elements(elements, options = undefined) {
    return validateGs1Elements(elements, options);
  }

  static validateGs1ElementString(input, options = undefined) {
    return validateGs1ElementString(input, options);
  }

  static calculateGs1CheckDigit(digits) {
    return calculateGs1CheckDigit(digits);
  }

  static validateGs1CheckDigit(digitsWithCheckDigit) {
    return validateGs1CheckDigit(digitsWithCheckDigit);
  }

  static calculateGtinCheckDigit(gtinWithoutCheckDigit) {
    return calculateGtinCheckDigit(gtinWithoutCheckDigit);
  }

  static appendGtinCheckDigit(gtinWithoutCheckDigit) {
    return appendGtinCheckDigit(gtinWithoutCheckDigit);
  }

  static validateGtinCheckDigit(gtin) {
    return validateGtinCheckDigit(gtin);
  }

  static calculateSsccCheckDigit(ssccWithoutCheckDigit) {
    return calculateSsccCheckDigit(ssccWithoutCheckDigit);
  }

  static appendSsccCheckDigit(ssccWithoutCheckDigit) {
    return appendSsccCheckDigit(ssccWithoutCheckDigit);
  }

  static validateSsccCheckDigit(sscc) {
    return validateSsccCheckDigit(sscc);
  }
}
