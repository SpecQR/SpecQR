import { multiply, pow } from "./galois-field.js";

export function createGeneratorPolynomial(degree) {
  if (!Number.isInteger(degree) || degree < 1) {
    throw new RangeError(`Generator degree must be a positive integer; got ${degree}`);
  }

  let result = [1];
  for (let i = 0; i < degree; i += 1) {
    const factor = [1, pow(2, i)];
    result = multiplyPolynomials(result, factor);
  }

  return result;
}

export function computeRemainder(data, generator) {
  const degree = generator.length - 1;
  const result = new Array(degree).fill(0);

  for (const value of data) {
    const factor = value ^ result.shift();
    result.push(0);

    for (let i = 0; i < degree; i += 1) {
      result[i] ^= multiply(generator[i + 1], factor);
    }
  }

  return result;
}

function multiplyPolynomials(left, right) {
  const result = new Array(left.length + right.length - 1).fill(0);
  for (let i = 0; i < left.length; i += 1) {
    for (let j = 0; j < right.length; j += 1) {
      result[i + j] ^= multiply(left[i], right[j]);
    }
  }
  return result;
}
