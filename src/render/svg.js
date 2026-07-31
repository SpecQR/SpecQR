import { getSvgGeometry } from "./geometry.js";

export function renderSvg(matrix, options) {
  return renderSvgWithOutput(matrix, options, "svg");
}

export function renderSvgDataUrl(matrix, options) {
  const svg = renderSvgWithOutput(matrix, options, "svg-data-url");
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function renderSvgWithOutput(matrix, options, output) {
  const size = matrix.length;
  const margin = options.margin;
  const scale = options.scale;
  const { dimension } = getSvgGeometry(matrix, options, output);
  const foreground = escapeAttribute(options.foreground);
  const background = escapeAttribute(options.background);

  const path = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (matrix[y][x]) {
        const px = (x + margin) * scale;
        const py = (y + margin) * scale;
        path.push(`M${px},${py}h${scale}v${scale}h-${scale}z`);
      }
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${dimension}" height="${dimension}" viewBox="0 0 ${dimension} ${dimension}" role="img">`,
    `<rect width="100%" height="100%" fill="${background}"/>`,
    `<path fill="${foreground}" d="${path.join("")}"/>`,
    "</svg>"
  ].join("");
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
