import test from "node:test";
import assert from "node:assert/strict";
import { getPenaltyScore, maskCondition } from "../src/core/mask.js";
import { generate } from "../src/index.js";

const RULE_FIXTURES = [
  {
    name: "N1 run lengths",
    rows: [
      "11111",
      "01010",
      "10101",
      "01010",
      "10101"
    ],
    expected: {
      horizontalRuns: 3,
      verticalRuns: 0,
      blocks: 0,
      horizontalFinderLike: 0,
      verticalFinderLike: 0,
      balance: 20
    }
  },
  {
    name: "N2 two-by-two blocks",
    rows: [
      "11010",
      "11010",
      "00101",
      "01010",
      "10101"
    ],
    expected: {
      horizontalRuns: 0,
      verticalRuns: 0,
      blocks: 3,
      horizontalFinderLike: 0,
      verticalFinderLike: 0,
      balance: 0
    }
  },
  {
    name: "N3 finder-like pattern",
    rows: [
      "10111010000",
      "01010101010",
      "10101010101",
      "01010101010",
      "10101010101",
      "01010101010",
      "10101010101",
      "01010101010",
      "10101010101",
      "01010101010",
      "10101010101"
    ],
    expected: {
      horizontalRuns: 0,
      verticalRuns: 0,
      blocks: 0,
      horizontalFinderLike: 40,
      verticalFinderLike: 0,
      balance: 0
    }
  },
  {
    name: "N4 dark module balance",
    rows: Array.from({ length: 10 }, () => "1111111111"),
    expected: {
      horizontalRuns: 80,
      verticalRuns: 80,
      blocks: 243,
      horizontalFinderLike: 0,
      verticalFinderLike: 0,
      balance: 100
    }
  }
];

test("mask pattern predicates match QR mask formulas", () => {
  const samples = [
    { mask: 0, x: 2, y: 4, expected: true },
    { mask: 0, x: 1, y: 4, expected: false },
    { mask: 1, x: 3, y: 2, expected: true },
    { mask: 1, x: 3, y: 3, expected: false },
    { mask: 2, x: 6, y: 5, expected: true },
    { mask: 2, x: 7, y: 5, expected: false },
    { mask: 3, x: 2, y: 4, expected: true },
    { mask: 3, x: 2, y: 5, expected: false },
    { mask: 4, x: 3, y: 2, expected: true },
    { mask: 4, x: 6, y: 2, expected: false },
    { mask: 5, x: 2, y: 3, expected: true },
    { mask: 5, x: 1, y: 1, expected: false },
    { mask: 6, x: 1, y: 3, expected: false },
    { mask: 6, x: 2, y: 3, expected: true },
    { mask: 7, x: 3, y: 1, expected: true },
    { mask: 7, x: 1, y: 1, expected: false }
  ];

  for (const sample of samples) {
    assert.equal(
      maskCondition(sample.mask, sample.x, sample.y),
      sample.expected,
      `mask ${sample.mask} at ${sample.x},${sample.y}`
    );
  }
});

for (const fixture of RULE_FIXTURES) {
  test(`mask penalty rule conformance: ${fixture.name}`, () => {
    const matrix = toMatrix(fixture.rows);
    const expectedTotal = Object.values(fixture.expected).reduce((sum, value) => sum + value, 0);

    assert.deepEqual(getPenaltyBreakdown(matrix), {
      ...fixture.expected,
      total: expectedTotal
    });
    assert.equal(getPenaltyScore(matrix), expectedTotal);
  });
}

test("auto mask diagnostics select the lowest penalty candidate", () => {
  const result = generate("MASK DIAGNOSTICS 1234567890 abc", {
    output: "matrix",
    diagnostics: true
  });
  const { diagnostics } = result;
  const minimum = diagnostics.maskPenalties.reduce((best, candidate) =>
    candidate.penalty < best.penalty ? candidate : best
  );

  assert.equal(diagnostics.maskPenalties.length, 8);
  assert.deepEqual(
    diagnostics.maskPenalties.map((candidate) => candidate.maskPattern),
    [0, 1, 2, 3, 4, 5, 6, 7]
  );
  assert.equal(diagnostics.maskPattern, minimum.maskPattern);
  assert.equal(diagnostics.maskPenalty, minimum.penalty);
  assert.equal(getPenaltyScore(result.matrix), diagnostics.maskPenalty);
  assert.match(diagnostics.maskSelectionReason, /lowest penalty/);
});

test("fixed mask diagnostics report only the requested mask and matching penalty", () => {
  const result = generate("MASK DIAGNOSTICS 1234567890 abc", {
    output: "matrix",
    diagnostics: true,
    maskPattern: 5
  });

  assert.equal(result.diagnostics.maskPattern, 5);
  assert.deepEqual(result.diagnostics.maskPenalties, [
    { maskPattern: 5, penalty: result.diagnostics.maskPenalty }
  ]);
  assert.equal(getPenaltyScore(result.matrix), result.diagnostics.maskPenalty);
  assert.match(result.diagnostics.maskSelectionReason, /requested explicitly/);
});

function toMatrix(rows) {
  return rows.map((row) => Array.from(row, (value) => value === "1"));
}

function getPenaltyBreakdown(matrix) {
  return {
    horizontalRuns: getRunPenalty(matrix, true),
    verticalRuns: getRunPenalty(matrix, false),
    blocks: getBlockPenalty(matrix),
    horizontalFinderLike: getFinderLikePenalty(matrix, true),
    verticalFinderLike: getFinderLikePenalty(matrix, false),
    balance: getBalancePenalty(matrix),
    total: getPenaltyScore(matrix)
  };
}

function getRunPenalty(matrix, horizontal) {
  const size = matrix.length;
  let penalty = 0;

  for (let a = 0; a < size; a += 1) {
    let runColor = false;
    let runLength = 0;

    for (let b = 0; b < size; b += 1) {
      const value = horizontal ? matrix[a][b] : matrix[b][a];
      if (b === 0 || value !== runColor) {
        if (runLength >= 5) {
          penalty += runLength - 2;
        }
        runColor = value;
        runLength = 1;
      } else {
        runLength += 1;
      }
    }

    if (runLength >= 5) {
      penalty += runLength - 2;
    }
  }

  return penalty;
}

function getBlockPenalty(matrix) {
  const size = matrix.length;
  let penalty = 0;

  for (let y = 0; y < size - 1; y += 1) {
    for (let x = 0; x < size - 1; x += 1) {
      const color = matrix[y][x];
      if (
        color === matrix[y][x + 1] &&
        color === matrix[y + 1][x] &&
        color === matrix[y + 1][x + 1]
      ) {
        penalty += 3;
      }
    }
  }

  return penalty;
}

function getFinderLikePenalty(matrix, horizontal) {
  const size = matrix.length;
  const patternA = "10111010000";
  const patternB = "00001011101";
  let penalty = 0;

  for (let a = 0; a < size; a += 1) {
    for (let b = 0; b <= size - 11; b += 1) {
      let value = "";
      for (let i = 0; i < 11; i += 1) {
        value += horizontal
          ? matrix[a][b + i] ? "1" : "0"
          : matrix[b + i][a] ? "1" : "0";
      }
      if (value === patternA || value === patternB) {
        penalty += 40;
      }
    }
  }

  return penalty;
}

function getBalancePenalty(matrix) {
  const size = matrix.length;
  let dark = 0;

  for (const row of matrix) {
    for (const value of row) {
      if (value) {
        dark += 1;
      }
    }
  }

  return Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
}
