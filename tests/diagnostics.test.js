import test from "node:test";
import assert from "node:assert/strict";
import { generate } from "../src/index.js";

test("diagnostics include warnings and selection explanations", () => {
  const result = generate("HELLO", {
    output: "png",
    diagnostics: true,
    margin: 1,
    scale: 1,
    foreground: "#777777",
    background: "#888888",
    printDpi: 600
  });

  const { diagnostics } = result;
  const warningCodes = diagnostics.warnings.map((warning) => warning.code);

  assert.equal(diagnostics.quietZone.isSufficient, false);
  assert.equal(diagnostics.maskPenalties.length, 8);
  assert.match(diagnostics.versionSelectionReason, /smallest version/);
  assert.match(diagnostics.maskSelectionReason, /lowest penalty/);
  assert.equal(typeof diagnostics.capacityUtilization, "number");
  assert.equal(diagnostics.print.dpi, 600);
  assert.ok(diagnostics.colors.ratio < 4.5);
  assert.ok(warningCodes.includes("QUIET_ZONE_TOO_SMALL"));
  assert.ok(warningCodes.includes("COLOR_CONTRAST_LOW"));
  assert.ok(warningCodes.includes("PRINT_MODULE_TOO_SMALL"));
  assert.ok(warningCodes.includes("RASTER_SCALE_SMALL"));
  assert.ok(warningCodes.includes("SCAN_RISK"));
});

test("fixed mask diagnostics explain the explicit mask choice", () => {
  const result = generate("HELLO", {
    output: "matrix",
    diagnostics: true,
    maskPattern: 3
  });

  assert.equal(result.diagnostics.maskPattern, 3);
  assert.equal(result.diagnostics.maskPenalties.length, 1);
  assert.match(result.diagnostics.maskSelectionReason, /requested explicitly/);
});
