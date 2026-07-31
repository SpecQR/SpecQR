package org.specqr.e2e;

import com.google.zxing.BinaryBitmap;
import com.google.zxing.DecodeHintType;
import com.google.zxing.Result;
import com.google.zxing.ResultMetadataType;
import com.google.zxing.common.HybridBinarizer;
import com.google.zxing.client.j2se.BufferedImageLuminanceSource;
import com.google.zxing.qrcode.QRCodeReader;

import java.awt.image.BufferedImage;
import java.io.BufferedWriter;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import javax.imageio.ImageIO;

public final class StructuredAppendMetadataDecoder {
  private StructuredAppendMetadataDecoder() {
  }

  public static void main(String[] args) throws Exception {
    if (args.length != 2) {
      throw new IllegalArgumentException(
        "Expected image-list and decoder-output paths"
      );
    }

    Path imageListPath = Path.of(args[0]);
    Path outputPath = Path.of(args[1]);
    List<String> imagePaths = Files.readAllLines(
      imageListPath,
      StandardCharsets.UTF_8
    );

    Files.createDirectories(outputPath.getParent());
    try (BufferedWriter writer = Files.newBufferedWriter(
      outputPath,
      StandardCharsets.UTF_8
    )) {
      writer.write(toolchainRecord());
      writer.newLine();

      QRCodeReader reader = new QRCodeReader();
      Map<DecodeHintType, Object> hints = new EnumMap<>(DecodeHintType.class);
      hints.put(DecodeHintType.PURE_BARCODE, Boolean.TRUE);
      hints.put(DecodeHintType.TRY_HARDER, Boolean.TRUE);

      for (int ordinal = 0; ordinal < imagePaths.size(); ordinal += 1) {
        String imagePath = imagePaths.get(ordinal);
        BufferedImage image = ImageIO.read(Path.of(imagePath).toFile());
        if (image == null) {
          throw new IllegalArgumentException(
            "Could not read fixture image: " + imagePath
          );
        }

        BinaryBitmap bitmap = new BinaryBitmap(
          new HybridBinarizer(new BufferedImageLuminanceSource(image))
        );
        Result result = reader.decode(bitmap, hints);
        writer.write(decodeRecord(ordinal, imagePath, result));
        writer.newLine();
        reader.reset();
      }
    }
  }

  private static String toolchainRecord() throws Exception {
    return "{"
      + "\"type\":\"toolchain\","
      + "\"javaVersion\":" + jsonString(System.getProperty("java.version")) + ","
      + "\"javaRuntimeVersion\":" + jsonString(
        System.getProperty("java.runtime.version")
      ) + ","
      + "\"javaVendor\":" + jsonString(System.getProperty("java.vendor")) + ","
      + "\"zxingCoreVersion\":" + jsonString(
        mavenArtifactVersion("com.google.zxing", "core", QRCodeReader.class)
      ) + ","
      + "\"zxingJavaseVersion\":" + jsonString(
        mavenArtifactVersion(
          "com.google.zxing",
          "javase",
          BufferedImageLuminanceSource.class
        )
      )
      + "}";
  }

  private static String decodeRecord(
    int ordinal,
    String imagePath,
    Result result
  ) {
    Map<ResultMetadataType, Object> metadata = result.getResultMetadata();
    Object sequence = metadataValue(
      metadata,
      ResultMetadataType.STRUCTURED_APPEND_SEQUENCE
    );
    Object parity = metadataValue(
      metadata,
      ResultMetadataType.STRUCTURED_APPEND_PARITY
    );
    byte[] rawBytes = result.getRawBytes();

    return "{"
      + "\"type\":\"decode\","
      + "\"ordinal\":" + ordinal + ","
      + "\"path\":" + jsonString(imagePath) + ","
      + "\"format\":" + jsonString(result.getBarcodeFormat().toString()) + ","
      + "\"text\":" + jsonString(result.getText()) + ","
      + "\"numBits\":" + result.getNumBits() + ","
      + "\"rawBytesBase64\":" + jsonNullableString(
        rawBytes == null
          ? null
          : Base64.getEncoder().encodeToString(rawBytes)
      ) + ","
      + "\"sequence\":" + jsonMetadataValue(sequence) + ","
      + "\"parity\":" + jsonMetadataValue(parity) + ","
      + "\"metadata\":" + jsonMetadataMap(metadata)
      + "}";
  }

  private static Object metadataValue(
    Map<ResultMetadataType, Object> metadata,
    ResultMetadataType key
  ) {
    return metadata == null ? null : metadata.get(key);
  }

  private static String mavenArtifactVersion(
    String groupId,
    String artifactId,
    Class<?> anchor
  ) throws Exception {
    String resource = "META-INF/maven/"
      + groupId
      + "/"
      + artifactId
      + "/pom.properties";
    try (InputStream stream = anchor.getClassLoader().getResourceAsStream(resource)) {
      if (stream == null) {
        throw new IllegalStateException(
          "Missing Maven artifact metadata: " + resource
        );
      }
      Properties properties = new Properties();
      properties.load(stream);
      String version = properties.getProperty("version");
      if (version == null || version.isBlank()) {
        throw new IllegalStateException(
          "Missing Maven artifact version: " + resource
        );
      }
      return version;
    }
  }

  private static String jsonMetadataMap(
    Map<ResultMetadataType, Object> metadata
  ) {
    if (metadata == null || metadata.isEmpty()) {
      return "{}";
    }

    StringBuilder builder = new StringBuilder();
    builder.append('{');
    boolean first = true;
    for (ResultMetadataType key : ResultMetadataType.values()) {
      if (!metadata.containsKey(key)) {
        continue;
      }
      if (!first) {
        builder.append(',');
      }
      first = false;
      builder.append(jsonString(key.name()));
      builder.append(':');
      builder.append(jsonMetadataValue(metadata.get(key)));
    }
    builder.append('}');
    return builder.toString();
  }

  private static String jsonMetadataValue(Object value) {
    if (value == null) {
      return "null";
    }

    return "{"
      + "\"javaType\":" + jsonString(value.getClass().getName()) + ","
      + "\"value\":" + jsonString(metadataValueText(value))
      + "}";
  }

  private static String metadataValueText(Object value) {
    if (value instanceof byte[] bytes) {
      return Base64.getEncoder().encodeToString(bytes);
    }
    if (value instanceof Iterable<?> values) {
      StringBuilder builder = new StringBuilder();
      builder.append('[');
      boolean first = true;
      for (Object item : values) {
        if (!first) {
          builder.append(',');
        }
        first = false;
        builder.append(metadataValueText(item));
      }
      builder.append(']');
      return builder.toString();
    }
    return String.valueOf(value);
  }

  private static String jsonNullableString(String value) {
    return value == null ? "null" : jsonString(value);
  }

  private static String jsonString(String value) {
    if (value == null) {
      return "null";
    }

    StringBuilder builder = new StringBuilder();
    builder.append('"');
    for (int index = 0; index < value.length(); index += 1) {
      char ch = value.charAt(index);
      switch (ch) {
        case '"':
          builder.append("\\\"");
          break;
        case '\\':
          builder.append("\\\\");
          break;
        case '\b':
          builder.append("\\b");
          break;
        case '\f':
          builder.append("\\f");
          break;
        case '\n':
          builder.append("\\n");
          break;
        case '\r':
          builder.append("\\r");
          break;
        case '\t':
          builder.append("\\t");
          break;
        default:
          if (ch < 0x20) {
            builder.append(String.format("\\u%04x", (int) ch));
          } else {
            builder.append(ch);
          }
      }
    }
    builder.append('"');
    return builder.toString();
  }
}
