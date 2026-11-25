import assert from "node:assert/strict";
import test from "node:test";
import { calculatePrintFit } from "../playground/print-check.js";

const print = (overrides = {}) => calculatePrintFit({
  size: 41, margin: 4, width: "20.5", density: "12", densityUnit: "dots/mm", moduleDots: 5,
  ...overrides
});

test("the same width gives different fit results at native 12 dots/mm and exact 300 dpi", () => {
  assert.deepEqual(print(), {
    quietZone: 4, requiredDots: 245n, availableDots: 246n, maxModuleDots: 5n,
    requiredMm: "20.417", minimumMm: "20.417", fits: true
  });
  assert.deepEqual(print({ density: "300", densityUnit: "dpi" }), {
    quietZone: 4, requiredDots: 245n, availableDots: 242n, maxModuleDots: 4n,
    requiredMm: "20.743", minimumMm: "20.744", fits: false
  });
});

test("fits exactly at the boundary but not below it even when displayed values round alike", () => {
  const tryWidth = width => print({ width, density: "10" });
  for (const [width, fits, availableDots] of [
    ["24.499999999999999999", false, 244n],
    ["24.5", true, 245n],
    ["24.500000000000000001", true, 245n]
  ]) {
    assert.equal(tryWidth(width).fits, fits);
    assert.equal(tryWidth(width).availableDots, availableDots);
    assert.equal(tryWidth(width).requiredMm, "24.5");
  }
  assert.equal(print({ width: "20,5", density: "12,0" }).fits, true);
  assert.equal(print({ width: "20.744", density: "300", densityUnit: "dpi" }).fits, true);
});

test("adds the minimum quiet zone or uses the larger preview margin", () => {
  assert.equal(print({ margin: 0 }).quietZone, 4);
  assert.equal(print({ margin: 2 }).requiredDots, 245n);
  assert.equal(print({ margin: 5 }).requiredDots, 255n);
  assert.equal(print({ margin: 5 }).fits, false);
  assert.equal(print({ width: "0.1" }).maxModuleDots, 0n);
});

test("rejects invalid widths, densities, units and fractional module sizes", () => {
  for (const value of ["", ".", "  ", "0", "-1", "1e3", "20.5 mm", "1,2.3", "1".repeat(25)]) {
    assert.equal(print({ width: value }), null);
    assert.equal(print({ density: value }), null);
  }
  for (const value of [0, -1, 1.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(print({ moduleDots: value }), null);
  }
  assert.equal(print({ densityUnit: "unknown" }), null);
});
