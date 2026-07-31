import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeManualSegments } from "../src/encoding/modes.js";
import { normalizeOptions } from "../src/options.js";
import {
  selectPlanForInput,
  selectPlanForManualSegments
} from "../src/internal/planning.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(root, "src");

test("public facade does not contain planning, build, render, or Structured Append orchestration", () => {
  const source = readFileSync(path.join(srcRoot, "index.js"), "utf8");
  for (const implementationDetail of [
    "buildMatrix",
    "encodeSegments",
    "interleaveCodewords",
    "selectPlanForInput",
    "selectStructuredAppendSplit",
    "createArtifactDiagnostics",
    "renderPng",
    "renderSvg"
  ]) {
    assert.equal(
      source.includes(implementationDetail),
      false,
      `src/index.js must not contain internal implementation detail ${implementationDetail}`
    );
  }
});

test("source module import graph is acyclic", () => {
  const files = listJavaScriptFiles(srcRoot);
  const graph = new Map(files.map((file) => [file, getLocalDependencies(file)]));
  const complete = new Set();
  const active = new Set();
  const stack = [];

  function visit(file) {
    if (complete.has(file)) {
      return;
    }
    if (active.has(file)) {
      const cycleStart = stack.indexOf(file);
      const cycle = [...stack.slice(cycleStart), file]
        .map((item) => path.relative(root, item))
        .join(" -> ");
      assert.fail(`source module cycle detected: ${cycle}`);
    }

    active.add(file);
    stack.push(file);
    for (const dependency of graph.get(file) ?? []) {
      if (graph.has(dependency)) {
        visit(dependency);
      }
    }
    stack.pop();
    active.delete(file);
    complete.add(file);
  }

  for (const file of files) {
    visit(file);
  }
});

test("selected planning artifacts and their segment collections are immutable", () => {
  const options = normalizeOptions({
    version: 2,
    errorCorrectionLevel: "M",
    maskPattern: 1,
    output: "matrix"
  });
  const inputPlan = selectPlanForInput("IMMUTABLE-123", options);
  const segmentPlan = selectPlanForManualSegments(
    normalizeManualSegments([
      { mode: "alphanumeric", data: "IMMUTABLE-" },
      { mode: "numeric", data: "123" }
    ]),
    options
  );

  for (const plan of [inputPlan, segmentPlan]) {
    assert.equal(Object.isFrozen(plan), true);
    assert.equal(Object.isFrozen(plan.segments), true);
  }
});

function listJavaScriptFiles(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return listJavaScriptFiles(entryPath);
      }
      return entry.isFile() && entry.name.endsWith(".js") ? [entryPath] : [];
    })
    .sort();
}

function getLocalDependencies(file) {
  const source = readFileSync(file, "utf8");
  const dependencies = [];
  const pattern = /\b(?:import|export)\s+(?:[^;]*?\s+from\s+)?["'](\.[^"']+)["'];/gs;
  for (const match of source.matchAll(pattern)) {
    dependencies.push(path.resolve(path.dirname(file), match[1]));
  }
  return dependencies;
}
