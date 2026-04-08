// ============================================================
// Image validator for Cloudflare Workers
// Checks dimensions, file size, and basic corruption detection
// via magic byte headers. No native bindings needed.
// ============================================================

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  format: "jpeg" | "png" | "webp" | "unknown";
  width: number;
  height: number;
  fileSize: number;
}

// Min dimensions for acceptable images
const MIN_WIDTH = 800;
const MIN_HEIGHT = 600;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const MIN_FILE_SIZE = 10 * 1024; // 10 KB -- anything smaller is suspicious

// Magic bytes for image formats
const JPEG_SOI = [0xff, 0xd8, 0xff]; // JPEG Start of Image
const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]; // PNG signature
const WEBP_RIFF = [0x52, 0x49, 0x46, 0x46]; // "RIFF"
const WEBP_MARKER = [0x57, 0x45, 0x42, 0x50]; // "WEBP"

function matchBytes(data: Uint8Array, expected: number[], offset = 0): boolean {
  if (data.length < offset + expected.length) return false;
  for (let i = 0; i < expected.length; i++) {
    if (data[offset + i] !== expected[i]) return false;
  }
  return true;
}

/**
 * Detect image format from magic bytes.
 */
function detectFormat(
  data: Uint8Array
): "jpeg" | "png" | "webp" | "unknown" {
  if (matchBytes(data, JPEG_SOI)) return "jpeg";
  if (matchBytes(data, PNG_HEADER)) return "png";
  if (matchBytes(data, WEBP_RIFF) && matchBytes(data, WEBP_MARKER, 8))
    return "webp";
  return "unknown";
}

/**
 * Extract dimensions from JPEG data.
 * Scans for SOF (Start of Frame) markers which contain width/height.
 */
function getJpegDimensions(
  data: Uint8Array
): { width: number; height: number } | null {
  let offset = 2; // skip SOI marker

  while (offset < data.length - 1) {
    if (data[offset] !== 0xff) {
      offset++;
      continue;
    }

    const marker = data[offset + 1];

    // SOF markers: 0xC0 through 0xCF, except 0xC4 (DHT), 0xC8, 0xCC (DAC)
    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc
    ) {
      if (offset + 9 > data.length) return null;
      const height = (data[offset + 5] << 8) | data[offset + 6];
      const width = (data[offset + 7] << 8) | data[offset + 8];
      return { width, height };
    }

    // Skip to next marker using segment length
    if (offset + 3 >= data.length) return null;
    const segmentLength = (data[offset + 2] << 8) | data[offset + 3];
    offset += 2 + segmentLength;
  }

  return null;
}

/**
 * Extract dimensions from PNG data.
 * Width and height are in the IHDR chunk, right after the signature.
 */
function getPngDimensions(
  data: Uint8Array
): { width: number; height: number } | null {
  // PNG: 8-byte sig, then IHDR chunk: 4-byte length, 4-byte "IHDR", 4-byte width, 4-byte height
  if (data.length < 24) return null;

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const width = view.getUint32(16, false); // big-endian
  const height = view.getUint32(20, false);

  return { width, height };
}

/**
 * Extract dimensions from WebP data.
 * Handles VP8 (lossy), VP8L (lossless), and VP8X (extended) formats.
 */
function getWebpDimensions(
  data: Uint8Array
): { width: number; height: number } | null {
  if (data.length < 30) return null;

  // Check VP8 sub-format at offset 12
  const chunk = String.fromCharCode(data[12], data[13], data[14], data[15]);

  if (chunk === "VP8 ") {
    // Lossy VP8: frame header starts at offset 20+3 (3-byte frame tag)
    // Width at offset 26 (little-endian 16-bit), height at 28
    if (data.length < 30) return null;
    const width = (data[26] | (data[27] << 8)) & 0x3fff;
    const height = (data[28] | (data[29] << 8)) & 0x3fff;
    return { width, height };
  }

  if (chunk === "VP8L") {
    // Lossless VP8L: signature byte at offset 21, then packed width/height
    if (data.length < 25) return null;
    const bits =
      data[21] | (data[22] << 8) | (data[23] << 16) | (data[24] << 24);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >> 14) & 0x3fff) + 1;
    return { width, height };
  }

  if (chunk === "VP8X") {
    // Extended format: canvas size at offset 24-29
    if (data.length < 30) return null;
    const width =
      1 + (data[24] | (data[25] << 8) | (data[26] << 16));
    const height =
      1 + (data[27] | (data[28] << 8) | (data[29] << 16));
    return { width, height };
  }

  return null;
}

/**
 * Validate image data from raw bytes.
 * Checks format (magic bytes), dimensions, and file size.
 *
 * Works entirely with ArrayBuffer/Uint8Array -- no native dependencies.
 */
export function validateImage(data: ArrayBuffer): ValidationResult {
  const bytes = new Uint8Array(data);
  const fileSize = bytes.length;

  if (fileSize < MIN_FILE_SIZE) {
    return {
      valid: false,
      reason: `File too small (${fileSize} bytes, minimum ${MIN_FILE_SIZE})`,
      format: "unknown",
      width: 0,
      height: 0,
      fileSize,
    };
  }

  if (fileSize > MAX_FILE_SIZE) {
    return {
      valid: false,
      reason: `File too large (${fileSize} bytes, maximum ${MAX_FILE_SIZE})`,
      format: "unknown",
      width: 0,
      height: 0,
      fileSize,
    };
  }

  const format = detectFormat(bytes);

  if (format === "unknown") {
    return {
      valid: false,
      reason: "Unrecognized image format (not JPEG, PNG, or WebP)",
      format,
      width: 0,
      height: 0,
      fileSize,
    };
  }

  let dimensions: { width: number; height: number } | null = null;

  switch (format) {
    case "jpeg":
      dimensions = getJpegDimensions(bytes);
      break;
    case "png":
      dimensions = getPngDimensions(bytes);
      break;
    case "webp":
      dimensions = getWebpDimensions(bytes);
      break;
  }

  if (!dimensions) {
    return {
      valid: false,
      reason: `Could not read dimensions from ${format.toUpperCase()} file (possibly corrupted)`,
      format,
      width: 0,
      height: 0,
      fileSize,
    };
  }

  const { width, height } = dimensions;

  if (width < MIN_WIDTH || height < MIN_HEIGHT) {
    return {
      valid: false,
      reason: `Image too small (${width}x${height}, minimum ${MIN_WIDTH}x${MIN_HEIGHT})`,
      format,
      width,
      height,
      fileSize,
    };
  }

  // Check for obviously broken dimensions
  if (width > 20000 || height > 20000) {
    return {
      valid: false,
      reason: `Dimensions suspiciously large (${width}x${height})`,
      format,
      width,
      height,
      fileSize,
    };
  }

  return {
    valid: true,
    format,
    width,
    height,
    fileSize,
  };
}
