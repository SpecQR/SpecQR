import { InvalidOutputError } from "../errors.js";
import { renderPng, renderPngDataUrl } from "../render/png.js";
import { renderSvg, renderSvgDataUrl } from "../render/svg.js";
import { buildResultArtifact } from "./build.js";
import { createArtifactDiagnostics } from "./diagnostics-adapter.js";

export function renderResult(plan, options, inputBytes) {
  const artifact = buildResultArtifact(plan, options);
  return renderResultArtifact(artifact, options, inputBytes);
}

export function renderResultArtifact(artifact, options, inputBytes, diagnostics = undefined) {
  const { built } = artifact;
  if (options.diagnostics) {
    return {
      matrix: built.matrix,
      svg: renderSvg(built.matrix, options),
      diagnostics: diagnostics ?? createArtifactDiagnostics(artifact, options, inputBytes)
    };
  }

  switch (options.output) {
    case "matrix":
      return built.matrix;
    case "svg":
      return renderSvg(built.matrix, options);
    case "svg-data-url":
      return renderSvgDataUrl(built.matrix, options);
    case "png":
      return renderPng(built.matrix, options);
    case "png-data-url":
      return renderPngDataUrl(built.matrix, options);
    default:
      throw new InvalidOutputError(`Unsupported output: ${options.output}`);
  }
}
