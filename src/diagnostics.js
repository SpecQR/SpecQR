import { parseRgbaColor, getContrastRatio } from "./render/color.js";

const MIN_RECOMMENDED_CONTRAST = 4.5;
const STRONG_RECOMMENDED_CONTRAST = 7;
const MIN_PRINT_MODULE_MM = 0.25;

export function createDiagnostics({
  plan,
  built,
  options,
  inputBytes,
  capacityBits,
  interleaved,
  getSize,
  getDiagnosticMode,
  getFirstEciAssignmentNumber,
  getFirstFnc1Mode,
  gs1Validation,
  getSegmentDiagnostics
}) {
  const remainingBits = capacityBits - plan.dataBitLength;
  const contrast = getColorContrast(options);
  const print = getPrintDiagnostics(plan, options);
  const fnc1 = getFirstFnc1Mode(plan.segments);
  const gs1 = fnc1 === "first-position";
  const warnings = createWarnings({
    options,
    remainingBits,
    capacityBits,
    contrast,
    print
  });

  return {
    version: plan.version,
    size: getSize(plan.version),
    errorCorrectionLevel: plan.errorCorrectionLevel,
    requestedErrorCorrectionLevel: plan.requestedErrorCorrectionLevel,
    boostedErrorCorrection: plan.boostedErrorCorrection,
    versionSelection: plan.versionSelection,
    versionSelectionReason: getVersionSelectionReason(plan, options),
    maskPattern: built.maskPattern,
    maskPenalty: built.penalty,
    maskPenalties: built.maskPenalties,
    maskSelectionReason: getMaskSelectionReason(built, options),
    mode: getDiagnosticMode(plan.segments),
    eciAssignmentNumber: getFirstEciAssignmentNumber(plan.segments),
    fnc1,
    gs1,
    gs1Validation: gs1Validation ?? createDefaultGs1ValidationDiagnostics(gs1),
    segments: plan.segments.map(getSegmentDiagnostics),
    dataBitLength: plan.dataBitLength,
    capacityBits,
    remainingBits,
    capacityUtilization: plan.dataBitLength / capacityBits,
    inputBytes,
    dataCodewords: interleaved.dataCodewords,
    errorCorrectionCodewords: interleaved.errorCorrectionCodewords,
    totalCodewords: interleaved.totalCodewords,
    quietZone: {
      modules: options.margin,
      recommendedModules: 4,
      isSufficient: options.margin >= 4
    },
    colors: contrast,
    print,
    warnings
  };
}

function createDefaultGs1ValidationDiagnostics(enabled) {
  return {
    enabled,
    elementCount: enabled ? null : 0,
    ais: [],
    hasSeparators: false
  };
}

function getVersionSelectionReason(plan, options) {
  if (plan.versionSelection === "fixed") {
    return `Version ${plan.version} was requested explicitly.`;
  }
  return `Version ${plan.version} is the smallest version in ${options.minVersion}..${options.maxVersion} that fits the encoded data at error correction ${options.errorCorrectionLevel}.`;
}

function getMaskSelectionReason(built, options) {
  if (options.maskPattern !== "auto") {
    return `Mask pattern ${built.maskPattern} was requested explicitly.`;
  }
  return `Mask pattern ${built.maskPattern} had the lowest penalty score (${built.penalty}) among the evaluated masks.`;
}

function getColorContrast(options) {
  const foreground = parseRgbaColor(options.foreground);
  const background = parseRgbaColor(options.background);
  if (!foreground || !background) {
    return {
      ratio: null,
      foregroundAlpha: null,
      backgroundAlpha: null,
      isInspectable: false,
      isStrong: false,
      isSufficient: false
    };
  }

  const ratio = getContrastRatio(foreground, background);
  return {
    ratio,
    foregroundAlpha: foreground[3],
    backgroundAlpha: background[3],
    isInspectable: true,
    isStrong: ratio >= STRONG_RECOMMENDED_CONTRAST,
    isSufficient: ratio >= MIN_RECOMMENDED_CONTRAST && foreground[3] === 255 && background[3] === 255
  };
}

function getPrintDiagnostics(plan, options) {
  const moduleSizeMm = options.printDpi === null ? null : (options.scale / options.printDpi) * 25.4;
  return {
    dpi: options.printDpi,
    modulePixels: options.scale,
    moduleSizeMm,
    symbolSizeMm: moduleSizeMm === null ? null : (plan.version * 4 + 17 + options.margin * 2) * moduleSizeMm,
    recommendedMinimumModuleSizeMm: MIN_PRINT_MODULE_MM,
    isModuleSizeSufficient: moduleSizeMm === null ? null : moduleSizeMm >= MIN_PRINT_MODULE_MM
  };
}

function createWarnings({ options, remainingBits, capacityBits, contrast, print }) {
  const warnings = [];

  if (options.margin < 4) {
    warnings.push({
      code: "QUIET_ZONE_TOO_SMALL",
      severity: "warning",
      message: "QR Code Model 2 readers expect a quiet zone of at least 4 modules.",
      details: { margin: options.margin, recommendedModules: 4 }
    });
  }

  if (!contrast.isInspectable) {
    warnings.push({
      code: "COLOR_CONTRAST_UNKNOWN",
      severity: "info",
      message: "Color contrast could not be inspected because one or both colors are not simple hex/named colors.",
      details: { foreground: options.foreground, background: options.background }
    });
  } else if (contrast.ratio < MIN_RECOMMENDED_CONTRAST) {
    warnings.push({
      code: "COLOR_CONTRAST_LOW",
      severity: "warning",
      message: "Foreground and background contrast is low for reliable scanning.",
      details: { ratio: contrast.ratio, recommendedMinimumRatio: MIN_RECOMMENDED_CONTRAST }
    });
  } else if (contrast.ratio < STRONG_RECOMMENDED_CONTRAST) {
    warnings.push({
      code: "COLOR_CONTRAST_MODERATE",
      severity: "info",
      message: "Contrast is acceptable, but stronger contrast is recommended for damaged, small, or printed QR codes.",
      details: { ratio: contrast.ratio, strongRecommendedRatio: STRONG_RECOMMENDED_CONTRAST }
    });
  }

  if (contrast.isInspectable && (contrast.foregroundAlpha < 255 || contrast.backgroundAlpha < 255)) {
    warnings.push({
      code: "COLOR_ALPHA_USED",
      severity: "warning",
      message: "Transparent foreground or background colors can reduce scanner reliability.",
      details: {
        foregroundAlpha: contrast.foregroundAlpha,
        backgroundAlpha: contrast.backgroundAlpha
      }
    });
  }

  if (remainingBits / capacityBits < 0.05) {
    warnings.push({
      code: "CAPACITY_NEAR_LIMIT",
      severity: "info",
      message: "The selected version is close to full capacity.",
      details: { remainingBits, capacityBits }
    });
  }

  if (print.dpi !== null && print.isModuleSizeSufficient === false) {
    warnings.push({
      code: "PRINT_MODULE_TOO_SMALL",
      severity: "warning",
      message: "The configured scale and DPI produce modules smaller than the print recommendation.",
      details: {
        dpi: print.dpi,
        moduleSizeMm: print.moduleSizeMm,
        recommendedMinimumModuleSizeMm: print.recommendedMinimumModuleSizeMm
      }
    });
  }

  if (["png", "png-data-url"].includes(options.output) && options.scale < 3) {
    warnings.push({
      code: "RASTER_SCALE_SMALL",
      severity: "info",
      message: "Raster output with fewer than 3 pixels per module may scan poorly after resizing.",
      details: { scale: options.scale, recommendedMinimumScale: 3 }
    });
  }

  if (warnings.some((warning) => warning.severity === "warning")) {
    warnings.push({
      code: "SCAN_RISK",
      severity: "warning",
      message: "One or more settings may reduce scan reliability.",
      details: {
        blockingWarnings: warnings.filter((warning) => warning.severity === "warning").map((warning) => warning.code)
      }
    });
  }

  return warnings;
}
