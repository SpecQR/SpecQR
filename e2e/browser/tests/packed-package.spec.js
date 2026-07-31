import {
  expect,
  openPackedFixture,
  test
} from "./support.js";

test.beforeEach(async ({ page }) => {
  await openPackedFixture(page);
});

test("packed root generation is deterministic across matrix, SVG, and PNG", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const qr = globalThis.__specqr;
    const options = {
      version: 1,
      errorCorrectionLevel: "L",
      maskPattern: 3,
      mode: "alphanumeric",
      margin: 1,
      scale: 2
    };
    const matrixA = qr.generate("E2E-123", { ...options, output: "matrix" });
    const matrixB = qr.generate("E2E-123", { ...options, output: "matrix" });
    const svgA = qr.generate("E2E-123", { ...options, output: "svg" });
    const svgB = qr.generate("E2E-123", { ...options, output: "svg" });
    const pngA = qr.generate("E2E-123", { ...options, output: "png" });
    const pngB = qr.generate("E2E-123", { ...options, output: "png" });
    const dimensions = readPngDimensions(pngA);
    const resources = performance
      .getEntriesByType("resource")
      .map((entry) => new URL(entry.name).pathname)
      .filter((pathname) => pathname.endsWith(".js"));
    const manifestResponse = await fetch("/packed/fixture-manifest.json");

    return {
      fixture: globalThis.__specqrFixture,
      manifest: await manifestResponse.json(),
      manifestHeader: manifestResponse.headers.get("x-specqr-fixture"),
      matrixSize: matrixA.length,
      matrixDeterministic: JSON.stringify(matrixA) === JSON.stringify(matrixB),
      svgDeterministic: svgA === svgB,
      svgPrefix: svgA.slice(0, 5),
      pngDeterministic: bytesEqual(pngA, pngB),
      pngSignature: Array.from(pngA.subarray(0, 8)),
      pngSize: pngA.length,
      dimensions,
      resources
    };

    function bytesEqual(left, right) {
      return left.length === right.length &&
        left.every((value, index) => value === right[index]);
    }

    function readPngDimensions(bytes) {
      const view = new DataView(
        bytes.buffer,
        bytes.byteOffset,
        bytes.byteLength
      );
      return {
        width: view.getUint32(16),
        height: view.getUint32(20)
      };
    }
  });

  expect(result.fixture.fixtureKind).toBe("npm-pack-installed");
  expect(result.manifest.fixtureKind).toBe("npm-pack-installed");
  expect(result.manifestHeader).toBe("packed-fixture");
  expect(result.manifest.entries).toEqual(result.fixture.entries);
  expect(result.resources.length).toBeGreaterThan(2);
  expect(
    result.resources.every((pathname) =>
      pathname.startsWith("/installed/specqr/")
    )
  ).toBe(true);
  expect(result.matrixSize).toBe(21);
  expect(result.matrixDeterministic).toBe(true);
  expect(result.svgDeterministic).toBe(true);
  expect(result.svgPrefix).toBe("<svg ");
  expect(result.pngDeterministic).toBe(true);
  expect(result.pngSignature).toEqual([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
  ]);
  expect(result.pngSize).toBeGreaterThan(100);
  expect(result.dimensions).toEqual({ width: 46, height: 46 });
});

test("manual Structured Append diagnostics serialize consistently in standard and full modes", async ({ page }) => {
  const result = await page.evaluate(() => {
    const qr = globalThis.__specqr;
    const segments = [{
      mode: "byte",
      data: Uint8Array.from({ length: 31 }, (_, index) => index)
    }];
    const base = {
      version: 1,
      errorCorrectionLevel: "L",
      maskPattern: 1,
      output: "matrix"
    };
    const standardOutput = qr.generateSegmentsStructuredAppend(
      segments,
      base
    );
    const standardDiagnostics = qr.generateSegmentsStructuredAppend(
      segments,
      { ...base, diagnostics: true }
    );
    const objectDefault = qr.generateSegmentsStructuredAppend(
      segments,
      { ...base, diagnostics: {} }
    );
    const fullOutput = qr.QRCode.generateSegmentsStructuredAppend(
      segments,
      {
        ...base,
        diagnostics: {
          splitUnits: "full",
          symbolResults: "output"
        }
      }
    );
    const fullDiagnostics = qr.generateSegmentsStructuredAppend(
      segments,
      {
        ...base,
        diagnostics: { splitUnits: "full" }
      }
    );

    const fullDiagnosticsSummary =
      summarize(fullDiagnostics.diagnostics);
    const firstFullUnit = { ...fullDiagnostics.diagnostics.splitUnits[0] };
    fullDiagnostics.diagnostics.splitUnits[0].unitStart = 99;
    fullDiagnostics.diagnostics.splitUnits.push({
      sourceSegmentIndex: 99,
      mode: "byte",
      unitStart: 0,
      unitLength: 1,
      byteStart: 0,
      byteLength: 1
    });
    const freshFull = qr.generateSegmentsStructuredAppend(segments, {
      ...base,
      diagnostics: { splitUnits: "full" }
    });

    return {
      standard: summarize(standardOutput.diagnostics),
      standardDiagnostics: summarize(standardDiagnostics.diagnostics),
      objectDefault: summarize(objectDefault.diagnostics),
      full: summarize(fullOutput.diagnostics),
      fullDiagnostics: fullDiagnosticsSummary,
      standardOutputMatchesFull:
        JSON.stringify(standardOutput.symbols) ===
        JSON.stringify(fullOutput.symbols),
      diagnosticMatricesMatchOutput:
        JSON.stringify(
          standardDiagnostics.symbols.map((symbol) => symbol.matrix)
        ) === JSON.stringify(standardOutput.symbols),
      fullDiagnosticMatricesMatchOutput:
        JSON.stringify(
          fullDiagnostics.symbols.map((symbol) => symbol.matrix)
        ) === JSON.stringify(fullOutput.symbols),
      mutableUnitStart:
        fullDiagnostics.diagnostics.splitUnits[0].unitStart,
      mutableLength: fullDiagnostics.diagnostics.splitUnits.length,
      freshFirstUnit: freshFull.diagnostics.splitUnits[0],
      firstFullUnit
    };

    function summarize(diagnostics) {
      const clone = structuredClone(diagnostics);
      return {
        detail: diagnostics.splitUnitsDetail,
        count: diagnostics.splitUnitCount,
        hasOwn: Object.hasOwn(diagnostics, "splitUnits"),
        keyPresent: Object.keys(diagnostics).includes("splitUnits"),
        jsonKeyPresent: JSON.stringify(diagnostics)
          .includes("\"splitUnits\":"),
        cloneHasOwn: Object.hasOwn(clone, "splitUnits"),
        splitUnitsLength: diagnostics.splitUnits?.length ?? null,
        cloneSplitUnitsLength: clone.splitUnits?.length ?? null
      };
    }
  });

  for (const standard of [
    result.standard,
    result.standardDiagnostics,
    result.objectDefault
  ]) {
    expect(standard).toEqual({
      detail: "summary",
      count: 31,
      hasOwn: false,
      keyPresent: false,
      jsonKeyPresent: false,
      cloneHasOwn: false,
      splitUnitsLength: null,
      cloneSplitUnitsLength: null
    });
  }
  expect(result.full).toEqual({
    detail: "full",
    count: 31,
    hasOwn: true,
    keyPresent: true,
    jsonKeyPresent: true,
    cloneHasOwn: true,
    splitUnitsLength: 31,
    cloneSplitUnitsLength: 31
  });
  expect(result.fullDiagnostics.detail).toBe("full");
  expect(result.fullDiagnostics.count).toBe(31);
  expect(result.standardOutputMatchesFull).toBe(true);
  expect(result.diagnosticMatricesMatchOutput).toBe(true);
  expect(result.fullDiagnosticMatricesMatchOutput).toBe(true);
  expect(result.mutableUnitStart).toBe(99);
  expect(result.mutableLength).toBe(32);
  expect(result.freshFirstUnit).toEqual(result.firstFullUnit);
});

test("drawToCanvas accepts real canvas and 2D context targets", async ({ page }) => {
  const result = await page.evaluate(() => {
    const qr = globalThis.__specqr;
    const options = {
      version: 1,
      errorCorrectionLevel: "L",
      maskPattern: 0,
      mode: "alphanumeric",
      margin: 1,
      scale: 3,
      foreground: "#112233",
      background: "#ffffff"
    };
    const canvas = document.createElement("canvas");
    const returnedCanvas = qr.drawToCanvas(canvas, "HELLO", options);
    const canvasContext = canvas.getContext("2d");
    const background = Array.from(
      canvasContext.getImageData(1, 1, 1, 1).data
    );
    const dark = Array.from(
      canvasContext.getImageData(4, 4, 1, 1).data
    );

    const contextCanvas = document.createElement("canvas");
    const context = contextCanvas.getContext("2d");
    const returnedContext = qr.QRCode.drawToCanvas(
      context,
      "HELLO",
      options
    );

    return {
      canvasReturned: returnedCanvas === canvas,
      contextCanvasReturned: returnedContext === contextCanvas,
      canvasDimensions: [canvas.width, canvas.height],
      contextDimensions: [contextCanvas.width, contextCanvas.height],
      background,
      dark
    };
  });

  expect(result.canvasReturned).toBe(true);
  expect(result.contextCanvasReturned).toBe(true);
  expect(result.canvasDimensions).toEqual([69, 69]);
  expect(result.contextDimensions).toEqual([69, 69]);
  expect(result.background).toEqual([255, 255, 255, 255]);
  expect(result.dark).toEqual([17, 34, 51, 255]);
});

test("browser helpers produce usable Blob, Object URL, and ImageData outputs", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const browser = globalThis.__specqrBrowser;
    const options = {
      version: 1,
      errorCorrectionLevel: "L",
      maskPattern: 2,
      margin: 1,
      scale: 2
    };
    const segments = [{ mode: "alphanumeric", data: "BROWSER" }];
    const blob = browser.toBlob("BROWSER", options);
    const segmentBlob = browser.toBlobFromSegments(segments, options);
    const blobBytes = new Uint8Array(await blob.arrayBuffer());
    const segmentBlobBytes = new Uint8Array(await segmentBlob.arrayBuffer());

    const objectUrl = browser.toObjectURL("BROWSER", options);
    const objectResponse = await fetch(objectUrl);
    const objectBytes = new Uint8Array(await objectResponse.arrayBuffer());
    URL.revokeObjectURL(objectUrl);

    const segmentObjectUrl = browser.toObjectURLFromSegments(
      segments,
      options
    );
    const segmentObjectResponse = await fetch(segmentObjectUrl);
    const segmentObjectBytes = new Uint8Array(
      await segmentObjectResponse.arrayBuffer()
    );
    URL.revokeObjectURL(segmentObjectUrl);

    const imageData = browser.toImageData("BROWSER", options);
    const segmentImageData = browser.toImageDataFromSegments(
      segments,
      options
    );
    const transparent = browser.toImageData("BROWSER", {
      ...options,
      foreground: "#000000",
      background: "#ffffff00"
    });

    return {
      blob: summarizePng(blob, blobBytes),
      segmentBlob: summarizePng(segmentBlob, segmentBlobBytes),
      object: summarizePng(objectResponse, objectBytes),
      segmentObject: summarizePng(
        segmentObjectResponse,
        segmentObjectBytes
      ),
      imageData: summarizeImageData(imageData),
      segmentImageData: summarizeImageData(segmentImageData),
      transparentBackground: Array.from(transparent.data.subarray(0, 4)),
      transparentDark: pixelAt(transparent, 3, 3)
    };

    function summarizePng(source, bytes) {
      const view = new DataView(
        bytes.buffer,
        bytes.byteOffset,
        bytes.byteLength
      );
      return {
        type: source instanceof Blob
          ? source.type
          : source.headers.get("content-type"),
        size: bytes.length,
        signature: Array.from(bytes.subarray(0, 8)),
        width: view.getUint32(16),
        height: view.getUint32(20)
      };
    }

    function summarizeImageData(value) {
      return {
        width: value.width,
        height: value.height,
        rgbaLength: value.data.length,
        background: Array.from(value.data.subarray(0, 4)),
        dark: pixelAt(value, 3, 3)
      };
    }

    function pixelAt(value, x, y) {
      const offset = (y * value.width + x) * 4;
      return Array.from(value.data.subarray(offset, offset + 4));
    }
  });

  for (const output of [
    result.blob,
    result.segmentBlob,
    result.object,
    result.segmentObject
  ]) {
    expect(output.type).toBe("image/png");
    expect(output.size).toBeGreaterThan(100);
    expect(output.signature).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
    ]);
    expect([output.width, output.height]).toEqual([46, 46]);
  }
  for (const output of [result.imageData, result.segmentImageData]) {
    expect([output.width, output.height]).toEqual([46, 46]);
    expect(output.rgbaLength).toBe(46 * 46 * 4);
    expect(output.background).toEqual([255, 255, 255, 255]);
    expect(output.dark).toEqual([0, 0, 0, 255]);
  }
  expect(result.transparentBackground).toEqual([255, 255, 255, 0]);
  expect(result.transparentDark).toEqual([0, 0, 0, 255]);
});

test("binary view offsets, resource failures, and Kanji capability are explicit", async ({ page, browserName }, testInfo) => {
  const result = await page.evaluate(() => {
    const qr = globalThis.__specqr;
    const browser = globalThis.__specqrBrowser;
    const bytes = Uint8Array.from([0xaa, 0x41, 0x42, 0x43, 0xbb]);
    const view = new DataView(bytes.buffer, 1, 3);
    const binaryOptions = {
      version: 1,
      errorCorrectionLevel: "L",
      maskPattern: 1,
      output: "matrix"
    };
    const viewMatrix = qr.generate(view, binaryOptions);
    const expectedMatrix = qr.generate(
      Uint8Array.from([0x41, 0x42, 0x43]),
      binaryOptions
    );

    let geometryError;
    try {
      browser.toImageData("A", {
        version: 1,
        margin: 0,
        scale: 2048
      });
    } catch (error) {
      geometryError = {
        instance: error instanceof qr.InvalidInputError,
        name: error.name,
        code: error.code,
        message: error.message
      };
    }

    let kanji;
    try {
      const generated = qr.generate("漢字", {
        mode: "kanji",
        version: 1,
        errorCorrectionLevel: "M",
        diagnostics: true
      });
      kanji = {
        capability: "kanji-mode",
        mode: generated.diagnostics.mode,
        inputBytes: generated.diagnostics.inputBytes
      };
    } catch (error) {
      const fallback = qr.generate("漢字", {
        mode: "auto",
        version: 1,
        errorCorrectionLevel: "M",
        diagnostics: true
      });
      kanji = {
        capability: "documented-fallback",
        errorInstance: error instanceof qr.InvalidModeError,
        errorCode: error.code,
        errorMessage: error.message,
        fallbackMode: fallback.diagnostics.mode
      };
    }

    return {
      offsetMatches:
        JSON.stringify(viewMatrix) === JSON.stringify(expectedMatrix),
      geometryError,
      kanji
    };
  });

  expect(result.offsetMatches).toBe(true);
  expect(result.geometryError).toEqual({
    instance: true,
    name: "InvalidInputError",
    code: "INVALID_INPUT",
    message:
      "Render geometry for image-data exceeds the deterministic budget: pixelCount=1849688064, limit=4194304"
  });

  testInfo.annotations.push({
    type: "kanji-capability",
    description: `${browserName}:${result.kanji.capability}`
  });
  if (result.kanji.capability === "kanji-mode") {
    expect(result.kanji.mode).toBe("kanji");
    expect(result.kanji.inputBytes).toBe(6);
  } else {
    expect(result.kanji.errorInstance).toBe(true);
    expect(result.kanji.errorCode).toBe("INVALID_MODE");
    expect(result.kanji.errorMessage).toMatch(
      /^kanji mode cannot encode character:/
    );
    expect(result.kanji.fallbackMode).toBe("byte");
  }
});
