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
  assert.equal(typeof root.createGs1DigitalLink, "function");
  assert.equal(typeof root.QRCode.createGs1DigitalLink, "function");
  assert.equal(typeof root.parseGs1DigitalLink, "function");
  assert.equal(typeof root.QRCode.parseGs1DigitalLink, "function");
  assert.equal(typeof root.parseGs1ElementString, "function");
  assert.equal(typeof root.QRCode.parseGs1ElementString, "function");
  assert.equal(root.validateGs1DigitalLink, undefined);
  assert.equal(root.QRCode.validateGs1DigitalLink, undefined);
  assert.equal(root.validateGs1ElementString, undefined);
  assert.equal(root.QRCode.validateGs1ElementString, undefined);
  assert.equal(root.applyControlSegments, undefined);
  assert.equal(root.QRCode.applyControlSegments, undefined);
  assert.equal(root.createControlSegments, undefined);
  assert.equal(root.QRCode.createControlSegments, undefined);
  assert.equal(root.createFnc1SecondSegment, undefined);
  assert.equal(root.QRCode.createFnc1SecondSegment, undefined);
  assert.equal(root.createStructuredAppendSegment, undefined);
  assert.equal(root.QRCode.createStructuredAppendSegment, undefined);
  assert.equal(typeof node.toPngBuffer, "function");
  assert.equal(typeof node.writePngFile, "function");
  assert.equal(typeof browser.toBlob, "function");
  assert.equal(typeof browser.toImageData, "function");
});
