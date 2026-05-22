import { InvalidGs1Error } from "../errors.js";
import { getGs1AiDictionaryEntry } from "./ai-dictionary.js";
import { normalizeGs1Element } from "./ai.js";

const DEFAULT_PRIMARY_AI = "01";
const PRIMARY_KEY = "primary-key";
const KEY_QUALIFIER = "key-qualifier";

export function createGs1DigitalLink(input, options = {}) {
  const elements = normalizeDigitalLinkInput(input);
  const url = normalizeBaseUrl(options.baseUrl);
  const primaryAi = normalizePrimaryAi(options.primaryAi);
  const pathAis = normalizePathAis(options.pathAis, primaryAi);
  const normalizedElements = normalizeElements(elements);
  const primary = getPrimaryElement(normalizedElements, primaryAi);
  const pathElements = normalizedElements.filter((element) =>
    element.ai !== primaryAi && shouldPlaceInPath(element.ai, primaryAi, pathAis)
  );
  const queryElements = normalizedElements
    .filter((element) => element.ai !== primaryAi && !shouldPlaceInPath(element.ai, primaryAi, pathAis))
    .sort((a, b) => a.ai.localeCompare(b.ai) || a.value.localeCompare(b.value));

  url.pathname = buildPath(url.pathname, [primary, ...pathElements]);
  url.search = "";
  for (const element of queryElements) {
    url.searchParams.append(element.ai, element.value);
  }

  return url.toString();
}

export function parseGs1DigitalLink(uri, options = {}) {
  const url = normalizeDigitalLinkUri(uri);
  const primaryAi = options.primaryAi === undefined ? null : normalizePrimaryAi(options.primaryAi);
  const unknownQueryPolicy = normalizeUnknownQueryPolicy(options.unknownQuery);
  const pathElements = parsePathElements(url, primaryAi);
  const queryElements = [];
  const unknownQuery = [];
  const seen = new Set(pathElements.map((element) => element.ai));

  for (const [key, value] of url.searchParams) {
    if (isGs1AiKey(key)) {
      const element = normalizeDigitalLinkElement({ ai: key, value }, pathElements.length + queryElements.length);
      rejectDuplicateAi(seen, element.ai);
      seen.add(element.ai);
      queryElements.push(element);
    } else if (unknownQueryPolicy === "preserve") {
      unknownQuery.push({ key, value });
    } else {
      throw new InvalidGs1Error(`GS1 Digital Link query parameter ${JSON.stringify(key)} is not a GS1 AI`);
    }
  }

  const primary = pathElements[0] ?? null;
  return {
    elements: [...pathElements, ...queryElements],
    primary,
    pathElements,
    queryElements,
    unknownQuery
  };
}

function normalizeDigitalLinkInput(input) {
  if (Array.isArray(input)) {
    return input;
  }
  if (input && typeof input === "object" && Array.isArray(input.elements)) {
    return input.elements;
  }
  throw new InvalidGs1Error(
    "GS1 Digital Link input must be an array of { ai, value } objects or a parseGs1ElementString() result"
  );
}

function normalizeBaseUrl(baseUrl) {
  if (baseUrl === undefined || baseUrl === null || baseUrl === "") {
    throw new InvalidGs1Error("GS1 Digital Link options.baseUrl is required");
  }

  let url;
  try {
    url = baseUrl instanceof URL ? new URL(baseUrl.href) : new URL(String(baseUrl));
  } catch {
    throw new InvalidGs1Error("GS1 Digital Link options.baseUrl must be a valid http or https URL");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new InvalidGs1Error("GS1 Digital Link options.baseUrl must use http or https");
  }
  if (url.search || url.hash) {
    throw new InvalidGs1Error("GS1 Digital Link options.baseUrl must not include query or fragment components");
  }

  return url;
}

function normalizeDigitalLinkUri(uri) {
  let url;
  try {
    url = uri instanceof URL ? new URL(uri.href) : new URL(String(uri));
  } catch {
    throw new InvalidGs1Error("GS1 Digital Link URI must be an absolute http or https URL");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new InvalidGs1Error("GS1 Digital Link URI must use http or https");
  }
  if (url.hash) {
    throw new InvalidGs1Error("GS1 Digital Link URI must not include a fragment");
  }

  return url;
}

function normalizePrimaryAi(primaryAi) {
  const normalized = primaryAi === undefined ? DEFAULT_PRIMARY_AI : primaryAi;
  if (typeof normalized !== "string" || !isPrimaryAi(normalized)) {
    throw new InvalidGs1Error("GS1 Digital Link primaryAi must be one of 00, 01, or 414");
  }
  return normalized;
}

function normalizeUnknownQueryPolicy(unknownQuery) {
  const normalized = unknownQuery === undefined ? "preserve" : unknownQuery;
  if (normalized !== "preserve" && normalized !== "reject") {
    throw new InvalidGs1Error("GS1 Digital Link unknownQuery must be \"preserve\" or \"reject\"");
  }
  return normalized;
}

function normalizePathAis(pathAis, primaryAi) {
  if (pathAis === undefined) {
    return null;
  }
  if (!Array.isArray(pathAis)) {
    throw new InvalidGs1Error("GS1 Digital Link pathAis must be an array of AI strings");
  }

  const normalized = new Set();
  for (const ai of pathAis) {
    if (typeof ai !== "string" || !/^\d{2,4}$/.test(ai)) {
      throw new InvalidGs1Error("GS1 Digital Link pathAis entries must be 2 to 4 digit AI strings");
    }
    if (ai !== primaryAi) {
      assertCanPlaceInPath(ai, primaryAi);
      normalized.add(ai);
    }
  }
  return normalized;
}

function normalizeElements(elements) {
  if (elements.length === 0) {
    throw new InvalidGs1Error("GS1 Digital Link input elements must not be empty");
  }

  const seen = new Set();
  return elements.map((element, index) => {
    const normalized = normalizeDigitalLinkElement(element, index);
    rejectDuplicateAi(seen, normalized.ai);
    seen.add(normalized.ai);
    return normalized;
  });
}

function normalizeDigitalLinkElement(element, index) {
  const normalized = normalizeGs1Element(element, index);
  return {
    ai: normalized.ai,
    value: normalized.value
  };
}

function rejectDuplicateAi(seen, ai) {
  if (seen.has(ai)) {
    throw new InvalidGs1Error(`GS1 Digital Link input must not contain duplicate AI ${ai}`);
  }
}

function getPrimaryElement(elements, primaryAi) {
  const primary = elements.find((element) => element.ai === primaryAi);
  if (!primary) {
    throw new InvalidGs1Error(`GS1 Digital Link input must include primary AI ${primaryAi}`);
  }
  return primary;
}

function parsePathElements(url, primaryAi) {
  const segments = getPathSegments(url.pathname);
  const firstAiIndex = segments.findIndex((segment) => {
    if (primaryAi) {
      return segment === primaryAi;
    }
    return isPrimaryAi(segment);
  });

  if (firstAiIndex === -1) {
    throw new InvalidGs1Error("GS1 Digital Link path must include primary AI 00, 01, or 414");
  }

  const pathSegments = segments.slice(firstAiIndex);
  if (pathSegments.length % 2 !== 0) {
    throw new InvalidGs1Error("GS1 Digital Link path must contain AI/value pairs");
  }

  const elements = [];
  const seen = new Set();
  for (let index = 0; index < pathSegments.length; index += 2) {
    const ai = pathSegments[index];
    if (!isGs1AiKey(ai)) {
      throw new InvalidGs1Error(`GS1 Digital Link path segment ${index + firstAiIndex + 1} must be a GS1 AI`);
    }

    const value = decodePathSegment(pathSegments[index + 1], `value for AI ${ai}`);
    const element = normalizeDigitalLinkElement({ ai, value }, elements.length);
    if (elements.length > 0) {
      assertCanPlaceInPath(element.ai, elements[0].ai);
    }
    rejectDuplicateAi(seen, element.ai);
    seen.add(element.ai);
    elements.push(element);
  }

  return elements;
}

function getPathSegments(pathname) {
  const withoutEdgeSlashes = pathname.replace(/^\/+|\/+$/gu, "");
  if (withoutEdgeSlashes === "") {
    throw new InvalidGs1Error("GS1 Digital Link path must include primary AI 00, 01, or 414");
  }

  const segments = withoutEdgeSlashes.split("/");
  if (segments.some((segment) => segment === "")) {
    throw new InvalidGs1Error("GS1 Digital Link path must not contain empty segments");
  }
  return segments;
}

function buildPath(basePathname, elements) {
  const prefix = stripTrailingSlashes(basePathname);
  const segments = elements.flatMap((element) => [element.ai, element.value].map(encodePathSegment));
  return [prefix, ...segments].filter(Boolean).join("/");
}

function stripTrailingSlashes(pathname) {
  const withoutTrailing = pathname.replace(/\/+$/u, "");
  return withoutTrailing === "" ? "" : withoutTrailing;
}

function encodePathSegment(value) {
  return encodeURIComponent(value);
}

function decodePathSegment(segment, label) {
  try {
    return decodeURIComponent(segment);
  } catch {
    throw new InvalidGs1Error(`GS1 Digital Link path ${label} must be valid percent-encoding`);
  }
}

function isGs1AiKey(key) {
  return /^\d{2,4}$/u.test(key);
}

function shouldPlaceInPath(ai, primaryAi, explicitPathAis) {
  if (explicitPathAis) {
    return explicitPathAis.has(ai);
  }
  return canPlaceInPath(ai, primaryAi);
}

function assertCanPlaceInPath(ai, primaryAi) {
  const metadata = getGs1AiDictionaryEntry(ai);
  if (!metadata) {
    throw new InvalidGs1Error(`Unsupported GS1 AI ${ai}. Add explicit support before using it.`);
  }
  if (!canPlaceInPath(ai, primaryAi, metadata)) {
    throw new InvalidGs1Error(`GS1 AI ${ai} cannot be placed in the Digital Link path after primary AI ${primaryAi}`);
  }
}

function canPlaceInPath(ai, primaryAi, metadata = getGs1AiDictionaryEntry(ai)) {
  return metadata?.digitalLinkRole === KEY_QUALIFIER &&
    Array.isArray(metadata.digitalLinkPathForPrimary) &&
    metadata.digitalLinkPathForPrimary.includes(primaryAi);
}

function isPrimaryAi(ai) {
  return getGs1AiDictionaryEntry(ai)?.digitalLinkRole === PRIMARY_KEY;
}
