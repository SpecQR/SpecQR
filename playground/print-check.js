// Keep the entered decimal values exact when converting millimeters to dots.
function positiveDecimal(value) {
  const match = /^(\d*)(?:[.,](\d+))?$/.exec(value.trim());
  if (!match || match[0].length > 24 || (!match[1] && !match[2])) return null;

  const numerator = BigInt(match[1] + (match[2] ?? ""));
  const denominator = 10n ** BigInt(match[2]?.length ?? 0);
  return numerator > 0n ? { numerator, denominator } : null;
}

// Round only for presentation. Round a minimum actionable width up.
function formatMm(numerator, denominator, roundUp = false) {
  const thousandths = (numerator * 1000n + (roundUp ? denominator - 1n : denominator / 2n)) /
    denominator;
  const fraction = String(thousandths % 1000n).padStart(3, "0").replace(/0+$/, "");
  return String(thousandths / 1000n) + (fraction ? "." + fraction : "");
}

export function calculatePrintFit({ size, margin, width, density, densityUnit, moduleDots }) {
  const widthMm = positiveDecimal(width);
  const nativeDensity = positiveDecimal(density);
  if (!widthMm || !nativeDensity || !Number.isSafeInteger(moduleDots) || moduleDots < 1) return null;
  if (densityUnit !== "dpi" && densityUnit !== "dots/mm") return null;

  const quietZone = Math.max(4, margin);
  const totalModules = BigInt(size + 2 * quietZone);
  const requiredDots = totalModules * BigInt(moduleDots);
  // An inch is exactly 25.4 mm.
  const dotsNumerator = nativeDensity.numerator * (densityUnit === "dpi" ? 10n : 1n);
  const dotsDenominator = nativeDensity.denominator * (densityUnit === "dpi" ? 254n : 1n);
  const availableDots = widthMm.numerator * dotsNumerator / (widthMm.denominator * dotsDenominator);
  const requiredMmNumerator = requiredDots * dotsDenominator;

  return {
    quietZone,
    requiredDots,
    availableDots,
    maxModuleDots: availableDots / totalModules,
    requiredMm: formatMm(requiredMmNumerator, dotsNumerator),
    minimumMm: formatMm(requiredMmNumerator, dotsNumerator, true),
    fits: requiredDots <= availableDots
  };
}
