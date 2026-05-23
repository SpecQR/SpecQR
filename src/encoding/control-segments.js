import { InvalidEciError, InvalidGs1Error, InvalidModeError } from "../errors.js";

export const CONTROL_SEGMENT_MODES = Object.freeze({
  ECI: "eci",
  FNC1_FIRST: "fnc1",
  FNC1_SECOND: "fnc1-second",
  STRUCTURED_APPEND: "structured-append"
});

const CONTROL_MODE_INDICATORS = {
  [CONTROL_SEGMENT_MODES.ECI]: 0b0111,
  [CONTROL_SEGMENT_MODES.FNC1_FIRST]: 0b0101,
  [CONTROL_SEGMENT_MODES.FNC1_SECOND]: 0b1001,
  [CONTROL_SEGMENT_MODES.STRUCTURED_APPEND]: 0b0011
};

export function applyControlSegments(
  segments,
  {
    eciAssignmentNumber = false,
    fnc1First = false,
    fnc1Second = false,
    structuredAppend = false
  } = {}
) {
  if (eciAssignmentNumber === false && !fnc1First && fnc1Second === false && structuredAppend === false) {
    return segments;
  }

  const existing = inspectControlSegments(segments);
  const controls = [];

  if (structuredAppend !== false) {
    if (existing.structuredAppend.length > 0) {
      throw new InvalidModeError("structuredAppend option cannot be combined with a manual structured-append segment");
    }
    assertStructuredAppendCanStandAlone(existing, eciAssignmentNumber, fnc1First, fnc1Second);
    controls.push(createStructuredAppendSegment(structuredAppend));
  }

  if (fnc1First) {
    if (existing.structuredAppend.length > 0 || structuredAppend !== false) {
      throw new InvalidGs1Error("FNC1 first position cannot be combined with Structured Append in this implementation");
    }
    if (existing.fnc1First.length > 0) {
      throw new InvalidGs1Error("gs1 option cannot be combined with a manual fnc1 segment");
    }
    if (existing.fnc1Second.length > 0 || fnc1Second !== false) {
      throw new InvalidGs1Error("FNC1 first position cannot be combined with FNC1 second position");
    }
    if (existing.eci.length > 0 || eciAssignmentNumber !== false) {
      throw new InvalidGs1Error("gs1 and eci cannot be combined in this FNC1 first position implementation");
    }
    controls.push(createFnc1FirstSegment());
  }

  if (fnc1Second !== false) {
    if (existing.structuredAppend.length > 0 || structuredAppend !== false) {
      throw new InvalidModeError("FNC1 second position cannot be combined with Structured Append in this implementation");
    }
    if (existing.fnc1Second.length > 0) {
      throw new InvalidModeError("fnc1Second option cannot be combined with a manual fnc1-second segment");
    }
    if (existing.fnc1First.length > 0) {
      throw new InvalidGs1Error("FNC1 first position cannot be combined with FNC1 second position");
    }
    if (existing.eci.length > 0 || eciAssignmentNumber !== false) {
      throw new InvalidModeError("FNC1 second position cannot be combined with ECI in this implementation");
    }
    controls.push(createFnc1SecondSegment(fnc1Second));
  }

  if (eciAssignmentNumber !== false) {
    if (existing.structuredAppend.length > 0 || structuredAppend !== false) {
      throw new InvalidModeError("ECI cannot be combined with Structured Append in this implementation");
    }
    if (existing.fnc1First.length > 0) {
      throw new InvalidGs1Error("eci cannot be combined with FNC1 first position in this implementation");
    }
    if (existing.fnc1Second.length > 0) {
      throw new InvalidModeError("ECI cannot be combined with FNC1 second position in this implementation");
    }
    validateEciAssignmentNumber(eciAssignmentNumber);
    controls.push(createEciSegment(eciAssignmentNumber));
  }

  return [...controls, ...segments];
}

export function prependEciSegment(segments, eciAssignmentNumber = false) {
  return applyControlSegments(segments, { eciAssignmentNumber });
}

export function prependFnc1Segment(segments, enabled = false) {
  return applyControlSegments(segments, { fnc1First: enabled });
}

export function prependFnc1SecondSegment(segments, applicationIndicator = false) {
  return applyControlSegments(segments, { fnc1Second: applicationIndicator });
}

export function prependStructuredAppendSegment(segments, structuredAppend = false) {
  return applyControlSegments(segments, { structuredAppend });
}

export function validateManualControlSegments(segments) {
  const { fnc1First, fnc1Second, structuredAppend, eci } = inspectControlSegments(segments);

  if (fnc1First.length > 1) {
    throw new InvalidGs1Error("manual segments can include at most one fnc1 segment");
  }
  if (fnc1Second.length > 1) {
    throw new InvalidModeError("manual segments can include at most one fnc1-second segment");
  }
  if (structuredAppend.length > 1) {
    throw new InvalidModeError("manual segments can include at most one structured-append segment");
  }
  if (fnc1First.length === 1 && fnc1First[0] !== 0) {
    throw new InvalidGs1Error("manual fnc1 segment must be the first segment");
  }
  if (fnc1Second.length === 1 && fnc1Second[0] !== 0) {
    throw new InvalidModeError("manual fnc1-second segment must be the first segment");
  }
  if (structuredAppend.length === 1 && structuredAppend[0] !== 0) {
    throw new InvalidModeError("manual structured-append segment must be the first segment");
  }
  if (fnc1First.length === 1 && fnc1Second.length === 1) {
    throw new InvalidGs1Error("FNC1 first position cannot be combined with FNC1 second position");
  }
  if (structuredAppend.length === 1 && fnc1First.length === 1) {
    throw new InvalidGs1Error("Structured Append cannot be combined with FNC1 first position in this implementation");
  }
  if (structuredAppend.length === 1 && fnc1Second.length === 1) {
    throw new InvalidModeError("Structured Append cannot be combined with FNC1 second position in this implementation");
  }
  if (fnc1First.length === 1 && eci.length > 0) {
    throw new InvalidGs1Error("FNC1 first position cannot be combined with ECI in this implementation");
  }
  if (fnc1Second.length === 1 && eci.length > 0) {
    throw new InvalidModeError("FNC1 second position cannot be combined with ECI in this implementation");
  }
  if (structuredAppend.length === 1 && eci.length > 0) {
    throw new InvalidModeError("Structured Append cannot be combined with ECI in this implementation");
  }

  return segments;
}

export function isControlSegment(segment) {
  return segment?.mode === CONTROL_SEGMENT_MODES.ECI ||
    segment?.mode === CONTROL_SEGMENT_MODES.FNC1_FIRST ||
    segment?.mode === CONTROL_SEGMENT_MODES.FNC1_SECOND ||
    segment?.mode === CONTROL_SEGMENT_MODES.STRUCTURED_APPEND;
}

export function validateControlSegment(segment, label = "control segment") {
  if (segment.mode === CONTROL_SEGMENT_MODES.FNC1_FIRST) {
    validateFnc1FirstSegment(segment, label);
    return;
  }
  if (segment.mode === CONTROL_SEGMENT_MODES.ECI) {
    validateEciAssignmentNumber(segment.assignmentNumber);
    return;
  }
  if (segment.mode === CONTROL_SEGMENT_MODES.FNC1_SECOND) {
    validateFnc1SecondSegment(segment, label);
    return;
  }
  if (segment.mode === CONTROL_SEGMENT_MODES.STRUCTURED_APPEND) {
    validateStructuredAppendSegment(segment, label);
    return;
  }
  throw new InvalidModeError(`Unsupported control segment mode: ${segment.mode}`);
}

export function getControlSegmentBitLength(segment) {
  validateControlSegment(segment);
  if (segment.mode === CONTROL_SEGMENT_MODES.FNC1_FIRST) {
    return 4;
  }
  if (segment.mode === CONTROL_SEGMENT_MODES.FNC1_SECOND) {
    return 12;
  }
  if (segment.mode === CONTROL_SEGMENT_MODES.STRUCTURED_APPEND) {
    return 20;
  }
  return 4 + getEciDesignatorBitLength(segment.assignmentNumber);
}

export function appendControlSegmentBits(buffer, segment) {
  validateControlSegment(segment);
  buffer.append(CONTROL_MODE_INDICATORS[segment.mode], 4);
  if (segment.mode === CONTROL_SEGMENT_MODES.ECI) {
    appendEciDesignatorBits(buffer, segment.assignmentNumber);
  } else if (segment.mode === CONTROL_SEGMENT_MODES.FNC1_SECOND) {
    buffer.append(getFnc1SecondApplicationIndicatorCodeword(segment.applicationIndicator), 8);
  } else if (segment.mode === CONTROL_SEGMENT_MODES.STRUCTURED_APPEND) {
    const encoded = getStructuredAppendEncodedValues(segment);
    buffer.append(encoded.sequenceIndex, 4);
    buffer.append(encoded.sequenceTotal, 4);
    buffer.append(encoded.parity, 8);
  }
}

export function getFirstEciAssignmentNumber(segments) {
  return segments.find((segment) => segment.mode === CONTROL_SEGMENT_MODES.ECI)?.assignmentNumber ?? null;
}

export function getFirstFnc1Mode(segments) {
  if (segments.some((segment) => segment.mode === CONTROL_SEGMENT_MODES.FNC1_FIRST)) {
    return "first-position";
  }
  if (segments.some((segment) => segment.mode === CONTROL_SEGMENT_MODES.FNC1_SECOND)) {
    return "second-position";
  }
  return null;
}

export function getFirstFnc1SecondApplicationIndicator(segments) {
  return segments.find((segment) => segment.mode === CONTROL_SEGMENT_MODES.FNC1_SECOND)?.applicationIndicator ?? null;
}

export function getFirstFnc1SecondApplicationIndicatorCodeword(segments) {
  const applicationIndicator = getFirstFnc1SecondApplicationIndicator(segments);
  return applicationIndicator === null ? null : getFnc1SecondApplicationIndicatorCodeword(applicationIndicator);
}

export function getFirstStructuredAppend(segments) {
  const segment = segments.find((item) => item.mode === CONTROL_SEGMENT_MODES.STRUCTURED_APPEND);
  return segment ? normalizeStructuredAppend(segment) : null;
}

export function getFirstStructuredAppendEncodedValues(segments) {
  const structuredAppend = getFirstStructuredAppend(segments);
  return structuredAppend === null ? null : getStructuredAppendEncodedValues(structuredAppend);
}

export function getControlSegmentDiagnostics(segments) {
  return segments.filter(isControlSegment).map((segment) => {
    const diagnostics = { mode: segment.mode };
    if (segment.mode === CONTROL_SEGMENT_MODES.ECI) {
      diagnostics.assignmentNumber = segment.assignmentNumber;
    } else if (segment.mode === CONTROL_SEGMENT_MODES.FNC1_SECOND) {
      diagnostics.applicationIndicator = segment.applicationIndicator;
      diagnostics.applicationIndicatorCodeword = getFnc1SecondApplicationIndicatorCodeword(segment.applicationIndicator);
    } else if (segment.mode === CONTROL_SEGMENT_MODES.STRUCTURED_APPEND) {
      Object.assign(diagnostics, getStructuredAppendDiagnostics(segment));
    }
    return diagnostics;
  });
}

export function createEciSegment(assignmentNumber) {
  validateEciAssignmentNumber(assignmentNumber);
  return { mode: CONTROL_SEGMENT_MODES.ECI, assignmentNumber };
}

export function createFnc1FirstSegment() {
  return { mode: CONTROL_SEGMENT_MODES.FNC1_FIRST };
}

export function createFnc1SecondSegment(applicationIndicator) {
  return {
    mode: CONTROL_SEGMENT_MODES.FNC1_SECOND,
    applicationIndicator: validateFnc1SecondApplicationIndicator(applicationIndicator)
  };
}

export function createStructuredAppendSegment(value) {
  return {
    mode: CONTROL_SEGMENT_MODES.STRUCTURED_APPEND,
    ...normalizeStructuredAppend(value)
  };
}

export function validateEciAssignmentNumber(value) {
  if (!Number.isInteger(value) || value < 0 || value >= 1000000) {
    throw new InvalidEciError(`ECI assignment number must be an integer from 0 to 999999; got ${value}`);
  }
}

export function validateFnc1SecondApplicationIndicator(value, label = "FNC1 second applicationIndicator") {
  if (typeof value !== "string") {
    throw new InvalidModeError(`${label} must be a two-digit number or a single Latin alphabetic character; got ${typeof value}`);
  }
  if (/^\d{2}$/.test(value) || /^[A-Za-z]$/.test(value)) {
    return value;
  }
  throw new InvalidModeError(`${label} must be a two-digit number or a single Latin alphabetic character; got ${JSON.stringify(value)}`);
}

export function getFnc1SecondApplicationIndicatorCodeword(value) {
  const applicationIndicator = validateFnc1SecondApplicationIndicator(value);
  if (/^\d{2}$/.test(applicationIndicator)) {
    return Number(applicationIndicator);
  }
  return applicationIndicator.charCodeAt(0) + 100;
}

export function normalizeStructuredAppend(value, label = "structuredAppend") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new InvalidModeError(`${label} must be an object with index, total, and parity`);
  }

  const index = validateStructuredAppendInteger(value.index, `${label}.index`, 1, 16);
  const total = validateStructuredAppendInteger(value.total, `${label}.total`, 2, 16);
  const parity = validateStructuredAppendInteger(value.parity, `${label}.parity`, 0, 255);

  if (index > total) {
    throw new InvalidModeError(`${label}.index must be between 1 and total (${total}); got ${index}`);
  }

  return { index, total, parity };
}

export function getStructuredAppendEncodedValues(value) {
  const { index, total, parity } = normalizeStructuredAppend(value, "structuredAppend");
  return {
    sequenceIndex: index - 1,
    sequenceTotal: total - 1,
    sequenceIndicator: ((index - 1) << 4) | (total - 1),
    parity
  };
}

export function getStructuredAppendDiagnostics(value) {
  const structuredAppend = normalizeStructuredAppend(value, "structuredAppend");
  return {
    ...structuredAppend,
    ...getStructuredAppendEncodedValues(structuredAppend)
  };
}

function inspectControlSegments(segments) {
  const fnc1First = [];
  const fnc1Second = [];
  const structuredAppend = [];
  const eci = [];

  segments.forEach((segment, index) => {
    if (segment.mode === CONTROL_SEGMENT_MODES.FNC1_FIRST) {
      fnc1First.push(index);
    } else if (segment.mode === CONTROL_SEGMENT_MODES.FNC1_SECOND) {
      fnc1Second.push(index);
    } else if (segment.mode === CONTROL_SEGMENT_MODES.STRUCTURED_APPEND) {
      structuredAppend.push(index);
    } else if (segment.mode === CONTROL_SEGMENT_MODES.ECI) {
      eci.push(index);
    }
  });

  return { fnc1First, fnc1Second, structuredAppend, eci };
}

function validateFnc1FirstSegment(segment, label = "fnc1 segment") {
  if (
    Object.hasOwn(segment, "data") ||
    Object.hasOwn(segment, "text") ||
    Object.hasOwn(segment, "bytes") ||
    Object.hasOwn(segment, "assignmentNumber")
  ) {
    throw new InvalidGs1Error(`${label} must not include data, text, bytes, or assignmentNumber`);
  }
}

function validateFnc1SecondSegment(segment, label = "fnc1-second segment") {
  if (
    Object.hasOwn(segment, "data") ||
    Object.hasOwn(segment, "text") ||
    Object.hasOwn(segment, "bytes") ||
    Object.hasOwn(segment, "assignmentNumber")
  ) {
    throw new InvalidModeError(`${label} must not include data, text, bytes, or assignmentNumber`);
  }
  validateFnc1SecondApplicationIndicator(segment.applicationIndicator, `${label}.applicationIndicator`);
}

function validateStructuredAppendSegment(segment, label = "structured-append segment") {
  if (
    Object.hasOwn(segment, "data") ||
    Object.hasOwn(segment, "text") ||
    Object.hasOwn(segment, "bytes") ||
    Object.hasOwn(segment, "assignmentNumber") ||
    Object.hasOwn(segment, "applicationIndicator")
  ) {
    throw new InvalidModeError(`${label} must not include data, text, bytes, assignmentNumber, or applicationIndicator`);
  }
  normalizeStructuredAppend(segment, label);
}

function validateStructuredAppendInteger(value, label, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new InvalidModeError(`${label} must be an integer from ${min} to ${max}; got ${value}`);
  }
  return value;
}

function assertStructuredAppendCanStandAlone(existing, eciAssignmentNumber, fnc1First, fnc1Second) {
  if (fnc1First || existing.fnc1First.length > 0) {
    throw new InvalidGs1Error("Structured Append cannot be combined with FNC1 first position in this implementation");
  }
  if (fnc1Second !== false || existing.fnc1Second.length > 0) {
    throw new InvalidModeError("Structured Append cannot be combined with FNC1 second position in this implementation");
  }
  if (eciAssignmentNumber !== false || existing.eci.length > 0) {
    throw new InvalidModeError("Structured Append cannot be combined with ECI in this implementation");
  }
}

function getEciDesignatorBitLength(value) {
  validateEciAssignmentNumber(value);
  if (value < 2 ** 7) {
    return 8;
  }
  if (value < 2 ** 14) {
    return 16;
  }
  return 24;
}

function appendEciDesignatorBits(buffer, value) {
  validateEciAssignmentNumber(value);
  if (value < 2 ** 7) {
    buffer.append(value, 8);
  } else if (value < 2 ** 14) {
    buffer.append(0b10, 2);
    buffer.append(value, 14);
  } else {
    buffer.append(0b110, 3);
    buffer.append(value, 21);
  }
}
