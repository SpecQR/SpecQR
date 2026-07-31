import {
  conformanceUsage,
  createCaseRunner,
  formatSeed,
  parseConformanceArguments
} from "./lib/deterministic-conformance.js";
import { runMetamorphicProperties } from "./lib/metamorphic-properties.js";
import { runNayukiDifferential } from "./lib/nayuki-differential.js";

const SCRIPT = "verify:conformance:fuzz";
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

console.log(
  `conformance:fuzz seed=${formatSeed(options.seed)} propertyCases=${options.cases}` +
  ` mode=${options.extended ? "extended" : "bounded"}` +
  `${options.caseFilter === null ? "" : ` case=${options.caseFilter}`}`
);

const reference = runNayukiDifferential({
  runner,
  seed: options.seed,
  caseFilter: options.caseFilter
});
const properties = runMetamorphicProperties({
  runner,
  seed: options.seed,
  cases: options.cases,
  caseFilter: options.caseFilter
});
const matched = runner.finish();
const elapsedMilliseconds = Math.round(performance.now() - startedAt);

console.log(`ok conformance:fuzz matched=${matched} elapsedMs=${elapsedMilliseconds}`);
console.log(JSON.stringify({
  seed: formatSeed(options.seed),
  mode: options.extended ? "extended" : "bounded",
  configuredCasesPerProperty: options.cases,
  caseFilter: options.caseFilter,
  nayuki: reference,
  properties,
  elapsedMilliseconds
}, null, 2));

