// ============================================================
// Lightweight EXIF parser for JPEG files
// Runs in Cloudflare Workers (no native bindings)
//
// Looks for camera make/model, lens info, GPS, and datetime
// to score confidence that the photo came from a real camera.
//
// Scoring:
//   Camera make/model present: +0.4
//   Lens info present:         +0.2
//   GPS coordinates present:   +0.2
//   Valid datetime original:   +0.1
//   Base score (any EXIF):     +0.1
// ============================================================

export interface ExifData {
  cameraMake: string | null;
  cameraModel: string | null;
  lensModel: string | null;
  hasGps: boolean;
  dateTimeOriginal: string | null;
  confidence: number;
}

const EMPTY_EXIF: ExifData = {
  cameraMake: null,
  cameraModel: null,
  lensModel: null,
  hasGps: false,
  dateTimeOriginal: null,
  confidence: 0.0,
};

// EXIF tag IDs in IFD0 and ExifIFD
const TAG_MAKE = 0x010f;
const TAG_MODEL = 0x0110;
const TAG_DATETIME_ORIGINAL = 0x9003;
const TAG_LENS_MODEL = 0xa434;
const TAG_LENS_MAKE = 0xa433;
const TAG_GPS_IFD_POINTER = 0x8825;
const TAG_EXIF_IFD_POINTER = 0x8769;
const TAG_GPS_LATITUDE = 0x0002;

/**
 * Read a 16-bit unsigned integer from a DataView, respecting byte order.
 */
function readU16(view: DataView, offset: number, littleEndian: boolean): number {
  return view.getUint16(offset, littleEndian);
}

/**
 * Read a 32-bit unsigned integer from a DataView, respecting byte order.
 */
function readU32(view: DataView, offset: number, littleEndian: boolean): number {
  return view.getUint32(offset, littleEndian);
}

/**
 * Read an ASCII string from the data at a given offset and length.
 */
function readAsciiString(
  data: Uint8Array,
  offset: number,
  length: number
): string {
  let str = "";
  for (let i = 0; i < length; i++) {
    const ch = data[offset + i];
    if (ch === 0) break; // null terminator
    str += String.fromCharCode(ch);
  }
  return str.trim();
}

/**
 * Read a string value from an IFD entry.
 * If the string fits in 4 bytes, it's inline; otherwise it's at an offset.
 */
function readTagString(
  data: Uint8Array,
  view: DataView,
  tiffStart: number,
  entryOffset: number,
  littleEndian: boolean
): string | null {
  const type = readU16(view, entryOffset + 2, littleEndian);
  const count = readU32(view, entryOffset + 4, littleEndian);

  // Type 2 = ASCII
  if (type !== 2) return null;

  if (count <= 4) {
    // Value is inline in the entry
    return readAsciiString(data, entryOffset + 8, count);
  }

  // Value is at an offset from TIFF start
  const valueOffset = readU32(view, entryOffset + 8, littleEndian);
  const absOffset = tiffStart + valueOffset;

  if (absOffset + count > data.length) return null;
  return readAsciiString(data, absOffset, count);
}

/**
 * Parse an IFD (Image File Directory) and collect tags of interest.
 */
function parseIfd(
  data: Uint8Array,
  view: DataView,
  tiffStart: number,
  ifdOffset: number,
  littleEndian: boolean,
  tags: Map<number, string | number | boolean>
): void {
  const absOffset = tiffStart + ifdOffset;

  if (absOffset + 2 > data.length) return;

  const entryCount = readU16(view, absOffset, littleEndian);

  for (let i = 0; i < entryCount; i++) {
    const entryOffset = absOffset + 2 + i * 12;
    if (entryOffset + 12 > data.length) break;

    const tag = readU16(view, entryOffset, littleEndian);

    switch (tag) {
      case TAG_MAKE:
      case TAG_MODEL:
      case TAG_DATETIME_ORIGINAL:
      case TAG_LENS_MODEL:
      case TAG_LENS_MAKE: {
        const value = readTagString(
          data,
          view,
          tiffStart,
          entryOffset,
          littleEndian
        );
        if (value) tags.set(tag, value);
        break;
      }
      case TAG_EXIF_IFD_POINTER: {
        // Pointer to the Exif sub-IFD
        const subIfdOffset = readU32(view, entryOffset + 8, littleEndian);
        parseIfd(data, view, tiffStart, subIfdOffset, littleEndian, tags);
        break;
      }
      case TAG_GPS_IFD_POINTER: {
        // GPS IFD exists -- check if it has actual data
        const gpsIfdOffset = readU32(view, entryOffset + 8, littleEndian);
        const gpsAbs = tiffStart + gpsIfdOffset;
        if (gpsAbs + 2 < data.length) {
          const gpsCount = readU16(view, gpsAbs, littleEndian);
          if (gpsCount > 0) {
            // Check for actual GPS lat/lon tags
            for (let g = 0; g < gpsCount; g++) {
              const gEntry = gpsAbs + 2 + g * 12;
              if (gEntry + 12 > data.length) break;
              const gTag = readU16(view, gEntry, littleEndian);
              if (gTag === TAG_GPS_LATITUDE) {
                tags.set(TAG_GPS_IFD_POINTER, true);
                break;
              }
            }
          }
        }
        break;
      }
    }
  }
}

/**
 * Find the EXIF APP1 segment in JPEG data and return the offset
 * to the TIFF header within it.
 */
function findExifSegment(data: Uint8Array): number | null {
  // JPEG starts with FF D8
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) return null;

  let offset = 2;

  while (offset < data.length - 1) {
    if (data[offset] !== 0xff) {
      offset++;
      continue;
    }

    const marker = data[offset + 1];

    // APP1 marker = 0xE1
    if (marker === 0xe1) {
      if (offset + 10 > data.length) return null;

      // Check for "Exif\0\0" identifier
      if (
        data[offset + 4] === 0x45 && // E
        data[offset + 5] === 0x78 && // x
        data[offset + 6] === 0x69 && // i
        data[offset + 7] === 0x66 && // f
        data[offset + 8] === 0x00 &&
        data[offset + 9] === 0x00
      ) {
        return offset + 10; // TIFF header starts here
      }
    }

    // SOS marker -- stop scanning
    if (marker === 0xda) break;

    // Skip this segment
    if (offset + 3 >= data.length) return null;
    const segLen = (data[offset + 2] << 8) | data[offset + 3];
    offset += 2 + segLen;
  }

  return null;
}

/**
 * Analyze EXIF data in a JPEG image and return a confidence score
 * that this photo came from a real camera.
 *
 * Works entirely with ArrayBuffer -- no native dependencies.
 */
export function analyzeExif(imageData: ArrayBuffer): ExifData {
  const data = new Uint8Array(imageData);

  // Only JPEGs have EXIF
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) {
    return EMPTY_EXIF;
  }

  const tiffStart = findExifSegment(data);
  if (tiffStart === null) {
    return EMPTY_EXIF;
  }

  if (tiffStart + 8 > data.length) return EMPTY_EXIF;

  // Determine byte order from TIFF header
  const byteOrder = (data[tiffStart] << 8) | data[tiffStart + 1];
  let littleEndian: boolean;

  if (byteOrder === 0x4949) {
    littleEndian = true; // "II" = Intel = little-endian
  } else if (byteOrder === 0x4d4d) {
    littleEndian = false; // "MM" = Motorola = big-endian
  } else {
    return EMPTY_EXIF; // Invalid TIFF header
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  // Read offset to first IFD
  const ifd0Offset = readU32(view, tiffStart + 4, littleEndian);

  const tags = new Map<number, string | number | boolean>();
  parseIfd(data, view, tiffStart, ifd0Offset, littleEndian, tags);

  // Build result
  const cameraMake = (tags.get(TAG_MAKE) as string) || null;
  const cameraModel = (tags.get(TAG_MODEL) as string) || null;
  const lensModel =
    (tags.get(TAG_LENS_MODEL) as string) ||
    (tags.get(TAG_LENS_MAKE) as string) ||
    null;
  const hasGps = tags.get(TAG_GPS_IFD_POINTER) === true;
  const dateTimeOriginal =
    (tags.get(TAG_DATETIME_ORIGINAL) as string) || null;

  // Compute confidence score
  let confidence = 0.0;

  // Any EXIF at all is a good sign
  if (tags.size > 0) confidence += 0.1;

  // Camera make or model
  if (cameraMake || cameraModel) confidence += 0.4;

  // Lens info
  if (lensModel) confidence += 0.2;

  // GPS coordinates
  if (hasGps) confidence += 0.2;

  // Valid datetime original (format: "YYYY:MM:DD HH:MM:SS")
  if (dateTimeOriginal && /^\d{4}:\d{2}:\d{2}\s\d{2}:\d{2}:\d{2}$/.test(dateTimeOriginal)) {
    confidence += 0.1;
  }

  return {
    cameraMake,
    cameraModel,
    lensModel,
    hasGps,
    dateTimeOriginal,
    confidence: Math.min(confidence, 1.0),
  };
}
