export class BitBuffer {
  #bits = [];

  get length() {
    return this.#bits.length;
  }

  append(value, bitLength) {
    if (!Number.isInteger(bitLength) || bitLength < 0 || bitLength > 31) {
      throw new RangeError(`Bit length must be from 0 to 31; got ${bitLength}`);
    }
    if (!Number.isInteger(value) || value < 0 || value >>> bitLength !== 0) {
      throw new RangeError(`Value ${value} does not fit in ${bitLength} bits`);
    }

    for (let i = bitLength - 1; i >= 0; i -= 1) {
      this.#bits.push(((value >>> i) & 1) !== 0);
    }
  }

  appendBits(bits) {
    for (const bit of bits) {
      this.#bits.push(Boolean(bit));
    }
  }

  getBit(index) {
    if (!Number.isInteger(index) || index < 0 || index >= this.#bits.length) {
      throw new RangeError(`Bit index out of range: ${index}`);
    }
    return this.#bits[index];
  }

  toBytes(targetLength) {
    if (this.#bits.length % 8 !== 0) {
      throw new Error("Bit length must be a multiple of 8 before converting to bytes");
    }

    const bytes = [];
    for (let i = 0; i < this.#bits.length; i += 8) {
      let value = 0;
      for (let j = 0; j < 8; j += 1) {
        value = (value << 1) | (this.#bits[i + j] ? 1 : 0);
      }
      bytes.push(value);
    }

    if (targetLength !== undefined && bytes.length !== targetLength) {
      throw new Error(`Expected ${targetLength} bytes; got ${bytes.length}`);
    }

    return bytes;
  }
}
