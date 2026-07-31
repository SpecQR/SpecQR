import assert from "node:assert/strict";

export const DEFAULT_CONFORMANCE_SEED = 0x5EEDC0DE;
export const DEFAULT_CONFORMANCE_CASES = 32;
export const EXTENDED_CONFORMANCE_CASES = 256;

export function createPrng(seed) {
  let state = normalizeSeed(seed);

  return Object.freeze({
    nextUint32() {
      state = (state + 0x6D2B79F5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return (value ^ (value >>> 14)) >>> 0;
    },

    int(minimum, maximum) {
      assertIntegerRange(minimum, maximum);
      const span = maximum - minimum + 1;
      return minimum + (this.nextUint32() % span);
    },

    boolean(numerator = 1, denominator = 2) {
      if (!Number.isInteger(numerator) || !Number.isInteger(denominator) ||
          numerator < 0 || denominator < 1 || numerator > denominator) {
        throw new RangeError("boolean probability must use integers with 0 <= numerator <= denominator");
      }
      return this.int(1, denominator) <= numerator;
    },

    pick(values) {
      if (!Array.isArray(values) || values.length === 0) {
        throw new RangeError("pick requires a non-empty array");
      }
      return values[this.int(0, values.length - 1)];
    },

    bytes(length) {
      if (!Number.isInteger(length) || length < 0) {
        throw new RangeError("bytes length must be a non-negative integer");
      }
      return Uint8Array.from({ length }, () => this.int(0, 255));
    }
  });
}

export function deriveSeed(seed, ...parts) {
  let value = (normalizeSeed(seed) ^ 0x811C9DC5) >>> 0;
  const text = parts.map((part) => String(part)).join("\x1F");

  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193) >>> 0;
  }

  value ^= value >>> 16;
  value = Math.imul(value, 0x7FEB352D) >>> 0;
  value ^= value >>> 15;
  value = Math.imul(value, 0x846CA68B) >>> 0;
  return (value ^ (value >>> 16)) >>> 0;
}

export function normalizeSeed(value) {
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 0 || value > 0xFFFFFFFF) {
      throw new RangeError(`seed must be an integer from 0 to 0xffffffff; got ${value}`);
    }
    return value >>> 0;
  }

  if (typeof value !== "string" || !/^(?:0x[0-9a-f]+|[0-9]+)$/iu.test(value)) {
    throw new RangeError(`seed must be an unsigned decimal or hexadecimal integer; got ${value}`);
  }

  const parsed = BigInt(value);
  if (parsed < 0n || parsed > 0xFFFFFFFFn) {
    throw new RangeError(`seed must be an integer from 0 to 0xffffffff; got ${value}`);
  }
  return Number(parsed);
}

export function formatSeed(seed) {
  return `0x${normalizeSeed(seed).toString(16).padStart(8, "0")}`;
}

export function parseConformanceArguments(
  argv,
  {
    defaultCases = DEFAULT_CONFORMANCE_CASES,
    extendedCases = EXTENDED_CONFORMANCE_CASES
  } = {}
) {
  let seed = DEFAULT_CONFORMANCE_SEED;
  let cases = defaultCases;
  let casesExplicit = false;
  let caseFilter = null;
  let extended = false;
  let help = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--extended") {
      extended = true;
      continue;
    }
    if (argument === "--help" || argument === "-h") {
      help = true;
      continue;
    }

    const [name, inlineValue] = splitArgument(argument);
    if (name === "--seed") {
      const value = inlineValue ?? argv[++index];
      if (value === undefined) {
        throw new RangeError("--seed requires a value");
      }
      seed = normalizeSeed(value);
      continue;
    }
    if (name === "--cases") {
      const value = inlineValue ?? argv[++index];
      cases = parseCaseCount(value);
      casesExplicit = true;
      continue;
    }
    if (name === "--case") {
      const value = inlineValue ?? argv[++index];
      if (typeof value !== "string" || value.length === 0) {
        throw new RangeError("--case requires a non-empty case ID");
      }
      caseFilter = value;
      continue;
    }

    throw new RangeError(`Unknown conformance argument: ${argument}`);
  }

  if (extended && !casesExplicit) {
    cases = extendedCases;
  }

  return Object.freeze({
    seed,
    cases,
    caseFilter,
    extended,
    help
  });
}

export function createCaseRunner({
  seed,
  cases,
  caseFilter = null,
  script = "verify:conformance:fuzz"
}) {
  let matched = 0;

  return Object.freeze({
    run({ id, suite, descriptor, execute, minimize }) {
      if (caseFilter !== null && caseFilter !== id) {
        return false;
      }
      matched += 1;

      try {
        execute();
      } catch (cause) {
        let minimized = null;
        if (typeof minimize === "function") {
          try {
            minimized = minimize();
          } catch (minimizeError) {
            minimized = {
              unavailable: true,
              reason: minimizeError instanceof Error ? minimizeError.message : String(minimizeError)
            };
          }
        }

        const reproduction = [
          "npm run",
          script,
          "--",
          "--seed",
          formatSeed(seed),
          "--cases",
          String(cases),
          "--case",
          id
        ].join(" ");
        const details = {
          suite,
          caseId: id,
          seed: formatSeed(seed),
          cases,
          descriptor: toSerializable(descriptor),
          minimized: toSerializable(minimized)
        };
        const message = [
          `Deterministic conformance case failed: ${id}`,
          `Reproduce: ${reproduction}`,
          `Case: ${JSON.stringify(details, null, 2)}`,
          `Cause: ${cause instanceof Error ? cause.stack ?? cause.message : String(cause)}`
        ].join("\n");
        const error = new Error(message);
        error.cause = cause;
        throw error;
      }

      return true;
    },

    finish() {
      if (caseFilter !== null && matched === 0) {
        throw new RangeError(`No deterministic conformance case matched --case ${caseFilter}`);
      }
      return matched;
    },

    get matched() {
      return matched;
    }
  });
}

export function minimizeFailingSequence(sequence, stillFails) {
  if (typeof stillFails !== "function") {
    throw new TypeError("stillFails must be a function");
  }

  let current = cloneSequence(sequence);
  if (getSequenceLength(current) <= 1 || !stillFails(current)) {
    return current;
  }

  let granularity = 2;
  while (getSequenceLength(current) > 1) {
    const currentLength = getSequenceLength(current);
    const chunkLength = Math.ceil(currentLength / granularity);
    let reduced = false;

    for (let start = 0; start < currentLength; start += chunkLength) {
      const candidate = removeSequenceRange(current, start, start + chunkLength);
      if (getSequenceLength(candidate) === 0) {
        continue;
      }
      if (stillFails(candidate)) {
        current = candidate;
        granularity = Math.max(2, granularity - 1);
        reduced = true;
        break;
      }
    }

    if (!reduced) {
      const length = getSequenceLength(current);
      if (granularity >= length) {
        break;
      }
      granularity = Math.min(length, granularity * 2);
    }
  }

  return current;
}

export function describeInput(input) {
  if (typeof input === "string") {
    return { type: "string", value: input, codePoints: Array.from(input).length };
  }
  if (input instanceof ArrayBuffer) {
    return { type: "ArrayBuffer", hex: bytesToHex(new Uint8Array(input)) };
  }
  if (ArrayBuffer.isView(input)) {
    return {
      type: input.constructor.name,
      byteOffset: input.byteOffset,
      byteLength: input.byteLength,
      hex: bytesToHex(new Uint8Array(input.buffer, input.byteOffset, input.byteLength))
    };
  }
  if (Array.isArray(input)) {
    return { type: "number[]", values: [...input] };
  }
  return { type: typeof input, value: String(input) };
}

export function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function conformanceUsage(script) {
  return [
    `npm run ${script}`,
    `npm run ${script} -- --seed ${formatSeed(DEFAULT_CONFORMANCE_SEED)} --cases ${DEFAULT_CONFORMANCE_CASES}`,
    `npm run ${script} -- --extended`,
    `npm run ${script} -- --seed ${formatSeed(DEFAULT_CONFORMANCE_SEED)} --cases ${DEFAULT_CONFORMANCE_CASES} --case <case-id>`
  ].join("\n");
}

function splitArgument(argument) {
  const separator = argument.indexOf("=");
  return separator === -1
    ? [argument, null]
    : [argument.slice(0, separator), argument.slice(separator + 1)];
}

function parseCaseCount(value) {
  if (typeof value !== "string" || !/^[0-9]+$/u.test(value)) {
    throw new RangeError(`--cases must be a positive integer; got ${value}`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 100000) {
    throw new RangeError(`--cases must be from 1 to 100000; got ${value}`);
  }
  return parsed;
}

function assertIntegerRange(minimum, maximum) {
  if (!Number.isSafeInteger(minimum) || !Number.isSafeInteger(maximum) || maximum < minimum) {
    throw new RangeError(`invalid integer range ${minimum}..${maximum}`);
  }
  if (maximum - minimum + 1 > 0x100000000) {
    throw new RangeError("integer range must fit within 32 bits");
  }
}

function cloneSequence(sequence) {
  if (typeof sequence === "string") {
    return sequence;
  }
  if (sequence instanceof Uint8Array) {
    return Uint8Array.from(sequence);
  }
  if (Array.isArray(sequence)) {
    return [...sequence];
  }
  throw new TypeError("sequence must be a string, array, or Uint8Array");
}

function removeSequenceRange(sequence, start, end) {
  if (typeof sequence === "string") {
    const characters = Array.from(sequence);
    return [...characters.slice(0, start), ...characters.slice(end)].join("");
  }
  if (sequence instanceof Uint8Array) {
    const result = new Uint8Array(sequence.length - Math.min(sequence.length, end) + start);
    result.set(sequence.subarray(0, start), 0);
    result.set(sequence.subarray(end), start);
    return result;
  }
  return [...sequence.slice(0, start), ...sequence.slice(end)];
}

function getSequenceLength(sequence) {
  return typeof sequence === "string" ? Array.from(sequence).length : sequence.length;
}

function toSerializable(value) {
  if (value === null || value === undefined ||
      typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return describeInput(value);
  }
  if (ArrayBuffer.isView(value)) {
    return describeInput(value);
  }
  if (Array.isArray(value)) {
    return value.map(toSerializable);
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, toSerializable(item)])
    );
  }
  return String(value);
}
