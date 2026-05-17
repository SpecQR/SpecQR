import test from "node:test";
import assert from "node:assert/strict";
import { QRCode, drawToCanvas } from "../src/index.js";

test("drawToCanvas draws to a canvas-like target", () => {
  const canvas = createFakeCanvas();
  const returned = QRCode.drawToCanvas(canvas, "HELLO", {
    margin: 4,
    scale: 2,
    foreground: "#123456",
    background: "#ffffff"
  });

  assert.equal(returned, canvas);
  assert.equal(canvas.width, 58);
  assert.equal(canvas.height, 58);
  assert.deepEqual(canvas.context.calls[0], {
    fillStyle: "#ffffff",
    x: 0,
    y: 0,
    width: 58,
    height: 58
  });
  assert.ok(canvas.context.calls.some((call) => call.fillStyle === "#123456" && call.width === 2 && call.height === 2));
});

test("drawToCanvas accepts a 2D context-like target", () => {
  const canvas = createFakeCanvas();
  const returned = drawToCanvas(canvas.context, "1234567890", {
    margin: 4,
    scale: 3
  });

  assert.equal(returned, canvas);
  assert.equal(canvas.width, 87);
  assert.equal(canvas.height, 87);
  assert.ok(canvas.context.calls.length > 1);
});

test("drawToCanvas rejects invalid targets", () => {
  assert.throws(
    () => drawToCanvas({}, "HELLO"),
    /canvas element or 2D rendering context/
  );
});

function createFakeCanvas() {
  const canvas = {
    width: 0,
    height: 0,
    context: null,
    getContext(contextId) {
      assert.equal(contextId, "2d");
      return this.context;
    }
  };

  canvas.context = {
    canvas,
    fillStyle: "#000000",
    calls: [],
    fillRect(x, y, width, height) {
      this.calls.push({
        fillStyle: this.fillStyle,
        x,
        y,
        width,
        height
      });
    }
  };

  return canvas;
}
