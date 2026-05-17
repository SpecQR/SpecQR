import { InvalidColorError } from "../errors.js";

const NAMED_COLORS = new Map([
  ["black", [0, 0, 0, 255]],
  ["white", [255, 255, 255, 255]],
  ["transparent", [0, 0, 0, 0]]
]);

export function parseRgbaColor(value, label = "color", strict = false) {
  const text = String(value).trim().toLowerCase();
  const named = NAMED_COLORS.get(text);
  if (named) {
    return named.slice();
  }

  if (!text.startsWith("#")) {
    if (strict) {
      throw new InvalidColorError(`${label} must be a hex color, "black", "white", or "transparent"`);
    }
    return null;
  }

  const hex = text.slice(1);
  if (!/^[0-9a-f]+$/u.test(hex)) {
    if (strict) {
      throw new InvalidColorError(`${label} has unsupported color format: ${value}`);
    }
    return null;
  }

  if (hex.length === 3 || hex.length === 4) {
    return [
      Number.parseInt(hex[0] + hex[0], 16),
      Number.parseInt(hex[1] + hex[1], 16),
      Number.parseInt(hex[2] + hex[2], 16),
      hex.length === 4 ? Number.parseInt(hex[3] + hex[3], 16) : 255
    ];
  }
  if (hex.length === 6 || hex.length === 8) {
    return [
      Number.parseInt(hex.slice(0, 2), 16),
      Number.parseInt(hex.slice(2, 4), 16),
      Number.parseInt(hex.slice(4, 6), 16),
      hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) : 255
    ];
  }

  if (strict) {
    throw new InvalidColorError(`${label} has unsupported color format: ${value}`);
  }
  return null;
}

export function getContrastRatio(foreground, background) {
  const light = relativeLuminance(foreground);
  const dark = relativeLuminance(background);
  const lighter = Math.max(light, dark);
  const darker = Math.min(light, dark);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(color) {
  const [red, green, blue] = color.map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}
