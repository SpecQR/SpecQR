import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateStructuredAppend } from "specqr";

const outputDir = process.argv[2] ?? join(tmpdir(), "specqr-structured-append-example");

await mkdir(outputDir, { recursive: true });

const stringInput = "A".repeat(31);
const binaryInput = Uint8Array.from(Array.from({ length: 31 }, (_, index) => {
  if (index === 0) {
    return 0x00;
  }
  if (index === 30) {
    return 0xff;
  }
  return index;
}));

const stringSet = await writeStructuredAppendSet("string", stringInput, {
  version: 1,
  errorCorrectionLevel: "L",
  mode: "alphanumeric",
  scale: 8,
  margin: 4
});

const binarySet = await writeStructuredAppendSet("binary", binaryInput, {
  version: 1,
  errorCorrectionLevel: "L",
  mode: "byte",
  scale: 8,
  margin: 4
});

await writeFile(join(outputDir, "summary.json"), `${JSON.stringify({
  string: stringSet,
  binary: binarySet
}, null, 2)}\n`);

console.log(`Wrote Structured Append examples to ${outputDir}`);
console.log(`String set: ${stringSet.total} symbols, parity 0x${hexByte(stringSet.parity)}`);
console.log(`Binary set: ${binarySet.total} symbols, parity 0x${hexByte(binarySet.parity)}`);

async function writeStructuredAppendSet(name, input, options) {
  const diagnosticsSet = generateStructuredAppend(input, {
    ...options,
    output: "matrix",
    diagnostics: true
  });
  const svgSet = generateStructuredAppend(input, {
    ...options,
    output: "svg"
  });
  const pngSet = generateStructuredAppend(input, {
    ...options,
    output: "png"
  });

  await Promise.all(svgSet.symbols.map((svg, index) =>
    writeFile(join(outputDir, `${name}-${index + 1}.svg`), svg)
  ));
  await Promise.all(pngSet.symbols.map((png, index) =>
    writeFile(join(outputDir, `${name}-${index + 1}.png`), Buffer.from(png))
  ));

  return {
    total: diagnosticsSet.total,
    parity: diagnosticsSet.parity,
    inputLength: diagnosticsSet.inputLength,
    byteLength: diagnosticsSet.byteLength,
    version: diagnosticsSet.diagnostics.version,
    errorCorrectionLevel: diagnosticsSet.diagnostics.errorCorrectionLevel,
    symbols: diagnosticsSet.diagnostics.symbols.map((symbol) => ({
      index: symbol.index,
      total: symbol.total,
      parity: symbol.parity,
      inputStart: symbol.inputStart,
      inputLength: symbol.inputLength,
      byteStart: symbol.byteStart,
      byteLength: symbol.byteLength,
      version: symbol.version,
      maskPattern: symbol.maskPattern,
      dataBitLength: symbol.dataBitLength,
      capacityBits: symbol.capacityBits,
      remainingBits: symbol.remainingBits
    })),
    warnings: diagnosticsSet.diagnostics.warnings.map((warning) => warning.code)
  };
}

function hexByte(value) {
  return value.toString(16).padStart(2, "0");
}
