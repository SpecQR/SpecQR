import { ERROR_CORRECTION_LEVELS } from "./core/tables.js";
import {
  InvalidEciError,
  InvalidGs1Error,
  InvalidInputError,
  InvalidModeError,
  InvalidOutputError,
  InvalidVersionError
} from "./errors.js";

const DEFAULT_OPTIONS = {
  errorCorrectionLevel: "M",
  version: "auto",
  minVersion: 1,
  maxVersion: 40,
  maskPattern: "auto",
  mode: "auto",
  encoding: "utf-8",
  margin: 4,
  scale: 8,
  foreground: "#000000",
  background: "#ffffff",
  output: "svg",
  optimizeSegments: true,
  boostErrorCorrection: false,
  eci: false,
  gs1: false,
  diagnostics: false,
  printDpi: null
};

export function normalizeOptions(options = {}) {
  const normalized = { ...DEFAULT_OPTIONS, ...options };

  if (!ERROR_CORRECTION_LEVELS[normalized.errorCorrectionLevel]) {
    throw new InvalidInputError(
      `errorCorrectionLevel must be one of L, M, Q, H; got ${normalized.errorCorrectionLevel}`
    );
  }

  if (!["auto", "numeric", "alphanumeric", "byte", "kanji"].includes(normalized.mode)) {
    throw new InvalidModeError(
      `mode must be "auto", "numeric", "alphanumeric", "byte", or "kanji"; got ${normalized.mode}`
    );
  }

  if (typeof normalized.encoding !== "string" || normalized.encoding.toLowerCase() !== "utf-8") {
    throw new InvalidInputError(`Only utf-8 encoding is implemented in P0; got ${normalized.encoding}`);
  }
  normalized.encoding = "utf-8";

  if (normalized.eci === true) {
    normalized.eci = 26;
  } else if (normalized.eci !== false) {
    if (!Number.isInteger(normalized.eci) || normalized.eci < 0 || normalized.eci >= 1000000) {
      throw new InvalidEciError(`eci must be false, true, or an integer from 0 to 999999; got ${normalized.eci}`);
    }
  }

  if (typeof normalized.gs1 !== "boolean") {
    throw new InvalidGs1Error(`gs1 must be a boolean; got ${typeof normalized.gs1}`);
  }
  if (normalized.gs1 && normalized.eci !== false) {
    throw new InvalidGs1Error("gs1 and eci cannot be combined in this FNC1 first position implementation");
  }

  validateVersionBound("minVersion", normalized.minVersion);
  validateVersionBound("maxVersion", normalized.maxVersion);
  if (normalized.minVersion > normalized.maxVersion) {
    throw new InvalidVersionError("minVersion must be less than or equal to maxVersion");
  }

  if (normalized.version !== "auto") {
    validateVersionBound("version", normalized.version);
  }

  if (normalized.maskPattern !== "auto") {
    if (!Number.isInteger(normalized.maskPattern) || normalized.maskPattern < 0 || normalized.maskPattern > 7) {
      throw new InvalidInputError(`maskPattern must be "auto" or an integer from 0 to 7; got ${normalized.maskPattern}`);
    }
  }

  if (!Number.isInteger(normalized.margin) || normalized.margin < 0) {
    throw new InvalidInputError(`margin must be a non-negative integer; got ${normalized.margin}`);
  }

  if (!Number.isInteger(normalized.scale) || normalized.scale < 1) {
    throw new InvalidInputError(`scale must be a positive integer; got ${normalized.scale}`);
  }

  const outputs = ["matrix", "svg", "svg-data-url", "png", "png-data-url"];
  if (!outputs.includes(normalized.output)) {
    throw new InvalidOutputError(`output must be one of ${outputs.join(", ")}; got ${normalized.output}`);
  }

  if (typeof normalized.optimizeSegments !== "boolean") {
    throw new InvalidInputError(`optimizeSegments must be a boolean; got ${typeof normalized.optimizeSegments}`);
  }

  if (typeof normalized.boostErrorCorrection !== "boolean") {
    throw new InvalidInputError(`boostErrorCorrection must be a boolean; got ${typeof normalized.boostErrorCorrection}`);
  }

  if (normalized.printDpi !== null) {
    if (!Number.isFinite(normalized.printDpi) || normalized.printDpi <= 0) {
      throw new InvalidInputError(`printDpi must be a positive number or null; got ${normalized.printDpi}`);
    }
  }

  return normalized;
}

function validateVersionBound(name, value) {
  if (!Number.isInteger(value) || value < 1 || value > 40) {
    throw new InvalidVersionError(`${name} must be an integer from 1 to 40; got ${value}`);
  }
}
