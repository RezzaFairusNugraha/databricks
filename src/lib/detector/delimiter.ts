export type DetectedDelimiter = "," | ";" | "\t" | "|";

export const DELIMITER_CANDIDATES: DetectedDelimiter[] = [",", ";", "\t", "|"];

export function parseCsvLines(text: string): string[] {
  return text.split(/\r\n|\n|\r/).filter((line) => line.trim().length > 0);
}

export function splitCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function countDelimiterOccurrences(line: string, delimiter: string): number {
  let count = 0;
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      count++;
    }
  }

  return count;
}

export function detectDelimiter(lines: string[]): {
  delimiter: DetectedDelimiter;
  confidence: number;
  columnCount: number;
} {
  const validLines = lines
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 50);

  if (validLines.length === 0) {
    return { delimiter: ",", confidence: 0.5, columnCount: 1 };
  }

  let bestDelimiter: DetectedDelimiter = ",";
  let bestScore = -1;
  let bestExpectedCols = 1;

  for (const delim of DELIMITER_CANDIDATES) {
    const counts = validLines.map((line) =>
      countDelimiterOccurrences(line, delim)
    );

    const nonZeroCounts = counts.filter((c) => c > 0);
    if (nonZeroCounts.length === 0) continue;

    const frequencyMap = new Map<number, number>();
    let maxFrequency = 0;
    let mostCommonCount = 0;

    for (const c of counts) {
      if (c === 0) continue;
      const freq = (frequencyMap.get(c) || 0) + 1;
      frequencyMap.set(c, freq);
      if (freq > maxFrequency) {
        maxFrequency = freq;
        mostCommonCount = c;
      }
    }

    const consistencyRatio = maxFrequency / validLines.length;
    const columnBonus = mostCommonCount >= 1 ? 1.5 : 0.5;
    const score = consistencyRatio * columnBonus * (mostCommonCount + 1);

    if (score > bestScore) {
      bestScore = score;
      bestDelimiter = delim;
      bestExpectedCols = mostCommonCount + 1;
    }
  }

  return {
    delimiter: bestDelimiter,
    confidence: Math.min(1.0, Math.max(0.2, bestScore / 5)),
    columnCount: bestExpectedCols,
  };
}
