import { createGs1ElementString, parseGs1HumanReadable, QRCode } from "../src/index.js";
import { toObjectURL } from "../src/browser.js";

const input = document.querySelector("#qr-input");
const workflow = document.querySelector("#qr-workflow");
const kind = document.querySelector("#qr-kind");
const ecc = document.querySelector("#qr-ecc");
const version = document.querySelector("#qr-version");
const maxSymbols = document.querySelector("#qr-max-symbols");
const maxSymbolsControl = document.querySelector("#qr-max-symbols-control");
const scale = document.querySelector("#qr-scale");
const margin = document.querySelector("#qr-margin");
const preview = document.querySelector("#qr-preview");
const errorBox = document.querySelector("#qr-error");
const diagnostics = document.querySelector("#qr-diagnostics");
const warnings = document.querySelector("#qr-warnings");
const downloadSvg = document.querySelector("#download-svg");
const downloadPng = document.querySelector("#download-png");

let objectUrls = [];

populateVersionOptions();

for (const element of [input, ecc, version, maxSymbols, scale, margin]) {
  element.addEventListener("input", render);
  element.addEventListener("change", render);
}

kind.addEventListener("change", () => {
  if (kind.value === "gs1" && input.value === "https://github.com/SpecQR/SpecQR") {
    input.value = "(01)04912345678904(17)251231(10)LOT-A";
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
    if (workflow.value === "structured") {
      renderStructuredAppend();
    } else {
      renderSingleSymbol();
    }
    errorBox.hidden = true;
    errorBox.textContent = "";
  } catch (error) {
    preview.classList.remove("preview--set");
    preview.innerHTML = "";
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
  const options = {
    ...getBaseOptions(),
    output: "matrix",
    diagnostics: true,
    gs1: kind.value === "gs1"
  };
  const result = QRCode.generate(data, options);
  const downloadOptions = {
    ...options,
    diagnostics: false
  };

  preview.classList.remove("preview--set");
  preview.innerHTML = result.svg;
  renderDiagnostics([
    ["Mode", "Single QR"],
    ["Version", result.diagnostics.version],
    ["Size", `${result.diagnostics.size} x ${result.diagnostics.size}`],
    ["ECC", result.diagnostics.errorCorrectionLevel],
    ["Segment mode", result.diagnostics.mode],
    ["Mask", result.diagnostics.maskPattern],
    ["Capacity", `${result.diagnostics.dataBitLength} / ${result.diagnostics.capacityBits} bits`],
    ["Remaining", `${result.diagnostics.remainingBits} bits`],
    ["GS1", result.diagnostics.gs1 ? "yes" : "no"]
  ]);
  renderWarnings(result.diagnostics.warnings);
  updateSingleDownloads(result.svg, data, downloadOptions);
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
  const diagnosticSet = QRCode.generateStructuredAppend(data, {
    ...options,
    output: "matrix",
    diagnostics: true
  });
  const pngSet = QRCode.generateStructuredAppend(data, {
    ...options,
    output: "png"
  });

  preview.classList.add("preview--set");
  preview.innerHTML = "";
  renderStructuredPreview(diagnosticSet, pngSet);
  renderDiagnostics([
    ["Mode", "Structured Append"],
    ["Symbols", diagnosticSet.total],
    ["Version", diagnosticSet.diagnostics.version],
    ["ECC", diagnosticSet.diagnostics.errorCorrectionLevel],
    ["Parity", `0x${hexByte(diagnosticSet.parity)}`],
    ["Input", `${diagnosticSet.inputLength} units / ${diagnosticSet.byteLength} bytes`],
    ["Max symbols", diagnosticSet.diagnostics.maxSymbols],
    ["Split", diagnosticSet.diagnostics.splitStrategy]
  ]);
  renderWarnings(diagnosticSet.diagnostics.warnings);
  disableDownload(downloadSvg);
  disableDownload(downloadPng);
}

function getInputData() {
  if (kind.value !== "gs1") {
    return input.value;
  }

  return createGs1ElementString(parseGs1HumanReadable(input.value));
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
  diagnostics.innerHTML = "";
  for (const [label, value] of rows) {
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = label;
    description.textContent = String(value);
    diagnostics.append(term, description);
  }
}

function renderWarnings(items) {
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

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
