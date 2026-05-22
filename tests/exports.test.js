import test from "node:test";
import assert from "node:assert/strict";

test("package root, node, and browser subpath exports are importable", async () => {
  const root = await import("specqr");
  const node = await import("specqr/node");
  const browser = await import("specqr/browser");

  assert.equal(typeof root.QRCode.generate, "function");
  assert.equal(typeof root.generateSegments, "function");
  assert.equal(typeof root.appendGtinCheckDigit, "function");
  assert.equal(typeof root.appendSsccCheckDigit, "function");
  assert.equal(typeof root.QRCode.appendGtinCheckDigit, "function");
  assert.equal(root.parseGs1ElementString, undefined);
  assert.equal(root.QRCode.parseGs1ElementString, undefined);
  assert.equal(typeof node.toPngBuffer, "function");
  assert.equal(typeof node.writePngFile, "function");
  assert.equal(typeof browser.toBlob, "function");
  assert.equal(typeof browser.toImageData, "function");
});
