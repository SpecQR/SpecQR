import Foundation
import Vision

guard CommandLine.arguments.count == 2 else {
  FileHandle.standardError.write(Data("Usage: swift tools/decode-vision.swift <image>\n".utf8))
  exit(2)
}

let url = URL(fileURLWithPath: CommandLine.arguments[1])
let request = VNDetectBarcodesRequest()
request.symbologies = [.qr]

let handler = VNImageRequestHandler(url: url, options: [:])
try handler.perform([request])

let payloads = (request.results ?? [])
  .compactMap { $0 as? VNBarcodeObservation }
  .compactMap(\.payloadStringValue)

for payload in payloads {
  print(payload)
}

exit(payloads.isEmpty ? 1 : 0)
