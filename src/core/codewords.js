import { getErrorCorrectionBlockInfo } from "./tables.js";
import { computeRemainder, createGeneratorPolynomial } from "./reed-solomon.js";

export function interleaveCodewords(dataCodewords, version, errorCorrectionLevel) {
  const info = getErrorCorrectionBlockInfo(version, errorCorrectionLevel);
  if (dataCodewords.length !== info.dataCodewords) {
    throw new Error(`Expected ${info.dataCodewords} data codewords; got ${dataCodewords.length}`);
  }

  const generator = createGeneratorPolynomial(info.eccPerBlock);
  const numShortBlocks = info.blocks - (info.rawCodewords % info.blocks);
  const shortBlockLength = Math.floor(info.rawCodewords / info.blocks);
  const shortDataLength = shortBlockLength - info.eccPerBlock;

  const blocks = [];
  let offset = 0;
  for (let i = 0; i < info.blocks; i += 1) {
    const dataLength = shortDataLength + (i < numShortBlocks ? 0 : 1);
    const data = dataCodewords.slice(offset, offset + dataLength);
    offset += dataLength;

    const ecc = computeRemainder(data, generator);
    const interleavable = data.slice();
    if (i < numShortBlocks) {
      interleavable.push(null);
    }
    interleavable.push(...ecc);
    blocks.push({ data, ecc, interleavable });
  }

  const result = [];
  for (let i = 0; i < shortBlockLength + 1; i += 1) {
    for (const block of blocks) {
      const value = block.interleavable[i];
      if (value !== undefined && value !== null) {
        result.push(value);
      }
    }
  }

  if (result.length !== info.rawCodewords) {
    throw new Error(`Expected ${info.rawCodewords} interleaved codewords; got ${result.length}`);
  }

  return {
    codewords: result,
    blocks,
    dataCodewords: info.dataCodewords,
    errorCorrectionCodewords: info.rawCodewords - info.dataCodewords,
    totalCodewords: info.rawCodewords
  };
}
