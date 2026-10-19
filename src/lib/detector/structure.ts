import { splitCsvLine } from "./delimiter";

export interface StructureAnalysis {
  headerRowIndex: number;
  rawHeaders: string[];
  junkRowIndices: number[];
  emptyRowIndices: number[];
  emptyColumnIndices: number[];
  repeatedHeaderRowIndices: number[];
  trailingTotalRowIndices: number[];
  dataRowIndices: number[];
  parsedRows: string[][];
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

export function analyzeStructure(
  rawLines: string[],
  delimiter: string
): StructureAnalysis {
  const parsedRows: string[][] = [];
  const emptyRowIndices: number[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const cells = splitCsvLine(line, delimiter);
    const isEmpty = cells.every((c) => c.trim().length === 0);

    if (isEmpty) {
      emptyRowIndices.push(i);
    }
    parsedRows.push(cells);
  }

  const colCountFreq = new Map<number, number>();
  for (let i = 0; i < parsedRows.length; i++) {
    if (emptyRowIndices.includes(i)) continue;
    const len = parsedRows[i].length;
    if (len > 1) {
      colCountFreq.set(len, (colCountFreq.get(len) || 0) + 1);
    }
  }

  let modalColCount = 1;
  let maxFreq = 0;
  colCountFreq.forEach((freq, count) => {
    if (freq > maxFreq) {
      maxFreq = freq;
      modalColCount = count;
    }
  });

  let headerRowIndex = 0;
  let bestHeaderScore = -100;

  const scanLimit = Math.min(15, parsedRows.length);
  for (let i = 0; i < scanLimit; i++) {
    if (emptyRowIndices.includes(i)) continue;

    const row = parsedRows[i];
    if (row.length < 2) continue;

    const filledCells = row.filter((c) => c.length > 0);
    if (filledCells.length <= 1 && modalColCount > 2) {
      continue;
    }

    let stringCount = 0;
    let numberCount = 0;
    const uniqueValues = new Set<string>();

    for (const cell of row) {
      const val = cell.trim();
      if (!val) continue;

      uniqueValues.add(val.toLowerCase());

      if (/^[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?$/.test(val.replace(/,/g, ""))) {
        numberCount++;
      } else {
        stringCount++;
      }
    }

    const lengthMatch = row.length === modalColCount ? 10 : 0;
    const stringRatio = row.length > 0 ? (stringCount - numberCount * 2) : 0;
    const uniqueRatio = filledCells.length > 0 ? (uniqueValues.size / filledCells.length) * 5 : 0;

    const score = lengthMatch + stringRatio + uniqueRatio;

    if (score > bestHeaderScore) {
      bestHeaderScore = score;
      headerRowIndex = i;
    }
  }

  const junkRowIndices: number[] = [];
  for (let i = 0; i < headerRowIndex; i++) {
    if (!emptyRowIndices.includes(i)) {
      junkRowIndices.push(i);
    }
  }

  const rawHeaders = parsedRows[headerRowIndex] || [];
  const normalizedHeaderRow = rawHeaders.map((h) => h.toLowerCase().trim());

  const repeatedHeaderRowIndices: number[] = [];
  const trailingTotalRowIndices: number[] = [];
  const dataRowIndices: number[] = [];

  for (let i = headerRowIndex + 1; i < parsedRows.length; i++) {
    if (emptyRowIndices.includes(i)) continue;

    const row = parsedRows[i];

    const matchesHeader =
      row.length === rawHeaders.length &&
      row.filter((c, idx) => c.toLowerCase().trim() === normalizedHeaderRow[idx])
        .length >= Math.max(2, Math.floor(rawHeaders.length * 0.7));

    if (matchesHeader) {
      repeatedHeaderRowIndices.push(i);
      continue;
    }

    const firstCell = (row[0] || "").toLowerCase().trim();
    const secondCell = (row[1] || "").toLowerCase().trim();
    const isTotalRow = TOTAL_KEYWORDS.some(
      (kw) => firstCell.includes(kw) || secondCell.includes(kw)
    );

    if (isTotalRow) {
      trailingTotalRowIndices.push(i);
      continue;
    }

    dataRowIndices.push(i);
  }

  const emptyColumnIndices: number[] = [];
  const totalCols = rawHeaders.length;

  for (let colIdx = 0; colIdx < totalCols; colIdx++) {
    const headerName = (rawHeaders[colIdx] || "").trim();
    let hasData = false;

    for (const rIdx of dataRowIndices) {
      const cellVal = parsedRows[rIdx]?.[colIdx]?.trim();
      if (cellVal && cellVal.length > 0) {
        hasData = true;
        break;
      }
    }

    if (!hasData && headerName.length === 0) {
      emptyColumnIndices.push(colIdx);
    }
  }

  return {
    headerRowIndex,
    rawHeaders,
    junkRowIndices,
    emptyRowIndices,
    emptyColumnIndices,
    repeatedHeaderRowIndices,
    trailingTotalRowIndices,
    dataRowIndices,
    parsedRows,
  };
}
