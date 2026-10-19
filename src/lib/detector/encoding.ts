export type DetectedEncoding = "UTF-8" | "UTF-8-BOM" | "Windows-1252" | "Latin-1";

export function detectEncoding(buffer: Buffer): {
  encoding: DetectedEncoding;
  hasBom: boolean;
  bomOffset: number;
} {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xef &&
    buffer[1] === 0xbb &&
    buffer[2] === 0xbf
  ) {
    return {
      encoding: "UTF-8-BOM",
      hasBom: true,
      bomOffset: 3,
    };
  }

  let isValidUtf8 = true;
  let hasExtendedAscii = false;
  let hasWindows1252Specific = false;

  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];

    if (byte <= 0x7f) {
      continue;
    }

    hasExtendedAscii = true;

    if (byte >= 0x80 && byte <= 0x9f) {
      hasWindows1252Specific = true;
    }

    if ((byte & 0xe0) === 0xc0) {
      if (i + 1 >= buffer.length || (buffer[i + 1] & 0xc0) !== 0x80) {
        isValidUtf8 = false;
        break;
      }
      i += 1;
    } else if ((byte & 0xf0) === 0xe0) {
      if (
        i + 2 >= buffer.length ||
        (buffer[i + 1] & 0xc0) !== 0x80 ||
        (buffer[i + 2] & 0xc0) !== 0x80
      ) {
        isValidUtf8 = false;
        break;
      }
      i += 2;
    } else if ((byte & 0xf8) === 0xf0) {
      if (
        i + 3 >= buffer.length ||
        (buffer[i + 1] & 0xc0) !== 0x80 ||
        (buffer[i + 2] & 0xc0) !== 0x80 ||
        (buffer[i + 3] & 0xc0) !== 0x80
      ) {
        isValidUtf8 = false;
        break;
      }
      i += 3;
    } else {
      isValidUtf8 = false;
      break;
    }
  }

  if (isValidUtf8) {
    return {
      encoding: "UTF-8",
      hasBom: false,
      bomOffset: 0,
    };
  }

  if (hasWindows1252Specific) {
    return {
      encoding: "Windows-1252",
      hasBom: false,
      bomOffset: 0,
    };
  }

  return {
    encoding: hasExtendedAscii ? "Latin-1" : "UTF-8",
    hasBom: false,
    bomOffset: 0,
  };
}

export function decodeBuffer(
  buffer: Buffer,
  encoding: DetectedEncoding,
  bomOffset = 0
): string {
  const slice = bomOffset > 0 ? buffer.subarray(bomOffset) : buffer;

  if (encoding === "Windows-1252" || encoding === "Latin-1") {
    return slice.toString("latin1");
  }

  return slice.toString("utf-8");
}
