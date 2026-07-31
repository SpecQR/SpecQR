import { getDataCodewordCount, getSize } from "../core/tables.js";
import {
  getControlSegmentDiagnostics,
  getFirstEciAssignmentNumber,
  getFirstFnc1Mode,
  getFirstFnc1SecondApplicationIndicator,
  getFirstFnc1SecondApplicationIndicatorCodeword,
  getFirstStructuredAppend,
  getFirstStructuredAppendEncodedValues
} from "../encoding/control-segments.js";
import { createDiagnostics, createPlanningDiagnostics } from "../diagnostics.js";
import { DataTooLongError } from "../errors.js";
import { parseRgbaColor } from "../render/color.js";
import { getDiagnosticMode, getSegmentDiagnostics } from "./planning.js";

export function createArtifactDiagnostics(artifact, options, inputBytes) {
  const { plan, built, capacityBits, interleaved } = artifact;
  return createDiagnostics({
    plan,
    built,
    options,
    inputBytes,
    capacityBits,
    interleaved,
    getSize,
    getDiagnosticMode,
    getControlSegmentDiagnostics,
    getFirstEciAssignmentNumber,
    getFirstFnc1Mode,
    getFirstFnc1SecondApplicationIndicator,
    getFirstFnc1SecondApplicationIndicatorCodeword,
    getFirstStructuredAppend,
    getFirstStructuredAppendEncodedValues,
    gs1Validation: plan.gs1Validation,
    getSegmentDiagnostics: (segment) => getSegmentDiagnostics(segment, plan.version)
  });
}

export function estimateWithDataTooLongResult(selectPlan, selectOverflowPlan, options, inputBytes) {
  try {
    return createEstimateResult(selectPlan(), options, inputBytes, null);
  } catch (error) {
    if (!(error instanceof DataTooLongError)) {
      throw error;
    }
    return createEstimateResult(selectOverflowPlan(), options, inputBytes, error);
  }
}

export function validatePlanningColors(options) {
  if (!["png", "png-data-url"].includes(options.output)) {
    return;
  }
  parseRgbaColor(options.foreground, "foreground", true);
  parseRgbaColor(options.background, "background", true);
}

function createEstimateResult(plan, options, inputBytes, dataTooLongError) {
  const capacityBits = getDataCodewordCount(plan.version, plan.errorCorrectionLevel) * 8;
  const remainingBits = capacityBits - plan.dataBitLength;
  const diagnostics = createPlanningDiagnostics({
    plan,
    options,
    inputBytes,
    capacityBits,
    getSize,
    getDiagnosticMode,
    getControlSegmentDiagnostics,
    getFirstEciAssignmentNumber,
    getFirstFnc1Mode,
    getFirstFnc1SecondApplicationIndicator,
    getFirstFnc1SecondApplicationIndicatorCodeword,
    getFirstStructuredAppend,
    getFirstStructuredAppendEncodedValues,
    gs1Validation: plan.gs1Validation,
    getSegmentDiagnostics: (segment) => getSegmentDiagnostics(segment, plan.version)
  });
  const selectedVersion = plan.versionSelection === "auto-range" ? null : plan.version;
  const base = {
    selectedVersion,
    minVersion: options.minVersion,
    maxVersion: options.maxVersion,
    errorCorrectionLevel: plan.errorCorrectionLevel,
    requestedErrorCorrectionLevel: plan.requestedErrorCorrectionLevel,
    boostedErrorCorrection: plan.boostedErrorCorrection,
    mode: diagnostics.mode,
    dataBitLength: plan.dataBitLength,
    capacityBits,
    remainingBits,
    usageRatio: plan.dataBitLength / capacityBits,
    capacityUtilization: plan.dataBitLength / capacityBits,
    inputBytes,
    segments: diagnostics.segments,
    controlSegments: diagnostics.controlSegments,
    versionSelection: plan.versionSelection,
    versionSelectionReason: diagnostics.versionSelectionReason,
    warnings: diagnostics.warnings,
    diagnostics
  };

  if (dataTooLongError === null) {
    return {
      ok: true,
      ...base
    };
  }

  return {
    ok: false,
    reason: "data-too-long",
    ...base,
    boostedErrorCorrection: false,
    overflowBits: Math.max(0, -remainingBits),
    error: {
      name: dataTooLongError.name,
      code: dataTooLongError.code,
      message: dataTooLongError.message
    }
  };
}
