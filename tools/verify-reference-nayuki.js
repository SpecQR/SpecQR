import {
  conformanceUsage,
  createCaseRunner,
  formatSeed,
  parseConformanceArguments
} from "./lib/deterministic-conformance.js";
import { runNayukiDifferential } from "./lib/nayuki-differential.js";

const SCRIPT = "verify:reference:nayuki";
const options = parseConformanceArguments(process.argv.slice(2));

if (options.help) {
  console.log(conformanceUsage(SCRIPT));
  process.exit(0);
}

const startedAt = performance.now();
const runner = createCaseRunner({
  seed: options.seed,
  cases: options.cases,
  caseFilter: options.caseFilter,
  script: SCRIPT
});
const result = runNayukiDifferential({
  runner,
  seed: options.seed,
  caseFilter: options.caseFilter
});
const matched = runner.finish();
const elapsedMilliseconds = Math.round(performance.now() - startedAt);

console.log(
  `ok reference:nayuki compared=${result.compared} matched=${matched}` +
  ` seed=${formatSeed(options.seed)} elapsedMs=${elapsedMilliseconds}`
);
console.log(JSON.stringify({
  seed: formatSeed(options.seed),
  caseFilter: options.caseFilter,
  ...result,
  elapsedMilliseconds
}, null, 2));
