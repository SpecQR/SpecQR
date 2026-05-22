import { InvalidEciError, InvalidGs1Error, InvalidModeError } from "../errors.js";

export const CONTROL_SEGMENT_MODES = Object.freeze({
  ECI: "eci",
  FNC1_FIRST: "fnc1",
  FNC1_SECOND: "fnc1-second",
  STRUCTURED_APPEND: "structured-append"
});

const CONTROL_MODE_INDICATORS = {
  [CONTROL_SEGMENT_MODES.ECI]: 0b0111,
  [CONTROL_SEGMENT_MODES.FNC1_FIRST]: 0b0101
};

export function applyControlSegments(segments, { eciAssignmentNumber = false, fnc1First = false } = {}) {
  if (eciAssignmentNumber === false && !fnc1First) {
    return segments;
  }

  const existing = inspectControlSegments(segments);
  const controls = [];

  if (fnc1First) {
    if (existing.fnc1First.length > 0) {
      throw new InvalidGs1Error("gs1 option cannot be combined with a manual fnc1 segment");
    }
    if (existing.eci.length > 0 || eciAssignmentNumber !== false) {
      throw new InvalidGs1Error("gs1 and eci cannot be combined in this FNC1 first position implementation");
    }
    controls.push(createFnc1FirstSegment());
  }

  if (eciAssignmentNumber !== false) {
    if (existing.fnc1First.length > 0) {
      throw new InvalidGs1Error("eci cannot be combined with FNC1 first position in this implementation");
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

export function validateManualControlSegments(segments) {
  const { fnc1First, eci } = inspectControlSegments(segments);

  if (fnc1First.length > 1) {
    throw new InvalidGs1Error("manual segments can include at most one fnc1 segment");
  }
  if (fnc1First.length === 1 && fnc1First[0] !== 0) {
    throw new InvalidGs1Error("manual fnc1 segment must be the first segment");
  }
  if (fnc1First.length === 1 && eci.length > 0) {
    throw new InvalidGs1Error("FNC1 first position cannot be combined with ECI in this implementation");
  }

  return segments;
}

export function isControlSegment(segment) {
  return segment?.mode === CONTROL_SEGMENT_MODES.ECI ||
    segment?.mode === CONTROL_SEGMENT_MODES.FNC1_FIRST;
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
  throw new InvalidModeError(`Unsupported control segment mode: ${segment.mode}`);
}

export function getControlSegmentBitLength(segment) {
  validateControlSegment(segment);
  if (segment.mode === CONTROL_SEGMENT_MODES.FNC1_FIRST) {
    return 4;
  }
  return 4 + getEciDesignatorBitLength(segment.assignmentNumber);
}

export function appendControlSegmentBits(buffer, segment) {
  validateControlSegment(segment);
  buffer.append(CONTROL_MODE_INDICATORS[segment.mode], 4);
  if (segment.mode === CONTROL_SEGMENT_MODES.ECI) {
    appendEciDesignatorBits(buffer, segment.assignmentNumber);
  }
}

export function getFirstEciAssignmentNumber(segments) {
  return segments.find((segment) => segment.mode === CONTROL_SEGMENT_MODES.ECI)?.assignmentNumber ?? null;
}

export function getFirstFnc1Mode(segments) {
  return segments.some((segment) => segment.mode === CONTROL_SEGMENT_MODES.FNC1_FIRST)
    ? "first-position"
    : null;
}

export function createEciSegment(assignmentNumber) {
  validateEciAssignmentNumber(assignmentNumber);
  return { mode: CONTROL_SEGMENT_MODES.ECI, assignmentNumber };
}

export function createFnc1FirstSegment() {
  return { mode: CONTROL_SEGMENT_MODES.FNC1_FIRST };
}

export function validateEciAssignmentNumber(value) {
  if (!Number.isInteger(value) || value < 0 || value >= 1000000) {
    throw new InvalidEciError(`ECI assignment number must be an integer from 0 to 999999; got ${value}`);
  }
}

function inspectControlSegments(segments) {
  const fnc1First = [];
  const eci = [];

  segments.forEach((segment, index) => {
    if (segment.mode === CONTROL_SEGMENT_MODES.FNC1_FIRST) {
      fnc1First.push(index);
    } else if (segment.mode === CONTROL_SEGMENT_MODES.ECI) {
      eci.push(index);
    }
  });

  return { fnc1First, eci };
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
