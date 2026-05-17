import { InvalidCanvasTargetError } from "../errors.js";

export function renderCanvas(target, matrix, options) {
  const context = getCanvasContext(target);
  const canvas = context.canvas ?? target;
  const size = matrix.length;
  const margin = options.margin;
  const scale = options.scale;
  const dimension = (size + margin * 2) * scale;

  if (canvas && "width" in canvas) {
    canvas.width = dimension;
  }
  if (canvas && "height" in canvas) {
    canvas.height = dimension;
  }

  context.fillStyle = options.background;
  context.fillRect(0, 0, dimension, dimension);
  context.fillStyle = options.foreground;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (matrix[y][x]) {
        context.fillRect((x + margin) * scale, (y + margin) * scale, scale, scale);
      }
    }
  }

  return canvas ?? target;
}

function getCanvasContext(target) {
  if (!target) {
    throw new InvalidCanvasTargetError("drawToCanvas target is required");
  }

  if (typeof target.getContext === "function") {
    const context = target.getContext("2d");
    if (!context) {
      throw new InvalidCanvasTargetError("Canvas target did not provide a 2D rendering context");
    }
    return context;
  }

  if (typeof target.fillRect === "function") {
    return target;
  }

  throw new InvalidCanvasTargetError("drawToCanvas target must be a canvas element or 2D rendering context");
}
