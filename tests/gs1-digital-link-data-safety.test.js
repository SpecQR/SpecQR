import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  InvalidGs1Error,
  QRCode,
  createGs1DigitalLink,
  normalizeGs1DigitalLink,
  parseGs1DigitalLink,
  validateGs1DigitalLink
} from "../src/index.js";

const primary = { ai: "01", value: "04912345678904" };
const baseUrl = "https://example.com";
const primaryUri = `${baseUrl}/01/${primary.value}`;

function assertDotPathRejected(uri, options) {
  for (const parse of [parseGs1DigitalLink, normalizeGs1DigitalLink]) {
    assert.throws(
      () => parse(uri, options),
      (error) => error instanceof InvalidGs1Error && /path values must not be dot segments/u.test(error.message),
      uri
    );
  }
  const validation = validateGs1DigitalLink(uri, options);
  assert.equal(validation.ok, false, uri);
  assert.equal(validation.errors.length, 1);
  assert.equal(validation.errors[0].code, "GS1_INVALID_DIGITAL_LINK_PLACEMENT");
  assert.equal(validation.errors[0].reason, "invalid-digital-link-placement");
  assert.deepEqual(validation.warnings, []);
}

test("Digital Link builder rejects dot-only path values but allows explicit query placement", () => {
  for (const ai of ["10", "21"]) {
    for (const value of [".", ".."]) {
      const elements = [primary, { ai, value }];
      for (const options of [{ baseUrl }, { baseUrl, pathAis: [ai] }]) {
        assert.throws(
          () => createGs1DigitalLink(elements, options),
          (error) => error instanceof InvalidGs1Error && /pathAis: \[\]/u.test(error.message)
        );
      }
      const uri = createGs1DigitalLink(elements, { baseUrl, pathAis: [] });
      assert.equal(uri, `${primaryUri}?${ai}=${value}`);
      assert.deepEqual(parseGs1DigitalLink(uri).elements, elements);
      assert.equal(validateGs1DigitalLink(uri).ok, true);
    }
  }
  assert.equal(
    createGs1DigitalLink([primary, { ai: "10", value: ".." }, { ai: "21", value: "SER.1" }], {
      baseUrl, pathAis: ["21"]
    }),
    `${primaryUri}/21/SER.1?10=..`
  );
});

test("Digital Link APIs reject literal, encoded and mixed dot segments without erasing payload", () => {
  for (const dots of [".", "..", "%2e", "%2E", ".%2e", "%2E.", "%2e%2E"]) {
    assertDotPathRejected(`${primaryUri}/10/${dots}`);
    assertDotPathRejected(`${primaryUri}/${dots}/10/LOT`);
    assertDotPathRejected(`${primaryUri}/10/${dots}/21/SERIAL`);
  }
  assertDotPathRejected(`${baseUrl}/01/./../01/${primary.value}`);
  assertDotPathRejected(`${baseUrl}/01/../prefix/01/${primary.value}`);
  assertDotPathRejected(`${baseUrl}/00/%2e%2e/01/${primary.value}`);
  assertDotPathRejected(`${baseUrl}/414/.%2E/01/${primary.value}`);
});

test("Digital Link raw-path guard follows WHATWG whitespace and HTTP path separators", () => {
  const uris = [
    `https:example.com/01/${primary.value}/10/..`,
    `HTTPS:////example.com/01/${primary.value}/10/%2e%2E`,
    `https:\\example.com\\01\\${primary.value}\\10\\..`,
    `https://example.com/01/${primary.value}/10\\..`,
    `https://example.com/0\t1/${primary.value}/10/.\n.`,
    `https://example.com/01/${primary.value}/10/%2\re%2e`,
    `\u0000 \thttps://example.com/01/${primary.value}/10/.. \u001f`
  ];
  for (const uri of uris) assertDotPathRejected(uri);
});

test("Digital Link normalizer retains dot-only query qualifiers and remains idempotent", () => {
  for (const value of [".", "..", "%2e", "%2e%2E"]) {
    const uri = `${primaryUri}?10=${value}&21=SER%2F1&17=251231&foo=one&foo=two`;
    const decoded = decodeURIComponent(value);
    const expected = `${primaryUri}/21/SER%2F1?10=${decoded}&17=251231&foo=one&foo=two`;
    assert.equal(normalizeGs1DigitalLink(uri), expected);
    assert.equal(normalizeGs1DigitalLink(expected), expected);
    assert.deepEqual(parseGs1DigitalLink(expected).queryElements, [
      { ai: "10", value: decoded }, { ai: "17", value: "251231" }
    ]);
    assert.deepEqual(parseGs1DigitalLink(expected).unknownQuery, [
      { key: "foo", value: "one" }, { key: "foo", value: "two" }
    ]);
  }
  const allDots = `${primaryUri}?21=..&10=.&note=../..`;
  assert.equal(normalizeGs1DigitalLink(allDots), `${primaryUri}?10=.&21=..&note=..%2F..`);
});

test("Digital Link prefix and base URL dot normalization remains unchanged", () => {
  const prefixes = [
    ["prefix/../base", "base"],
    ["prefix/%2e%2e/base", "base"],
    ["prefix/./base", "prefix/base"],
    ["prefix/%2E/base", "prefix/base"],
    ["prefix/%zz/../base", "prefix/base"],
    ["prefix/%ff/base", "prefix/%ff/base"],
    ["../base", "base"],
    ["%30%31/../base", "base"]
  ];
  for (const [prefix, normalizedPrefix] of prefixes) {
    const uri = `${baseUrl}/${prefix}/01/${primary.value}`;
    const expected = `${baseUrl}/${normalizedPrefix}/01/${primary.value}`;
    assert.deepEqual(parseGs1DigitalLink(uri).elements, [primary]);
    assert.equal(validateGs1DigitalLink(uri).ok, true);
    assert.equal(normalizeGs1DigitalLink(uri), expected);
    assert.equal(createGs1DigitalLink([primary], { baseUrl: `${baseUrl}/${prefix}/` }), expected);
  }
  // A builder base is explicitly a prefix, including a segment resembling an AI.
  assert.equal(createGs1DigitalLink([primary], { baseUrl: `${baseUrl}/01/../base` }),
    `${baseUrl}/base/01/${primary.value}`);
});

test("Digital Link guard honors an explicit primary AI when identifying the payload start", () => {
  const uri = `${baseUrl}/00/../base/01/${primary.value}`;
  assert.deepEqual(parseGs1DigitalLink(uri, { primaryAi: "01" }).elements, [primary]);
  assert.equal(validateGs1DigitalLink(uri, { primaryAi: "01" }).ok, true);
  assert.equal(normalizeGs1DigitalLink(uri, { primaryAi: "01" }), `${baseUrl}/base/01/${primary.value}`);
  assertDotPathRejected(uri);
  assertDotPathRejected(`${baseUrl}/01/../00/195201234567891232/01/${primary.value}`, { primaryAi: "01" });
});

test("Digital Link data containing additional dots or escaped percent signs stays intact", () => {
  for (const value of ["...", "....", ".LOT", "LOT.", "A..B", "%2e", "%2e%2e", "./LOT", "../LOT"]) {
    const elements = [primary, { ai: "10", value }];
    const uri = createGs1DigitalLink(elements, { baseUrl });
    assert.deepEqual(parseGs1DigitalLink(uri).elements, elements);
    assert.equal(validateGs1DigitalLink(uri).ok, true);
    assert.equal(normalizeGs1DigitalLink(uri), uri);
  }
  assert.equal(normalizeGs1DigitalLink(`${primaryUri}/10/.%2e.`), `${primaryUri}/10/...`);
  assert.equal(normalizeGs1DigitalLink(`${primaryUri}/10/%252e`), `${primaryUri}/10/%252e`);
  assert.equal(normalizeGs1DigitalLink(`${primaryUri}?10=LOT&url=/01/../`),
    `${primaryUri}/10/LOT?url=%2F01%2F..%2F`);
});

test("Digital Link malformed percent and Unicode handling retains the existing API policies", () => {
  const malformedQuery = `${primaryUri}?note=%zz`;
  assert.deepEqual(parseGs1DigitalLink(malformedQuery).unknownQuery, [{ key: "note", value: "%zz" }]);
  assert.equal(validateGs1DigitalLink(malformedQuery).errors[0].code, "GS1_INVALID_PERCENT_ENCODING");
  assert.throws(() => normalizeGs1DigitalLink(malformedQuery), /valid percent-encoding/u);
  for (const value of ["%zz", "%ff", "%E0%A4%A"]) {
    assert.throws(() => parseGs1DigitalLink(`${primaryUri}/10/${value}`), /valid percent-encoding/u);
  }
  const unicode = `https://例え.テスト/名前/../製品/01/${primary.value}?note=%ff&symbol=☃`;
  assert.deepEqual(parseGs1DigitalLink(unicode).unknownQuery, [
    { key: "note", value: "�" }, { key: "symbol", value: "☃" }
  ]);
  assert.equal(validateGs1DigitalLink(unicode).ok, true);
  assert.equal(normalizeGs1DigitalLink(unicode),
    `https://xn--r8jz45g.xn--zckzah/%E8%A3%BD%E5%93%81/01/${primary.value}?note=%EF%BF%BD&symbol=%E2%98%83`);
  for (const uri of ["not a URL", `https://[bad]/01/${primary.value}`, `ftp://example.com/01/${primary.value}`]) {
    assert.equal(validateGs1DigitalLink(uri).errors[0].code, "GS1_DIGITAL_LINK_INVALID_URI");
  }
});

test("Digital Link URL object inputs retain their already-normalized meaning", () => {
  const url = new URL(`${primaryUri}/10/..`);
  assert.equal(url.href, `${primaryUri}/`);
  assert.deepEqual(parseGs1DigitalLink(url).elements, [primary]);
  assert.equal(validateGs1DigitalLink(url).ok, true);
  assert.equal(normalizeGs1DigitalLink(url), primaryUri);
  assert.equal(url.href, `${primaryUri}/`);
  for (const api of [parseGs1DigitalLink, validateGs1DigitalLink, normalizeGs1DigitalLink]) {
    let calls = 0;
    const source = { toString() { calls++; return `${primaryUri}?10=..`; } };
    api(source);
    assert.equal(calls, 1);
  }
});

test("Digital Link static helpers expose the same data-safety behavior", () => {
  assert.throws(() => QRCode.createGs1DigitalLink([primary, { ai: "10", value: ".." }], { baseUrl }),
    /dot segments/u);
  assert.throws(() => QRCode.parseGs1DigitalLink(`${primaryUri}/10/..`), /dot segments/u);
  assert.equal(QRCode.validateGs1DigitalLink(`${primaryUri}/10/..`).errors[0].code,
    "GS1_INVALID_DIGITAL_LINK_PLACEMENT");
  assert.equal(QRCode.normalizeGs1DigitalLink(`${primaryUri}?10=..`), `${primaryUri}?10=..`);
});

test("Digital Link raw-path inspection handles large embedded space runs within a bounded process", () => {
  const moduleUrl = new URL("../src/gs1/digital-link.js", import.meta.url).href;
  const script = `
    import assert from "node:assert/strict";
    import { parseGs1DigitalLink, validateGs1DigitalLink, normalizeGs1DigitalLink } from ${JSON.stringify(moduleUrl)};
    const primary = { ai: "01", value: "04912345678904" };
    const spaces = " ".repeat(262144);
    const uri = "https://example.com/" + spaces + "/01/" + primary.value;
    assert.deepEqual(parseGs1DigitalLink(uri).elements, [primary]);
    assert.equal(validateGs1DigitalLink(uri).ok, true);
    assert.equal(normalizeGs1DigitalLink(uri),
      "https://example.com/" + "%20".repeat(spaces.length) + "/01/" + primary.value);
  `;
  // A child-process deadline bounds synchronous regex regressions without relying
  // on a brittle wall-clock threshold for individual calls on slower CI hosts.
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", script], {
    encoding: "utf8",
    timeout: 5000,
    maxBuffer: 1024 * 1024
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
});
