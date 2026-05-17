import type { QRCodeOptions, QRInput, QRSegmentInput } from "./index.js";

export function toBlob(input: QRInput, options?: QRCodeOptions): Blob;
export function toBlobFromSegments(segments: QRSegmentInput[], options?: QRCodeOptions): Blob;
export function toObjectURL(input: QRInput, options?: QRCodeOptions): string;
export function toObjectURLFromSegments(segments: QRSegmentInput[], options?: QRCodeOptions): string;
export function toImageData(input: QRInput, options?: QRCodeOptions): ImageData;
export function toImageDataFromSegments(segments: QRSegmentInput[], options?: QRCodeOptions): ImageData;
