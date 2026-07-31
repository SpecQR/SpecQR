import {
  createGs1ElementString,
  normalizeGs1DigitalLink,
  parseGs1DigitalLink,
  parseGs1HumanReadable,
  QRCode,
  validateGs1DigitalLink
} from "../src/index.js";
import { toObjectURL } from "../src/browser.js";

const input = document.querySelector("#qr-input");
const workflow = document.querySelector("#qr-workflow");
const kind = document.querySelector("#qr-kind");
const digitalLinkPolicy = document.querySelector("#qr-digital-link-policy");
const digitalLinkPolicyControl = document.querySelector("#qr-digital-link-policy-control");
const ecc = document.querySelector("#qr-ecc");
const version = document.querySelector("#qr-version");
const maxSymbols = document.querySelector("#qr-max-symbols");
const maxSymbolsControl = document.querySelector("#qr-max-symbols-control");
const splitDetail = document.querySelector("#qr-split-detail");
const splitDetailControl = document.querySelector("#qr-split-detail-control");
const scale = document.querySelector("#qr-scale");
const margin = document.querySelector("#qr-margin");
const preview = document.querySelector("#qr-preview");
const errorBox = document.querySelector("#qr-error");
const planning = document.querySelector("#qr-planning");
const diagnostics = document.querySelector("#qr-diagnostics");
const warnings = document.querySelector("#qr-warnings");
const downloadSvg = document.querySelector("#download-svg");
const downloadPng = document.querySelector("#download-png");

let objectUrls = [];

populateVersionOptions();

for (const element of [input, digitalLinkPolicy, ecc, version, maxSymbols, splitDetail, scale, margin]) {
  element.addEventListener("input", render);
  element.addEventListener("change", render);
}

kind.addEventListener("change", () => {
  if (kind.value === "gs1" && input.value === "https://github.com/SpecQR/SpecQR") {
    input.value = "(01)04912345678904(17)251231(10)LOT-A";
  } else if (kind.value === "digital-link" && (
    input.value === "https://github.com/SpecQR/SpecQR" ||
    input.value === "(01)04912345678904(17)251231(10)LOT-A"
  )) {
    input.value = "https://example.com/01/04912345678904?17=251231&10=LOT-A&linkType=all";
  }
  render();
});

workflow.addEventListener("change", () => {
  if (workflow.value === "structured" && input.value === "https://github.com/SpecQR/SpecQR") {
    input.value = "A".repeat(31);
  }
  render();
});

render();

function render() {
  revokeDownloads();
  syncModeControls();

  try {
    let handledError = false;
    if (workflow.value === "structured") {
      handledError = renderStructuredAppend();
    } else {
      handledError = renderSingleSymbol();
    }
    if (!handledError) {
      errorBox.hidden = true;
      errorBox.textContent = "";
    }
  } catch (error) {
    preview.classList.remove("preview--set");
    preview.innerHTML = "";
    planning.innerHTML = "";
    diagnostics.innerHTML = "";
    warnings.innerHTML = "";
    errorBox.hidden = false;
    errorBox.textContent = error instanceof Error ? error.message : String(error);
    disableDownload(downloadSvg);
    disableDownload(downloadPng);
  }
}

function renderSingleSymbol() {
  const data = getInputData();
  const digitalLinkSummary = kind.value === "digital-link" ? getDigitalLinkSummary(data) : null;
  const options = {
    ...getBaseOptions(),
    output: "matrix",
    diagnostics: true,
    gs1: kind.value === "gs1"
  };
  const plan = QRCode.estimate(data, options);
  renderPlanning(plan, "Single QR estimate");
  if (!plan.ok) {
    preview.classList.remove("preview--set");
    preview.innerHTML = "";
    renderDiagnostics([
      ["Mode", "Single QR"],
      ["Input kind", getInputKindLabel()],
      ["Status", "data-too-long"]
    ]);
    renderWarnings(plan.warnings);
    errorBox.hidden = false;
    errorBox.textContent = `入力が Version ${plan.selectedVersion ?? plan.maxVersion}-${plan.errorCorrectionLevel} の容量を ${plan.overflowBits} bits 超えています。`;
    disableDownload(downloadSvg);
    disableDownload(downloadPng);
    return true;
  }
  const result = QRCode.generate(data, options);
  const downloadOptions = {
    ...options,
    diagnostics: false
  };

  preview.classList.remove("preview--set");
  preview.innerHTML = result.svg;
  const rows = [
    ["Mode", "Single QR"],
    ["Input kind", getInputKindLabel()],
    ["Version", result.diagnostics.version],
    ["Size", `${result.diagnostics.size} x ${result.diagnostics.size}`],
    ["ECC", result.diagnostics.errorCorrectionLevel],
    ["Segment mode", result.diagnostics.mode],
    ["Mask", result.diagnostics.maskPattern],
    ["Capacity", `${result.diagnostics.dataBitLength} / ${result.diagnostics.capacityBits} bits`],
    ["Remaining", `${result.diagnostics.remainingBits} bits`],
    ["GS1", result.diagnostics.gs1 ? "yes" : "no"]
  ];
  if (digitalLinkSummary) {
    rows.push(
      ["Digital Link validation", "ok"],
      ["Digital Link primary", formatElement(digitalLinkSummary.parsed.primary)],
      ["Digital Link path AIs", formatAiList(digitalLinkSummary.parsed.pathElements)],
      ["Digital Link query AIs", formatAiList(digitalLinkSummary.parsed.queryElements)],
      ["Unknown query", digitalLinkSummary.parsed.unknownQuery.length],
      ["Unknown query policy", digitalLinkPolicy.value],
      ["Normalized URI", digitalLinkSummary.normalized],
      ["Normalization policy", "SpecQR deterministic, not full canonicalization"]
    );
  }
  renderDiagnostics(rows);
  renderWarnings(result.diagnostics.warnings);
  updateSingleDownloads(result.svg, data, downloadOptions);
  return false;
}

function renderStructuredAppend() {
  if (kind.value === "gs1") {
    throw new Error("Structured Append cannot be combined with GS1/FNC1 in this implementation.");
  }

  const data = input.value;
  const options = {
    ...getBaseOptions(),
    maxSymbols: Number(maxSymbols.value)
  };
  renderPlanning(QRCode.estimate(data, getBaseOptions()), "Single-symbol estimate");
  const diagnosticSet = QRCode.generateStructuredAppend(data, {
    ...options,
    output: "matrix",
    diagnostics: true
  });
  const pngSet = QRCode.generateStructuredAppend(data, {
    ...options,
    output: "png"
  });
  const manualDiagnostics = QRCode.generateSegmentsStructuredAppend([
    { mode: "byte", data }
  ], {
    ...options,
    output: "matrix",
    diagnostics: {
      splitUnits: splitDetail.value,
      symbolResults: "diagnostics"
    }
  }).diagnostics;

  preview.classList.add("preview--set");
  preview.innerHTML = "";
  renderStructuredPreview(diagnosticSet, pngSet);
  const rows = [
    ["Mode", "Structured Append"],
    ["Symbols", diagnosticSet.total],
    ["Version", diagnosticSet.diagnostics.version],
    ["ECC", diagnosticSet.diagnostics.errorCorrectionLevel],
    ["Parity", `0x${hexByte(diagnosticSet.parity)}`],
    ["Input", `${diagnosticSet.inputLength} units / ${diagnosticSet.byteLength} bytes`],
    ["Max symbols", diagnosticSet.diagnostics.maxSymbols],
    ["Split", diagnosticSet.diagnostics.splitStrategy],
    ["Manual split detail", manualDiagnostics.splitUnitsDetail],
    ["Manual split units", manualDiagnostics.splitUnitCount]
  ];
  if (manualDiagnostics.splitUnitsDetail === "full") {
    rows.push(["Materialized split units", manualDiagnostics.splitUnits.length]);
  }
  renderDiagnostics(rows);
  renderWarnings(diagnosticSet.diagnostics.warnings);
  disableDownload(downloadSvg);
  disableDownload(downloadPng);
  return false;
}

function getInputData() {
  if (kind.value !== "gs1") {
    return input.value;
  }

  return createGs1ElementString(parseGs1HumanReadable(input.value));
}

function getDigitalLinkSummary(uri) {
  const options = {
    unknownQuery: digitalLinkPolicy.value
  };
  const validation = validateGs1DigitalLink(uri, options);
  if (!validation.ok) {
    const [first] = validation.errors;
    throw new Error(`${first.code}: ${first.message}`);
  }

  return {
    parsed: parseGs1DigitalLink(uri, options),
    normalized: normalizeGs1DigitalLink(uri, options),
    warnings: validation.warnings
  };
}

function getBaseOptions() {
  return {
    errorCorrectionLevel: ecc.value,
    version: version.value === "auto" ? "auto" : Number(version.value),
    scale: Number(scale.value),
    margin: Number(margin.value)
  };
}

function renderStructuredPreview(diagnosticSet, pngSet) {
  diagnosticSet.symbols.forEach((symbol, index) => {
    const summary = diagnosticSet.diagnostics.symbols[index];
    const svgUrl = trackObjectUrl(URL.createObjectURL(new Blob([symbol.svg], { type: "image/svg+xml" })));
    const pngUrl = trackObjectUrl(URL.createObjectURL(new Blob([pngSet.symbols[index]], { type: "image/png" })));
    const card = document.createElement("article");
    card.className = "preview-card";

    const title = document.createElement("h2");
    title.textContent = `Symbol ${summary.index} / ${summary.total}`;

    const image = document.createElement("div");
    image.className = "symbol-image";
    image.innerHTML = symbol.svg;

    const meta = document.createElement("dl");
    meta.className = "symbol-meta";
    appendMeta(meta, "Index", `${summary.index} / ${summary.total}`);
    appendMeta(meta, "Parity", `0x${hexByte(summary.parity)}`);
    appendMeta(meta, "Bytes", `${summary.byteStart}..${summary.byteStart + summary.byteLength}`);
    appendMeta(meta, "Mask", summary.maskPattern);
    appendMeta(meta, "Capacity", `${summary.dataBitLength} / ${summary.capacityBits} bits`);
    appendMeta(meta, "Remaining", `${summary.remainingBits} bits`);

    const actions = document.createElement("div");
    actions.className = "symbol-actions";
    actions.append(
      createDownloadLink(svgUrl, `specqr-structured-${summary.index}.svg`, "SVG"),
      createDownloadLink(pngUrl, `specqr-structured-${summary.index}.png`, "PNG")
    );

    card.append(title, image, meta, actions);
    preview.append(card);
  });
}

function renderDiagnostics(rows) {
  renderDefinitionList(diagnostics, rows);
}

function renderPlanning(result, scopeLabel) {
  const rows = [
    ["Scope", scopeLabel],
    ["Status", result.ok ? "ok" : "data-too-long"],
    ["Selected Version", result.selectedVersion ?? "-"],
    ["Min Version", result.minVersion],
    ["Max Version", result.maxVersion],
    ["ECC", result.errorCorrectionLevel],
    ["Mode", result.mode],
    ["Data bits", result.dataBitLength],
    ["Capacity bits", result.capacityBits],
    ["Remaining", `${result.remainingBits} bits`],
    ["Usage", formatPercent(result.usageRatio)]
  ];
  if (!result.ok) {
    rows.push(
      ["Overflow", `${result.overflowBits} bits`],
      ["Reason", result.reason]
    );
  }
  const referenceVersion = result.selectedVersion ??
    (version.value === "auto" ? result.maxVersion : Number(version.value));
  const referenceCapacity = QRCode.getCapacity({
    version: referenceVersion,
    errorCorrectionLevel: result.errorCorrectionLevel,
    mode: "byte"
  });
  rows.push(["Byte capacity", `${referenceCapacity.maxBytes} bytes at v${referenceVersion}`]);
  renderDefinitionList(planning, rows);
}

function renderDefinitionList(list, rows) {
  list.innerHTML = "";
  for (const [label, value] of rows) {
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = label;
    description.textContent = String(value);
    list.append(term, description);
  }
}

function renderWarnings(items) {
  if (kind.value === "digital-link") {
    const validation = validateGs1DigitalLink(input.value, {
      unknownQuery: digitalLinkPolicy.value
    });
    if (validation.ok) {
      items = [...validation.warnings, ...items];
    }
  }

  if (items.length === 0) {
    warnings.innerHTML = "<li>No warnings</li>";
    return;
  }

  warnings.innerHTML = items
    .map((warning) => `<li><strong>${escapeHtml(warning.code)}</strong>: ${escapeHtml(warning.message)}</li>`)
    .join("");
}

function updateSingleDownloads(svg, data, options) {
  const svgUrl = trackObjectUrl(URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" })));
  const pngUrl = trackObjectUrl(toObjectURL(data, options));

  enableDownload(downloadSvg, svgUrl);
  enableDownload(downloadPng, pngUrl);
}

function createDownloadLink(href, download, label) {
  const link = document.createElement("a");
  link.className = "button button--small";
  link.href = href;
  link.download = download;
  link.textContent = label;
  return link;
}

function appendMeta(list, label, value) {
  const term = document.createElement("dt");
  const description = document.createElement("dd");
  term.textContent = label;
  description.textContent = String(value);
  list.append(term, description);
}

function enableDownload(link, href) {
  link.href = href;
  link.setAttribute("aria-disabled", "false");
}

function disableDownload(link) {
  link.removeAttribute("href");
  link.setAttribute("aria-disabled", "true");
}

function trackObjectUrl(url) {
  objectUrls.push(url);
  return url;
}

function revokeDownloads() {
  for (const url of objectUrls) {
    URL.revokeObjectURL(url);
  }
  objectUrls = [];
}

function syncModeControls() {
  maxSymbolsControl.hidden = workflow.value !== "structured";
  splitDetailControl.hidden = workflow.value !== "structured";
  digitalLinkPolicyControl.hidden = kind.value !== "digital-link";
}

function getInputKindLabel() {
  if (kind.value === "gs1") {
    return "GS1 QR Code / FNC1 first";
  }
  if (kind.value === "digital-link") {
    return "GS1 Digital Link URI / normal URL QR";
  }
  return "Text / URL";
}

function formatElement(element) {
  return element ? `${element.ai}=${element.value}` : "-";
}

function formatAiList(elements) {
  return elements.length === 0 ? "-" : elements.map((element) => element.ai).join(", ");
}

function populateVersionOptions() {
  for (let value = 1; value <= 40; value += 1) {
    const option = document.createElement("option");
    option.value = String(value);
    option.textContent = String(value);
    version.append(option);
  }
}

function hexByte(value) {
  return value.toString(16).padStart(2, "0");
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
