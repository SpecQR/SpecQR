import { InvalidGs1Error } from "../errors.js";
import { normalizeGs1Element } from "./ai.js";

const DEFAULT_PRIMARY_AI = "01";
const SUPPORTED_PRIMARY_AIS = new Set(["00", "01", "414"]);
const DEFAULT_PATH_AIS_BY_PRIMARY = new Map([
  ["01", new Set(["10", "21", "22"])]
]);

export function createGs1DigitalLink(input, options = {}) {
  const elements = normalizeDigitalLinkInput(input);
  const url = normalizeBaseUrl(options.baseUrl);
  const primaryAi = normalizePrimaryAi(options.primaryAi);
  const pathAis = normalizePathAis(options.pathAis, primaryAi);
  const normalizedElements = normalizeElements(elements);
  const primary = getPrimaryElement(normalizedElements, primaryAi);
  const pathElements = normalizedElements.filter((element) => element.ai !== primaryAi && pathAis.has(element.ai));
  const queryElements = normalizedElements
    .filter((element) => element.ai !== primaryAi && !pathAis.has(element.ai))
    .sort((a, b) => a.ai.localeCompare(b.ai) || a.value.localeCompare(b.value));

  url.pathname = buildPath(url.pathname, [primary, ...pathElements]);
  url.search = "";
  for (const element of queryElements) {
    url.searchParams.append(element.ai, element.value);
  }

  return url.toString();
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

function normalizePrimaryAi(primaryAi) {
  const normalized = primaryAi === undefined ? DEFAULT_PRIMARY_AI : primaryAi;
  if (typeof normalized !== "string" || !SUPPORTED_PRIMARY_AIS.has(normalized)) {
    throw new InvalidGs1Error("GS1 Digital Link primaryAi must be one of 00, 01, or 414");
  }
  return normalized;
}

function normalizePathAis(pathAis, primaryAi) {
  if (pathAis === undefined) {
    return new Set(DEFAULT_PATH_AIS_BY_PRIMARY.get(primaryAi) ?? []);
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
    const normalized = normalizeGs1Element(element, index);
    if (seen.has(normalized.ai)) {
      throw new InvalidGs1Error(`GS1 Digital Link input must not contain duplicate AI ${normalized.ai}`);
    }
    seen.add(normalized.ai);
    return {
      ai: normalized.ai,
      value: normalized.value
    };
  });
}

function getPrimaryElement(elements, primaryAi) {
  const primary = elements.find((element) => element.ai === primaryAi);
  if (!primary) {
    throw new InvalidGs1Error(`GS1 Digital Link input must include primary AI ${primaryAi}`);
  }
  return primary;
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
