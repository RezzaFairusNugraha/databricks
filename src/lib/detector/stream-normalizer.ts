import { Readable, Transform, PassThrough } from "node:stream";
import ExcelJS from "exceljs";
import { detectDelimiter, splitCsvLine } from "./delimiter";
import { detectEncoding, decodeBuffer, DetectedEncoding } from "./encoding";

export { splitCsvLine };

export interface NormalizationMetadata {
  encoding: string;
  delimiter: string;
  headerRowIndex: number;
  rowCount: number;
  columnCount: number;
  columns: string[];
  fixesApplied: string[];
  sheetName?: string;
  availableSheets?: string[];
}

export class NormalizationError extends Error {
  suggestion: string;
  code: string;

  constructor(message: string, suggestion: string, code = "ERR_NORMALIZATION") {
    super(message);
    this.name = "NormalizationError";
    this.suggestion = suggestion;
    this.code = code;
  }
}

const TOTAL_KEYWORDS = [
  "total",
  "grand total",
  "jumlah",
  "sub total",
  "subtotal",
  "summary",
  "keseluruhan",
  "rata-rata",
  "average",
];

const GENERIC_HEADER_REGEX = /^([a-z]|x\d+|col\d+|column\d+|_\d+)$/i;

const DATA_PATTERNS = [
  /\b\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}\b/,
  /(?:rp|idr|\$|€|£)\s*[\d.,]+/i,
  /^[\d.,]+%$/,
  /^[a-z]{2,}-\d+/i,
  /^-?\d+(?:[.,]\d+)?$/,
  /^(ya|tidak|yes|no|true|false)$/i,
];

export function looksLikeDataRow(row: string[]): boolean {
  if (row.length === 0) return false;
  let matches = 0;
  for (const cell of row) {
    const trimmed = cell.trim();
    if (!trimmed) continue;
    if (DATA_PATTERNS.some((p) => p.test(trimmed))) {
      matches++;
    }
  }
  return matches >= 2 || (row.length > 0 && matches / row.length >= 0.25);
}

export function toSnakeCase(str: string): string {
  const cleaned = str
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[-\s]+/g, "_")
    .toLowerCase()
    .replace(/^_+|_+$/g, "");
  return cleaned || "col";
}

export function makeUniqueHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map((raw, idx) => {
    const base = toSnakeCase(raw) || `col_${idx + 1}`;
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    if (count === 0) {
      return base;
    }
    return `${base}_${count + 1}`;
  });
}

export function escapeCsvField(val: string): string {
  if (
    val.includes(",") ||
    val.includes('"') ||
    val.includes("\n") ||
    val.includes("\r")
  ) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export function isTotalRow(row: string[]): boolean {
  if (row.length === 0) return false;
  const first = (row[0] || "").toLowerCase().trim();
  const second = (row[1] || "").toLowerCase().trim();

  const matchesKeyword = TOTAL_KEYWORDS.some(
    (kw) => first.includes(kw) || second.includes(kw)
  );

  if (!matchesKeyword) return false;

  const filled = row.filter((c) => c.trim().length > 0);
  return filled.length <= Math.max(3, Math.floor(row.length * 0.4));
}

export function isRepeatedHeader(
  row: string[],
  normalizedHeaders: string[]
): boolean {
  if (row.length !== normalizedHeaders.length) return false;
  let matches = 0;
  for (let i = 0; i < row.length; i++) {
    const cellNorm = toSnakeCase(row[i]);
    if (cellNorm && cellNorm === normalizedHeaders[i]) {
      matches++;
    }
  }
  return matches >= Math.max(2, Math.floor(normalizedHeaders.length * 0.7));
}

export function resolveTwoHeaderRows(
  row1: string[],
  row2: string[],
  sampleDataRows: string[][]
): { headers: string[]; fixDescription: string } {
  const colCount = Math.max(row1.length, row2.length);
  const resolved: string[] = [];
  const fixes: string[] = [];

  for (let colIdx = 0; colIdx < colCount; colIdx++) {
    const name1 = (row1[colIdx] || "").trim();
    const name2 = (row2[colIdx] || "").trim();

    const dataValues = new Set<string>();
    for (const dRow of sampleDataRows) {
      const val = (dRow[colIdx] || "").trim();
      if (val) dataValues.add(val.toLowerCase());
    }

    if (name2 && dataValues.has(name2.toLowerCase()) && name1) {
      resolved.push(name1);
      fixes.push(
        `Nilai data '${name2}' pada baris kedua diganti dengan nama kolom '${name1}' dari baris pertama`
      );
      continue;
    }

    if (name1 && dataValues.has(name1.toLowerCase()) && name2) {
      resolved.push(name2);
      continue;
    }

    const isGeneric1 = !name1 || GENERIC_HEADER_REGEX.test(name1);
    const isGeneric2 = !name2 || GENERIC_HEADER_REGEX.test(name2);

    if (isGeneric1 && !isGeneric2) {
      resolved.push(name2);
    } else if (!isGeneric1 && isGeneric2) {
      resolved.push(name1);
    } else {
      resolved.push(name2 || name1 || `col_${colIdx + 1}`);
    }
  }

  const unique = makeUniqueHeaders(resolved);
  const fixDescription =
    fixes.length > 0
      ? fixes.join("; ")
      : "Dua baris header digabungkan menjadi satu baris deskriptif";

  return { headers: unique, fixDescription };
}

export function detectEncodingFromBuffer(buf: Buffer): {
  encoding: DetectedEncoding;
  text: string;
} {
  const encResult = detectEncoding(buf);
  if (!encResult || !encResult.encoding) {
    throw new NormalizationError(
      "Encoding berkas tidak dapat dibaca.",
      "Pastikan berkas disimpan dengan format UTF-8, Latin-1, atau Windows-1252.",
      "ERR_UNREADABLE_ENCODING"
    );
  }
  const text = decodeBuffer(buf, encResult.encoding, encResult.bomOffset);
  return { encoding: encResult.encoding, text };
}

export interface SniffAnalysisResult {
  encoding: DetectedEncoding;
  delimiter: string;
  stripOuterQuotes: boolean;
  headerRowIndex: number;
  skipTopRowCount: number;
  headers: string[];
  sampleDataRows: string[][];
  fixesApplied: string[];
}

export function analyzeSampleText(
  text: string,
  encoding: DetectedEncoding
): SniffAnalysisResult {
  const fixesApplied: string[] = [];
  const rawLines = text.split(/\r?\n/);
  if (rawLines.length > 1 && text.length >= 65536) {
    rawLines.pop();
  }

  const nonEmpties = rawLines.filter((l) => l.trim().length > 0);
  if (nonEmpties.length === 0) {
    throw new NormalizationError(
      "Berkas kosong atau tidak berisi baris teks.",
      "Pastikan berkas CSV/TSV memiliki baris data.",
      "ERR_EMPTY_FILE"
    );
  }

  let stripOuterQuotes = false;
  const quoteWrappedCount = nonEmpties.filter(
    (l) => l.startsWith('"') && l.endsWith('"') && l.length > 2
  ).length;

  if (quoteWrappedCount / nonEmpties.length >= 0.8) {
    stripOuterQuotes = true;
    fixesApplied.push("Tanda kutip pembungkus pada setiap baris dihapus");
  }

  const unwrap = (l: string) => {
    const trimmed = l.trim();
    if (stripOuterQuotes && trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return trimmed.slice(1, -1).replace(/""/g, '"');
    }
    return l;
  };

  const processedLines = rawLines.map(unwrap);
  const { delimiter } = detectDelimiter(processedLines);

  const parsedRows: string[][] = [];
  for (const line of processedLines) {
    parsedRows.push(splitCsvLine(line, delimiter));
  }

  const colCounts = new Map<number, number>();
  for (const row of parsedRows) {
    if (row.length >= 2 && !row.every((c) => c.trim().length === 0)) {
      colCounts.set(row.length, (colCounts.get(row.length) || 0) + 1);
    }
  }

  let dominantCols = 0;
  let maxCount = 0;
  for (const [cols, cnt] of colCounts.entries()) {
    if (cnt > maxCount) {
      maxCount = cnt;
      dominantCols = cols;
    }
  }

  let headerRowIndex = -1;
  let hasTwoHeaders = false;

  for (let i = 0; i < parsedRows.length; i++) {
    const r1 = parsedRows[i];
    if (r1.every((c) => c.trim().length === 0)) continue;
    if (r1.length < (dominantCols > 0 ? dominantCols : 2)) continue;

    if (!looksLikeDataRow(r1)) {
      const r2 = parsedRows[i + 1];
      if (
        r2 &&
        r2.length === r1.length &&
        !r2.every((c) => c.trim().length === 0) &&
        !looksLikeDataRow(r2)
      ) {
        const r3 = parsedRows[i + 2];
        if (r3 && looksLikeDataRow(r3)) {
          headerRowIndex = i;
          hasTwoHeaders = true;
          break;
        }
      }

      headerRowIndex = i;
      hasTwoHeaders = false;
      break;
    }
  }

  if (headerRowIndex === -1) {
    for (let i = 0; i < parsedRows.length; i++) {
      if (parsedRows[i].length >= (dominantCols > 0 ? dominantCols : 2)) {
        headerRowIndex = i;
        break;
      }
    }
  }

  if (headerRowIndex === -1) {
    throw new NormalizationError(
      "Baris header tidak dapat ditemukan dalam berkas.",
      "Pastikan berkas CSV memiliki header dengan nama kolom yang jelas.",
      "ERR_NO_HEADER"
    );
  }

  let headers: string[];
  let skipTopRowCount = headerRowIndex;
  const sampleDataRows = parsedRows.slice(headerRowIndex + (hasTwoHeaders ? 2 : 1));

  if (hasTwoHeaders) {
    const r1 = parsedRows[headerRowIndex];
    const r2 = parsedRows[headerRowIndex + 1];
    const res = resolveTwoHeaderRows(r1, r2, sampleDataRows);
    headers = res.headers;
    fixesApplied.push(res.fixDescription);
    skipTopRowCount = headerRowIndex + 2;
  } else {
    headers = makeUniqueHeaders(parsedRows[headerRowIndex]);
    skipTopRowCount = headerRowIndex + 1;
  }

  if (headerRowIndex > 0) {
    fixesApplied.push(
      `Melewati ${headerRowIndex} baris sampah sebelum baris header`
    );
  }

  return {
    encoding,
    delimiter,
    stripOuterQuotes,
    headerRowIndex,
    skipTopRowCount,
    headers,
    sampleDataRows,
    fixesApplied,
  };
}

export async function readFirstChunk(
  readable: Readable,
  maxBytes = 65536
): Promise<{ buffer: Buffer; remainingStream: Readable }> {
  const chunks: Buffer[] = [];
  let totalLength = 0;

  return new Promise((resolve, reject) => {
    function onData(chunk: Buffer) {
      chunks.push(chunk);
      totalLength += chunk.length;
      if (totalLength >= maxBytes) {
        cleanup();
        const fullBuffer = Buffer.concat(chunks);
        const initial = fullBuffer.subarray(0, maxBytes);
        const overflow = fullBuffer.subarray(maxBytes);

        const remaining = new PassThrough();
        if (overflow.length > 0) {
          remaining.write(overflow);
        }
        readable.pipe(remaining);
        resolve({ buffer: initial, remainingStream: remaining });
      }
    }

    function onEnd() {
      cleanup();
      const fullBuffer = Buffer.concat(chunks);
      resolve({ buffer: fullBuffer, remainingStream: Readable.from([]) });
    }

    function onError(err: Error) {
      cleanup();
      reject(err);
    }

    function cleanup() {
      readable.removeListener("data", onData);
      readable.removeListener("end", onEnd);
      readable.removeListener("error", onError);
    }

    readable.on("data", onData);
    readable.on("end", onEnd);
    readable.on("error", onError);
  });
}

export async function convertXlsxToCsvStream(
  input: Readable,
  targetSheetName?: string
): Promise<{ stream: Readable; sheetName: string; availableSheets: string[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.read(input);

  const availableSheets: string[] = workbook.worksheets.map((ws) => ws.name);
  if (availableSheets.length === 0) {
    throw new NormalizationError(
      "Berkas Excel tidak memiliki lembar kerja (worksheet).",
      "Pastikan berkas Excel memiliki setidaknya satu lembar kerja aktif.",
      "ERR_NO_SHEETS"
    );
  }

  let worksheet = workbook.worksheets[0];
  if (targetSheetName) {
    const found = workbook.worksheets.find(
      (ws) => ws.name.toLowerCase() === targetSheetName.toLowerCase()
    );
    if (!found) {
      throw new NormalizationError(
        `Sheet Excel '${targetSheetName}' tidak ditemukan.`,
        `Pilih salah satu sheet yang tersedia: ${availableSheets.join(", ")}`,
        "ERR_SHEET_NOT_FOUND"
      );
    }
    worksheet = found;
  }

  const finalSheetName = worksheet.name;
  const csvStream = new Readable({
    read() {},
  });

  (async () => {
    try {
      worksheet.eachRow((row) => {
        const rawValues = Array.isArray(row.values) ? row.values.slice(1) : [];
        const csvLine =
          rawValues
            .map((v) => {
              if (v === null || v === undefined) return "";
              if (v instanceof Date) return v.toISOString();
              if (typeof v === "object") {
                if ("result" in v && (v as { result?: unknown }).result !== undefined) {
                  return String((v as { result?: unknown }).result);
                }
                if ("text" in v && (v as { text?: unknown }).text !== undefined) {
                  return String((v as { text?: unknown }).text);
                }
                return JSON.stringify(v);
              }
              return String(v);
            })
            .map(escapeCsvField)
            .join(",") + "\n";

        csvStream.push(csvLine);
      });
      csvStream.push(null);
    } catch (err) {
      csvStream.destroy(err instanceof Error ? err : new Error(String(err)));
    }
  })();

  return { stream: csvStream, sheetName: finalSheetName, availableSheets };
}

export async function normalizeFileStream(
  rawInput: Readable,
  filename: string,
  options: { targetSheet?: string } = {}
): Promise<{
  outputStream: Readable;
  getMetadata: () => NormalizationMetadata;
}> {
  const isXlsx = filename.toLowerCase().endsWith(".xlsx");
  let inputStream = rawInput;
  let sheetName: string | undefined;
  let availableSheets: string[] | undefined;

  if (isXlsx) {
    const converted = await convertXlsxToCsvStream(rawInput, options.targetSheet);
    inputStream = converted.stream;
    sheetName = converted.sheetName;
    availableSheets = converted.availableSheets;
  }

  const { buffer: firstChunk, remainingStream } = await readFirstChunk(
    inputStream,
    65536
  );

  const { encoding, text: firstText } = detectEncodingFromBuffer(firstChunk);
  const analysis = analyzeSampleText(firstText, encoding);

  let rawLineCounter = 0;
  let emittedRowCount = 0;
  let bufferRemainder = "";

  const textDecoder =
    encoding === "Windows-1252"
      ? new TextDecoder("windows-1252")
      : encoding === "Latin-1"
      ? new TextDecoder("latin1")
      : new TextDecoder("utf-8");

  const unwrapLine = (l: string) => {
    const trimmed = l.trim();
    if (analysis.stripOuterQuotes && trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return trimmed.slice(1, -1).replace(/""/g, '"');
    }
    return l;
  };

  const transformStream = new Transform({
    transform(chunk: Buffer | string, _enc, callback) {
      try {
        const textChunk =
          typeof chunk === "string" ? chunk : textDecoder.decode(chunk, { stream: true });
        const combined = bufferRemainder + textChunk;
        const lines = combined.split(/\r?\n/);
        bufferRemainder = lines.pop() || "";

        for (const line of lines) {
          rawLineCounter++;
          const processed = unwrapLine(line);
          const trimmed = processed.trim();

          if (trimmed.length === 0) continue;

          if (rawLineCounter <= analysis.skipTopRowCount) {
            continue;
          }

          const fields = splitCsvLine(processed, analysis.delimiter);

          if (fields.every((c) => c.trim().length === 0)) {
            continue;
          }

          if (isRepeatedHeader(fields, analysis.headers)) {
            continue;
          }

          if (isTotalRow(fields)) {
            continue;
          }

          if (fields.length !== analysis.headers.length) {
            callback(
              new NormalizationError(
                `Jumlah kolom pada baris ${rawLineCounter} tidak konsisten (ditemukan ${fields.length}, diharapkan ${analysis.headers.length}).`,
                `Periksa baris ${rawLineCounter} pada berkas sumber. Pastikan tanda pemisah dan tanda kutip sudah sesuai.`,
                "ERR_INCONSISTENT_COLUMNS"
              )
            );
            return;
          }

          if (emittedRowCount === 0) {
            this.push(analysis.headers.map(escapeCsvField).join(",") + "\n");
          }

          const formattedLine = fields.map(escapeCsvField).join(",") + "\n";
          this.push(formattedLine);
          emittedRowCount++;
        }

        callback();
      } catch (err) {
        callback(err instanceof Error ? err : new Error(String(err)));
      }
    },
    flush(callback) {
      try {
        const textChunk = bufferRemainder + textDecoder.decode();
        if (textChunk.trim().length > 0) {
          rawLineCounter++;
          const processed = unwrapLine(textChunk);
          const fields = splitCsvLine(processed, analysis.delimiter);

          if (
            rawLineCounter > analysis.skipTopRowCount &&
            !isRepeatedHeader(fields, analysis.headers) &&
            !isTotalRow(fields) &&
            !fields.every((c) => c.trim().length === 0)
          ) {
            if (fields.length !== analysis.headers.length) {
              callback(
                new NormalizationError(
                  `Jumlah kolom pada baris ${rawLineCounter} tidak konsisten (ditemukan ${fields.length}, diharapkan ${analysis.headers.length}).`,
                  `Periksa baris ${rawLineCounter} pada berkas sumber. Pastikan tanda pemisah dan tanda kutip sudah sesuai.`,
                  "ERR_INCONSISTENT_COLUMNS"
                )
              );
              return;
            }

            if (emittedRowCount === 0) {
              this.push(analysis.headers.map(escapeCsvField).join(",") + "\n");
            }
            this.push(fields.map(escapeCsvField).join(",") + "\n");
            emittedRowCount++;
          }
        }

        if (emittedRowCount === 0 && analysis.headers.length > 0) {
          this.push(analysis.headers.map(escapeCsvField).join(",") + "\n");
        }

        callback();
      } catch (err) {
        callback(err instanceof Error ? err : new Error(String(err)));
      }
    },
  });

  const fullStream = new PassThrough();
  fullStream.write(firstChunk);
  remainingStream.pipe(fullStream);
  fullStream.pipe(transformStream);

  const metadata: NormalizationMetadata = {
    encoding: analysis.encoding,
    delimiter: analysis.delimiter,
    headerRowIndex: analysis.headerRowIndex,
    rowCount: 0,
    columnCount: analysis.headers.length,
    columns: analysis.headers,
    fixesApplied: analysis.fixesApplied,
    sheetName,
    availableSheets,
  };

  const getMetadata = () => {
    return {
      ...metadata,
      rowCount: emittedRowCount,
    };
  };

  return {
    outputStream: transformStream,
    getMetadata,
  };
}
