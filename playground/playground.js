import { createGs1ElementString, parseGs1HumanReadable, QRCode } from "../src/index.js";
import { toObjectURL } from "../src/browser.js";

const input = document.querySelector("#qr-input");
const kind = document.querySelector("#qr-kind");
const ecc = document.querySelector("#qr-ecc");
const scale = document.querySelector("#qr-scale");
const margin = document.querySelector("#qr-margin");
const preview = document.querySelector("#qr-preview");
const errorBox = document.querySelector("#qr-error");
const diagnostics = document.querySelector("#qr-diagnostics");
const warnings = document.querySelector("#qr-warnings");
const downloadSvg = document.querySelector("#download-svg");
const downloadPng = document.querySelector("#download-png");

let svgUrl = null;
let pngUrl = null;

for (const element of [input, kind, ecc, scale, margin]) {
  element.addEventListener("input", render);
  element.addEventListener("change", render);
}

kind.addEventListener("change", () => {
  if (kind.value === "gs1" && input.value === "https://github.com/SpecQR/SpecQR") {
    input.value = "(01)04912345678904(17)251231(10)LOT-A";
  }
  render();
});

render();

function render() {
  revokeDownloads();

  try {
    const data = getInputData();
    const options = {
      errorCorrectionLevel: ecc.value,
      scale: Number(scale.value),
      margin: Number(margin.value),
      output: "matrix",
      diagnostics: true,
      gs1: kind.value === "gs1"
    };
    const result = QRCode.generate(data, options);
    const downloadOptions = {
      ...options,
      diagnostics: false
    };

    preview.innerHTML = result.svg;
    errorBox.hidden = true;
    errorBox.textContent = "";
    renderDiagnostics(result.diagnostics);
    renderWarnings(result.diagnostics.warnings);
    updateDownloads(result.svg, data, downloadOptions);
  } catch (error) {
    preview.innerHTML = "";
    diagnostics.innerHTML = "";
    warnings.innerHTML = "";
    errorBox.hidden = false;
    errorBox.textContent = error instanceof Error ? error.message : String(error);
    disableDownload(downloadSvg);
    disableDownload(downloadPng);
  }
}

function getInputData() {
  if (kind.value !== "gs1") {
    return input.value;
  }

  return createGs1ElementString(parseGs1HumanReadable(input.value));
}

function renderDiagnostics(details) {
  const rows = [
    ["Version", details.version],
    ["Size", `${details.size} x ${details.size}`],
    ["ECC", details.errorCorrectionLevel],
    ["Mode", details.mode],
    ["Mask", details.maskPattern],
    ["Capacity", `${details.dataBitLength} / ${details.capacityBits} bits`],
    ["Remaining", `${details.remainingBits} bits`],
    ["GS1", details.gs1 ? "yes" : "no"]
  ];

  diagnostics.innerHTML = rows
    .map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value))}</dd>`)
    .join("");
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

function updateDownloads(svg, data, options) {
  svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  pngUrl = toObjectURL(data, options);

  enableDownload(downloadSvg, svgUrl);
  enableDownload(downloadPng, pngUrl);
}

function enableDownload(link, href) {
  link.href = href;
  link.setAttribute("aria-disabled", "false");
}

function disableDownload(link) {
  link.removeAttribute("href");
  link.setAttribute("aria-disabled", "true");
}

function revokeDownloads() {
  for (const url of [svgUrl, pngUrl]) {
    if (url) {
      URL.revokeObjectURL(url);
    }
  }
  svgUrl = null;
  pngUrl = null;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
