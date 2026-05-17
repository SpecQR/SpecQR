import type { Buffer } from "node:buffer";
import type { QRCodeOptions, QRInput, QRSegmentInput } from "./index.js";

export function toPngBuffer(input: QRInput, options?: QRCodeOptions): Buffer;
export function toPngBufferFromSegments(segments: QRSegmentInput[], options?: QRCodeOptions): Buffer;
export function writePngFile(filePath: string, input: QRInput, options?: QRCodeOptions): Promise<void>;
export function writePngFileFromSegments(filePath: string, segments: QRSegmentInput[], options?: QRCodeOptions): Promise<void>;
