import { detectEncoding, decodeBuffer, DetectedEncoding } from "./encoding";
import { detectDelimiter, DetectedDelimiter } from "./delimiter";
import { analyzeStructure, StructureAnalysis } from "./structure";
import { profileColumn, ColumnProfile, isNullOrEmpty } from "./type-inference";

export interface DetectionOverrides {
  delimiter?: DetectedDelimiter;
  encoding?: DetectedEncoding;
  headerRowIndex?: number;
  skipJunkRows?: boolean;
  skipTrailingTotals?: boolean;
}

export interface CellHighlight {
  rowIndex: number;
  columnIndex: number;
  type: "null_token" | "ambiguous_date" | "dirty_currency" | "mixed_number";
  originalValue: string;
  message: string;
}

export interface CsvSniffResult {
  detectedEncoding: DetectedEncoding;
  effectiveEncoding: DetectedEncoding;
  detectedDelimiter: DetectedDelimiter;
  effectiveDelimiter: DetectedDelimiter;
  structure: StructureAnalysis;
  columns: ColumnProfile[];
  previewRows: Array<Record<string, string>>;
  rawPreviewRows: string[][];
  totalSampleRows: number;
  cellHighlights: CellHighlight[];
  summary: {
    totalSampleLines: number;
    junkLinesCount: number;
    repeatedHeaderCount: number;
    trailingTotalCount: number;
    emptyColumnsCount: number;
    cleanRowCount: number;
  };
}

export function sniffCsvBuffer(
  buffer: Buffer,
  overrides: DetectionOverrides = {}
): CsvSniffResult {
  const encodingInfo = detectEncoding(buffer);
  const effectiveEncoding = overrides.encoding || encodingInfo.encoding;

  const text = decodeBuffer(
    buffer,
    effectiveEncoding,
    effectiveEncoding === "UTF-8-BOM" ? encodingInfo.bomOffset : 0
  );

  const lines = text.split(/\r\n|\n|\r/);

  const delimiterInfo = detectDelimiter(lines);
  const effectiveDelimiter = overrides.delimiter || delimiterInfo.delimiter;

  const structure = analyzeStructure(lines, effectiveDelimiter);

  let effectiveHeaderRowIdx = structure.headerRowIndex;
  if (
    overrides.headerRowIndex !== undefined &&
    overrides.headerRowIndex >= 0 &&
    overrides.headerRowIndex < lines.length
  ) {
    effectiveHeaderRowIdx = overrides.headerRowIndex;
  }

  const rawHeaders =
    structure.parsedRows[effectiveHeaderRowIdx] || structure.rawHeaders;

  const activeDataRowIndices = structure.dataRowIndices.filter((idx) => {
    if (idx <= effectiveHeaderRowIdx) return false;
    if (overrides.skipJunkRows !== false && structure.junkRowIndices.includes(idx))
      return false;
    if (
      overrides.skipTrailingTotals !== false &&
      structure.trailingTotalRowIndices.includes(idx)
    )
      return false;
    if (structure.repeatedHeaderRowIndices.includes(idx)) return false;
    if (structure.emptyRowIndices.includes(idx)) return false;
    return true;
  });

  const existingNames = new Set<string>();
  const columns: ColumnProfile[] = [];
  const totalCols = rawHeaders.length;

  for (let cIdx = 0; cIdx < totalCols; cIdx++) {
    const colValues: string[] = [];
    for (const rIdx of activeDataRowIndices) {
      const val = structure.parsedRows[rIdx]?.[cIdx] ?? "";
      colValues.push(val);
    }

    const header = rawHeaders[cIdx] || `Col_${cIdx + 1}`;
    const profile = profileColumn(header, cIdx, colValues, existingNames);
    columns.push(profile);
  }

  const previewRows: Array<Record<string, string>> = [];
  const cellHighlights: CellHighlight[] = [];

  const sampleIndices = activeDataRowIndices.slice(0, 100);

  sampleIndices.forEach((rIdx, rowDisplayIdx) => {
    const rowObj: Record<string, string> = {};
    const rowData = structure.parsedRows[rIdx] || [];

    columns.forEach((col, cIdx) => {
      const rawVal = rowData[cIdx] ?? "";
      rowObj[col.normalizedName] = rawVal;

      if (isNullOrEmpty(rawVal) && rawVal.trim().length > 0) {
        cellHighlights.push({
          rowIndex: rowDisplayIdx,
          columnIndex: cIdx,
          type: "null_token",
          originalValue: rawVal,
          message: `Nilai null terdeteksi: "${rawVal}"`,
        });
      } else if (col.inferredType === "DATE" && col.isAmbiguous) {
        cellHighlights.push({
          rowIndex: rowDisplayIdx,
          columnIndex: cIdx,
          type: "ambiguous_date",
          originalValue: rawVal,
          message: "Format tanggal ambigu (DD/MM vs MM/DD)",
        });
      } else if (col.inferredType === "DECIMAL") {
        const hasCurrency = /[$€£]|rp|idr/i.test(rawVal);
        if (hasCurrency) {
          cellHighlights.push({
            rowIndex: rowDisplayIdx,
            columnIndex: cIdx,
            type: "dirty_currency",
            originalValue: rawVal,
            message: `Simbol mata uang perlu dibersihkan: "${rawVal}"`,
          });
        }
      }
    });

    previewRows.push(rowObj);
  });

  return {
    detectedEncoding: encodingInfo.encoding,
    effectiveEncoding,
    detectedDelimiter: delimiterInfo.delimiter,
    effectiveDelimiter,
    structure,
    columns,
    previewRows,
    rawPreviewRows: sampleIndices.map((idx) => structure.parsedRows[idx] || []),
    totalSampleRows: activeDataRowIndices.length,
    cellHighlights,
    summary: {
      totalSampleLines: lines.length,
      junkLinesCount: structure.junkRowIndices.length,
      repeatedHeaderCount: structure.repeatedHeaderRowIndices.length,
      trailingTotalCount: structure.trailingTotalRowIndices.length,
      emptyColumnsCount: structure.emptyColumnIndices.length,
      cleanRowCount: activeDataRowIndices.length,
    },
  };
}
