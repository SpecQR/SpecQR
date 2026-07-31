import { normalizeManualSegments } from "../encoding/modes.js";
import { GS1_FNC1_SEPARATOR } from "../gs1.js";
import { parseGs1ElementString as parseRawGs1ElementString } from "../gs1/validator.js";
import { normalizeOptions } from "../options.js";
import { renderCanvas } from "../render/canvas.js";
import {
  estimateWithDataTooLongResult,
  validatePlanningColors
} from "./diagnostics-adapter.js";
import {
  getInputByteCount,
  getSegmentsInputByteCount,
  selectPlanForInput,
  selectPlanForManualSegments
} from "./planning.js";
import { renderResult } from "./render-result.js";

export function generate(input, options = {}) {
  const normalized = normalizeOptions(options);
  const plan = selectPlanForInput(input, normalized);
  return renderResult(plan, normalized, getInputByteCount(input));
}

export function estimate(input, options = {}) {
  const normalized = normalizeOptions(options);
  validatePlanningColors(normalized);
  return estimateWithDataTooLongResult(
    () => selectPlanForInput(input, normalized),
    () => selectPlanForInput(input, normalized, { allowOverflow: true }),
    normalized,
    getInputByteCount(input)
  );
}

export function generateSegments(segments, options = {}) {
  const normalized = normalizeOptions(options);
  const normalizedSegments = normalizeManualSegments(segments);
  const plan = selectPlanForManualSegments(normalizedSegments, normalized);
  return renderResult(plan, normalized, getSegmentsInputByteCount(normalizedSegments));
}

export function analyzeSegments(segments, options = {}) {
  const normalized = normalizeOptions(options);
  validatePlanningColors(normalized);
  const normalizedSegments = normalizeManualSegments(segments);
  return estimateWithDataTooLongResult(
    () => selectPlanForManualSegments(normalizedSegments, normalized),
    () => selectPlanForManualSegments(normalizedSegments, normalized, { allowOverflow: true }),
    normalized,
    getSegmentsInputByteCount(normalizedSegments)
  );
}

export function drawToCanvas(target, input, options = {}) {
  const normalized = normalizeOptions({
    ...options,
    output: "matrix",
    diagnostics: false
  });
  const matrix = generate(input, {
    ...normalized,
    output: "matrix",
    diagnostics: false
  });

  return renderCanvas(target, matrix, normalized);
}

export function parseGs1ElementString(input) {
  const elements = parseRawGs1ElementString(input);
  return {
    elements,
    hasSeparators: input.includes(GS1_FNC1_SEPARATOR)
  };
}
