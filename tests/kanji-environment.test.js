import test from "node:test";
import assert from "node:assert/strict";

test("Kanji helpers fall back clearly when Shift_JIS TextDecoder is unavailable", async () => {
  const originalTextDecoder = globalThis.TextDecoder;
  try {
    globalThis.TextDecoder = undefined;
    const suffix = `?no-decoder=${Date.now()}-${Math.random()}`;
    const module = await import(`../src/encoding/shift-jis.js${suffix}`);

    assert.equal(module.canEncodeKanjiModeCharacter("漢"), false);
    assert.throws(
      () => module.assertKanjiModeText("漢"),
      /kanji mode cannot encode/
    );
  } finally {
    globalThis.TextDecoder = originalTextDecoder;
  }
});
