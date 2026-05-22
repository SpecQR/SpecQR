const FIXED = "fixed";
const VARIABLE = "variable";
const NUMERIC = "numeric";
const TEXT = "text";
const SEPARATOR_WHEN_FOLLOWED = "required-when-followed";
const NO_SEPARATOR = "none";

const EXACT_AI_ENTRIES = [
  entry("00", "Serial shipping container code", FIXED, { exactLength: 18, valueKind: NUMERIC, checkDigitRule: "sscc" }),
  entry("01", "Global trade item number", FIXED, { exactLength: 14, valueKind: NUMERIC, checkDigitRule: "gtin" }),
  entry("02", "Contained trade item GTIN", FIXED, { exactLength: 14, valueKind: NUMERIC, checkDigitRule: "gtin" }),
  entry("10", "Batch or lot number", VARIABLE, { maxLength: 20, valueKind: TEXT }),
  entry("11", "Production date", FIXED, { exactLength: 6, valueKind: NUMERIC }),
  entry("12", "Due date", FIXED, { exactLength: 6, valueKind: NUMERIC }),
  entry("13", "Packaging date", FIXED, { exactLength: 6, valueKind: NUMERIC }),
  entry("15", "Best before date", FIXED, { exactLength: 6, valueKind: NUMERIC }),
  entry("16", "Sell by date", FIXED, { exactLength: 6, valueKind: NUMERIC }),
  entry("17", "Expiration date", FIXED, { exactLength: 6, valueKind: NUMERIC }),
  entry("20", "Internal product variant", FIXED, { exactLength: 2, valueKind: NUMERIC }),
  entry("21", "Serial number", VARIABLE, { maxLength: 20, valueKind: TEXT }),
  entry("22", "Consumer product variant", VARIABLE, { maxLength: 20, valueKind: TEXT }),
  entry("30", "Variable count", VARIABLE, { maxLength: 8, valueKind: NUMERIC }),
  entry("37", "Count of contained trade items", VARIABLE, { maxLength: 8, valueKind: NUMERIC }),
  entry("240", "Additional product identification", VARIABLE, { maxLength: 30, valueKind: TEXT }),
  entry("241", "Customer part number", VARIABLE, { maxLength: 30, valueKind: TEXT }),
  entry("400", "Customer purchase order number", VARIABLE, { maxLength: 30, valueKind: TEXT }),
  entry("410", "Ship to global location number", FIXED, { exactLength: 13, valueKind: NUMERIC }),
  entry("411", "Bill to global location number", FIXED, { exactLength: 13, valueKind: NUMERIC }),
  entry("412", "Purchased from global location number", FIXED, { exactLength: 13, valueKind: NUMERIC }),
  entry("413", "Ship for global location number", FIXED, { exactLength: 13, valueKind: NUMERIC }),
  entry("414", "Identification of a physical location", FIXED, { exactLength: 13, valueKind: NUMERIC }),
  entry("415", "Global location number of the invoicing party", FIXED, { exactLength: 13, valueKind: NUMERIC }),
  entry("420", "Ship to postal code", VARIABLE, { maxLength: 20, valueKind: TEXT }),
  entry("422", "Country of origin", FIXED, { exactLength: 3, valueKind: NUMERIC }),
  entry("424", "Country of processing", FIXED, { exactLength: 3, valueKind: NUMERIC }),
  entry("425", "Country of disassembly", FIXED, { exactLength: 3, valueKind: NUMERIC }),
  entry("426", "Country covering full process chain", FIXED, { exactLength: 3, valueKind: NUMERIC })
];

const AI_FAMILY_ENTRIES = [
  family(/^310[0-5]$/, "Net weight in kilograms", FIXED, { exactLength: 6, valueKind: NUMERIC }),
  family(/^320[0-5]$/, "Net weight in pounds", FIXED, { exactLength: 6, valueKind: NUMERIC }),
  family(/^9[1-9]$/, "Company internal information", VARIABLE, { maxLength: 90, valueKind: TEXT })
];

const EXACT_AI_ENTRY_MAP = new Map(EXACT_AI_ENTRIES.map((metadata) => [metadata.ai, metadata]));

export const GS1_AI_DICTIONARY = Object.freeze({
  exact: Object.freeze(EXACT_AI_ENTRIES),
  families: Object.freeze(AI_FAMILY_ENTRIES)
});

export function getGs1AiDictionaryEntry(ai) {
  const exact = EXACT_AI_ENTRY_MAP.get(ai);
  if (exact) {
    return toRuntimeEntry(exact, ai);
  }

  const matchedFamily = AI_FAMILY_ENTRIES.find((metadata) => metadata.pattern.test(ai));
  return matchedFamily ? toRuntimeEntry(matchedFamily, ai) : null;
}

export function getGs1AiSpec(ai) {
  const metadata = getGs1AiDictionaryEntry(ai);
  if (!metadata) {
    return null;
  }

  const spec = {
    content: metadata.valueKind,
    variable: metadata.lengthType === VARIABLE
  };
  if (metadata.lengthType === VARIABLE) {
    spec.maxLength = metadata.maxLength;
  } else {
    spec.length = metadata.exactLength;
  }
  if (metadata.checkDigitRule) {
    spec.checkDigit = metadata.checkDigitRule;
  }
  return spec;
}

function entry(ai, label, lengthType, options) {
  return freezeMetadata({
    ai,
    label,
    description: label,
    lengthType,
    separator: lengthType === VARIABLE ? SEPARATOR_WHEN_FOLLOWED : NO_SEPARATOR,
    ...normalizeLengthOptions(lengthType, options)
  });
}

function family(pattern, label, lengthType, options) {
  return freezeMetadata({
    pattern,
    label,
    description: label,
    lengthType,
    separator: lengthType === VARIABLE ? SEPARATOR_WHEN_FOLLOWED : NO_SEPARATOR,
    ...normalizeLengthOptions(lengthType, options)
  });
}

function normalizeLengthOptions(lengthType, options) {
  const normalized = {
    valueKind: options.valueKind,
    checkDigitRule: options.checkDigitRule
  };
  if (lengthType === VARIABLE) {
    normalized.minLength = 1;
    normalized.maxLength = options.maxLength;
  } else {
    normalized.exactLength = options.exactLength;
  }
  return normalized;
}

function toRuntimeEntry(metadata, ai) {
  return Object.freeze({
    ai,
    label: metadata.label,
    description: metadata.description,
    lengthType: metadata.lengthType,
    minLength: metadata.minLength,
    maxLength: metadata.maxLength,
    exactLength: metadata.exactLength,
    valueKind: metadata.valueKind,
    checkDigitRule: metadata.checkDigitRule,
    separator: metadata.separator
  });
}

function freezeMetadata(metadata) {
  return Object.freeze(metadata);
}
