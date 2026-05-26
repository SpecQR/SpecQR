import { InvalidGs1Error } from "../errors.js";
import { GS1_FNC1_SEPARATOR, normalizeGs1Element } from "./ai.js";
import { getGs1AiDictionaryEntry } from "./ai-dictionary.js";
import { parseGs1ElementString as parseRawGs1ElementString } from "./validator.js";

const DEFAULT_CONTEXT = "element-string";
const VALID_CONTEXTS = new Set(["element-string", "digital-link"]);

export function validateGs1Elements(elements, options = undefined) {
  const normalizedOptions = normalizeValidationOptions(options);
  if (!normalizedOptions.ok) {
    return validationFailure([normalizedOptions.error]);
  }

  if (!Array.isArray(elements)) {
    return validationFailure([
      createValidationError("GS1_INVALID_INPUT", "GS1 elements must be an array of { ai, value } objects", {
        reason: "invalid-input"
      })
    ]);
  }
  if (elements.length === 0) {
    return validationFailure([
      createValidationError("GS1_INVALID_INPUT", "GS1 elements must not be empty", {
        reason: "invalid-input"
      })
    ]);
  }

  const normalizedElements = [];
  const errors = [];
  for (let index = 0; index < elements.length; index += 1) {
    try {
      const normalized = normalizeGs1Element(elements[index], index);
      normalizedElements.push({ ai: normalized.ai, value: normalized.value });
    } catch (error) {
      errors.push(toGs1ValidationError(error, { element: elements[index], elementIndex: index }));
      if (!normalizedOptions.collectAllErrors) {
        break;
      }
    }
  }

  if (errors.length > 0) {
    return validationFailure(errors);
  }

  const contextErrors = getContextValidationErrors(normalizedElements, normalizedOptions.context);
  if (contextErrors.length > 0) {
    return validationFailure(contextErrors);
  }

  return {
    ok: true,
    elements: normalizedElements,
    warnings: []
  };
}

export function validateGs1ElementString(input, options = undefined) {
  const normalizedOptions = normalizeValidationOptions(options);
  if (!normalizedOptions.ok) {
    return validationFailure([normalizedOptions.error]);
  }

  try {
    const elements = parseRawGs1ElementString(input);
    return {
      ok: true,
      elements,
      hasSeparators: input.includes(GS1_FNC1_SEPARATOR),
      warnings: []
    };
  } catch (error) {
    return validationFailure([toGs1ValidationError(error, { input })]);
  }
}

function normalizeValidationOptions(options) {
  if (options === undefined) {
    return { ok: true, context: DEFAULT_CONTEXT, collectAllErrors: true };
  }
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    return {
      ok: false,
      error: createValidationError("GS1_INVALID_INPUT", "GS1 validation options must be an object", {
        reason: "invalid-options"
      })
    };
  }

  const context = options.context ?? DEFAULT_CONTEXT;
  if (!VALID_CONTEXTS.has(context)) {
    return {
      ok: false,
      error: createValidationError(
        "GS1_INVALID_INPUT",
        "GS1 validation options.context must be \"element-string\" or \"digital-link\"",
        { reason: "invalid-options", expected: "element-string or digital-link" }
      )
    };
  }
  if ("allowUnsupportedAi" in options && options.allowUnsupportedAi !== false) {
    return {
      ok: false,
      error: createValidationError("GS1_INVALID_INPUT", "GS1 validation options.allowUnsupportedAi must be false", {
        reason: "invalid-options",
        expected: false
      })
    };
  }

  return {
    ok: true,
    context,
    collectAllErrors: options.collectAllErrors !== false
  };
}

function getContextValidationErrors(elements, context) {
  if (context !== "digital-link") {
    return [];
  }

  const hasPrimary = elements.some((element) => getGs1AiDictionaryEntry(element.ai)?.digitalLinkRole === "primary-key");
  return hasPrimary
    ? []
    : [
        createValidationError(
          "GS1_INVALID_DIGITAL_LINK_PLACEMENT",
          "GS1 Digital Link elements must include a primary AI 00, 01, or 414",
          {
            reason: "invalid-digital-link-placement",
            expected: "primary AI 00, 01, or 414"
          }
        )
      ];
}

function validationFailure(errors) {
  return {
    ok: false,
    errors,
    warnings: []
  };
}

export function toGs1ValidationError(error, context = {}) {
  if (!(error instanceof InvalidGs1Error)) {
    return createValidationError("GS1_INVALID_INPUT", getErrorMessage(error), { reason: "invalid-input" });
  }

  const message = error.message;
  const base = extractCommonFields(message, context);

  if (/Unsupported GS1 AI/u.test(message)) {
    return createValidationError("GS1_UNSUPPORTED_AI", message, {
      ...base,
      reason: "unsupported-ai",
      expected: "supported GS1 AI"
    });
  }
  if (/exactly \d+ characters|at most \d+ characters/u.test(message)) {
    return createValidationError("GS1_INVALID_LENGTH", message, {
      ...base,
      reason: "invalid-length",
      expected: getLengthExpectation(message)
    });
  }
  if (/digits only|printable ASCII/u.test(message)) {
    return createValidationError("GS1_INVALID_CHARSET", message, {
      ...base,
      reason: "invalid-charset",
      expected: message.includes("digits only") ? "digits only" : "printable ASCII"
    });
  }
  if (/missing an FNC1 separator/u.test(message)) {
    return createValidationError("GS1_MISSING_SEPARATOR", message, {
      ...base,
      reason: "missing-separator",
      expected: "FNC1 separator before the next GS1 element"
    });
  }
  if (/unexpected FNC1 separator|must not end with an FNC1 separator|must not contain the FNC1 separator/u.test(message)) {
    return createValidationError("GS1_UNEXPECTED_SEPARATOR", message, {
      ...base,
      reason: "unexpected-separator",
      expected: "separator only after a non-final variable-length GS1 element"
    });
  }
  if (/invalid GTIN check digit|invalid SSCC check digit/u.test(message)) {
    return createValidationError("GS1_INVALID_CHECK_DIGIT", message, {
      ...base,
      reason: "invalid-check-digit",
      expected: message.includes("SSCC") ? "valid SSCC check digit" : "valid GTIN check digit"
    });
  }
  if (/cannot be placed in the Digital Link path/u.test(message)) {
    return createValidationError("GS1_INVALID_DIGITAL_LINK_PLACEMENT", message, {
      ...base,
      reason: "invalid-digital-link-placement"
    });
  }
  if (/duplicate AI \d{2,4}/u.test(message)) {
    return createValidationError("GS1_DUPLICATE_AI", message, {
      ...base,
      reason: "duplicate-ai",
      expected: "unique GS1 AI within the Digital Link URI"
    });
  }

  return createValidationError("GS1_INVALID_INPUT", message, { ...base, reason: "invalid-input" });
}

function extractCommonFields(message, context) {
  const fields = {};
  const ai = extractAi(message) ?? extractAiFromInputOffset(context.input, message) ??
    extractAiBeforeValueOffset(context.input, message);
  const offset = extractOffset(message);
  const elementIndex = extractElementIndex(message) ?? context.elementIndex;
  const value = context.element && typeof context.element.value === "string" ? context.element.value : undefined;

  if (ai !== undefined) {
    fields.ai = ai;
  }
  if (value !== undefined) {
    fields.value = value;
  }
  if (offset !== undefined) {
    fields.offset = offset;
  }
  if (elementIndex !== undefined) {
    fields.elementIndex = elementIndex;
  }
  return fields;
}

export function createValidationError(code, message, details = {}) {
  const error = { code, message };
  for (const [key, value] of Object.entries(details)) {
    if (value !== undefined) {
      error[key] = value;
    }
  }
  return error;
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function extractAi(message) {
  return message.match(/GS1 AI (\d{2,4})/u)?.[1] ??
    message.match(/Unsupported GS1 AI (\d{2,4})/u)?.[1] ??
    message.match(/duplicate AI (\d{2,4})/u)?.[1];
}

function extractAiFromInputOffset(input, message) {
  if (typeof input !== "string") {
    return undefined;
  }
  const offset = extractOffset(message);
  if (offset === undefined) {
    return undefined;
  }
  return input.slice(offset).match(/^\d{2,4}/u)?.[0];
}

function extractAiBeforeValueOffset(input, message) {
  if (typeof input !== "string") {
    return undefined;
  }
  const offset = extractOffset(message);
  if (offset === undefined) {
    return undefined;
  }
  for (const length of [2, 3, 4]) {
    const start = offset - length;
    if (start < 0) {
      continue;
    }
    const ai = input.slice(start, offset);
    if (getGs1AiDictionaryEntry(ai)) {
      return ai;
    }
  }
  return undefined;
}

function extractOffset(message) {
  const match = message.match(/offset (\d+)/u);
  return match ? Number(match[1]) : undefined;
}

function extractElementIndex(message) {
  const match = message.match(/GS1 element (\d+)/u);
  return match ? Number(match[1]) : undefined;
}

function getLengthExpectation(message) {
  return message.match(/(exactly \d+ characters|at most \d+ characters)/u)?.[1];
}
