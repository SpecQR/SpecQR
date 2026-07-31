# Test Harness Third-Party Components

This directory is a test-only harness and is excluded from the published
`specqr` npm package.

- Apache Maven Wrapper 3.3.4 startup script, Apache License 2.0.
  Upstream: https://github.com/apache/maven-wrapper
- Apache Maven 3.9.16, downloaded by the wrapper and verified with the pinned
  SHA-256 digest, Apache License 2.0.
  Upstream: https://maven.apache.org/
- ZXing `core` 3.5.4 and `javase` 3.5.4, resolved from Maven Central,
  Apache License 2.0.
  Upstream: https://github.com/zxing/zxing

No JAR, Maven distribution, Maven cache, generated class, fixture PNG, or
verification report is redistributed by this repository or npm package.
