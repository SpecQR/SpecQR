import { interleaveCodewords } from "../core/codewords.js";
import { buildMatrix } from "../core/matrix.js";
import { getDataCodewordCount } from "../core/tables.js";
import { encodeSegments } from "../encoding/modes.js";

export function buildResultArtifact(plan, options) {
  const capacityBits = getDataCodewordCount(plan.version, plan.errorCorrectionLevel) * 8;
  const data = encodeSegments(plan.segments, plan.version, plan.errorCorrectionLevel);
  const interleaved = interleaveCodewords(data, plan.version, plan.errorCorrectionLevel);
  const built = buildMatrix(
    interleaved.codewords,
    plan.version,
    plan.errorCorrectionLevel,
    options.maskPattern
  );
  return { plan, capacityBits, interleaved, built };
}
