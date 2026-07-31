import assert from "node:assert/strict";
import path from "node:path";
import {
  resolveReleaseArtifact,
  verifyReleaseArtifact
} from "./lib/release-artifact.js";

const resolved = await resolveReleaseArtifact({
  requireManifest: true
});
assert.equal(
  resolved.remainingArgs.length,
  0,
  `Unexpected arguments: ${resolved.remainingArgs.join(" ")}`
);
const expectedVersion =
  process.env.SPECQR_EXPECTED_VERSION?.trim() || undefined;
const { manifest, inspection } = await verifyReleaseArtifact({
  tarballPath: resolved.tarballPath,
  manifestPath: resolved.manifestPath,
  expectedVersion
});

console.log(
  `ok verified release artifact ${manifest.package.name}@${manifest.package.version}`
);
console.log(
  `tarball ${path.basename(resolved.tarballPath)} `
    + `${inspection.tarball.size} bytes sha256=${inspection.tarball.sha256}`
);
console.log(
  `contents ${inspection.contents.fileCount} files `
    + `${inspection.contents.unpackedSize} bytes `
    + `sha256=${inspection.contents.sha256}`
);
