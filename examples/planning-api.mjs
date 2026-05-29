import {
  analyzeSegments,
  estimate,
  getCapacity,
  QRCode
} from "specqr";

const input = "https://github.com/SpecQR/SpecQR";
const estimateResult = estimate(input, {
  errorCorrectionLevel: "Q",
  margin: 2,
  printDpi: 600
});

if (!estimateResult.ok) {
  throw new Error(`Unexpected planning overflow: ${estimateResult.error.message}`);
}

const segmentPlan = analyzeSegments([
  { mode: "alphanumeric", data: "ORDER-" },
  { mode: "numeric", data: "1234567890" },
  { mode: "kanji", data: "漢字" }
], {
  errorCorrectionLevel: "M"
});

if (!segmentPlan.ok) {
  throw new Error(`Unexpected manual segment overflow: ${segmentPlan.error.message}`);
}

const byteCapacity = getCapacity({
  version: 10,
  errorCorrectionLevel: "M",
  mode: "byte"
});

const tooLong = QRCode.estimate("a".repeat(100), {
  version: 1,
  errorCorrectionLevel: "H",
  mode: "byte"
});

if (tooLong.ok) {
  throw new Error("Expected fixed version overflow to return ok:false");
}

console.log(JSON.stringify({
  estimate: {
    ok: estimateResult.ok,
    selectedVersion: estimateResult.selectedVersion,
    errorCorrectionLevel: estimateResult.errorCorrectionLevel,
    dataBitLength: estimateResult.dataBitLength,
    capacityBits: estimateResult.capacityBits,
    remainingBits: estimateResult.remainingBits,
    usageRatio: estimateResult.usageRatio,
    warningCodes: estimateResult.warnings.map((warning) => warning.code)
  },
  analyzeSegments: {
    ok: segmentPlan.ok,
    selectedVersion: segmentPlan.selectedVersion,
    mode: segmentPlan.mode,
    dataBitLength: segmentPlan.dataBitLength,
    capacityBits: segmentPlan.capacityBits,
    remainingBits: segmentPlan.remainingBits
  },
  capacity: {
    version: byteCapacity.version,
    errorCorrectionLevel: byteCapacity.errorCorrectionLevel,
    mode: byteCapacity.mode,
    capacityBits: byteCapacity.capacityBits,
    dataCodewords: byteCapacity.dataCodewords,
    totalCodewords: byteCapacity.totalCodewords,
    maxBytes: byteCapacity.maxBytes
  },
  tooLong: {
    ok: tooLong.ok,
    reason: tooLong.reason,
    selectedVersion: tooLong.selectedVersion,
    overflowBits: tooLong.overflowBits,
    errorCode: tooLong.error.code
  }
}, null, 2));
