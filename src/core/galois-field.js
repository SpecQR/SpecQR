const REDUCTION_POLYNOMIAL = 0x11D;

export function multiply(a, b) {
  assertByte(a);
  assertByte(b);

  let result = 0;
  for (let i = 0; i < 8; i += 1) {
    if ((b & 1) !== 0) {
      result ^= a;
    }

    const carry = (a & 0x80) !== 0;
    a = (a << 1) & 0xFF;
    if (carry) {
      a ^= REDUCTION_POLYNOMIAL & 0xFF;
    }
    b >>>= 1;
  }

  return result;
}

export function pow(base, exponent) {
  assertByte(base);
  if (!Number.isInteger(exponent) || exponent < 0) {
    throw new RangeError(`Exponent must be a non-negative integer; got ${exponent}`);
  }

  let result = 1;
  for (let i = 0; i < exponent; i += 1) {
    result = multiply(result, base);
  }
  return result;
}

function assertByte(value) {
  if (!Number.isInteger(value) || value < 0 || value > 0xFF) {
    throw new RangeError(`Expected byte value; got ${value}`);
  }
}
