import { InvalidGs1Error } from "../errors.js";
import { GS1_FNC1_SEPARATOR, normalizeGs1Element } from "./ai.js";

export function createGs1ElementString(elements) {
  if (!Array.isArray(elements)) {
    throw new InvalidGs1Error("GS1 elements must be an array of { ai, value } objects");
  }
  if (elements.length === 0) {
    throw new InvalidGs1Error("GS1 elements must not be empty");
  }

  return elements
    .map((element, index) => {
      const normalized = normalizeGs1Element(element, index);
      const needsSeparator = normalized.spec.variable && index < elements.length - 1;
      return `${normalized.ai}${normalized.value}${needsSeparator ? GS1_FNC1_SEPARATOR : ""}`;
    })
    .join("");
}
