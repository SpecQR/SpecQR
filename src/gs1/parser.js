import { InvalidGs1Error } from "../errors.js";
import { normalizeGs1Element } from "./ai.js";

export function parseGs1HumanReadable(input) {
  if (typeof input !== "string") {
    throw new InvalidGs1Error("GS1 human-readable input must be a string");
  }
  if (input.length === 0) {
    throw new InvalidGs1Error("GS1 human-readable input must not be empty");
  }

  const elements = [];
  let position = 0;

  while (position < input.length) {
    if (input[position] !== "(") {
      throw new InvalidGs1Error(
        `GS1 human-readable input must contain an AI in parentheses at offset ${position}`
      );
    }

    const close = input.indexOf(")", position + 1);
    if (close === -1) {
      throw new InvalidGs1Error(`GS1 AI starting at offset ${position} is missing a closing parenthesis`);
    }

    const ai = input.slice(position + 1, close);
    const valueStart = close + 1;
    const nextAiStart = input.indexOf("(", valueStart);
    const valueEnd = nextAiStart === -1 ? input.length : nextAiStart;
    const value = input.slice(valueStart, valueEnd);
    const normalized = normalizeGs1Element({ ai, value }, elements.length);

    elements.push({ ai: normalized.ai, value: normalized.value });
    position = valueEnd;
  }

  return elements;
}
