export type InferredType =
  | "STRING"
  | "INT"
  | "DECIMAL"
  | "DATE"
  | "TIMESTAMP"
  | "BOOLEAN";

export interface ColumnProfile {
  columnIndex: number;
  rawHeader: string;
  normalizedName: string;
  inferredType: InferredType;
  nullCount: number;
  nullPercentage: number;
  distinctCount: number;
  sampleValues: string[];
  topValues: Array<{ value: string; count: number }>;
  isAmbiguous: boolean;
  ambiguityReason?: string;
  detectedFormat?: {
    dateFormat?: string;
    decimalSeparator?: "," | ".";
    thousandSeparator?: "." | ",";
    currencySymbol?: string;
    booleanTrueTokens?: string[];
    booleanFalseTokens?: string[];
  };
}

const NULL_TOKENS = new Set([
  "",
  "-",
  "--",
  "n/a",
  "na",
  "null",
  "none",
  "#n/a",
  "nan",
  "undefined",
]);

const BOOLEAN_TRUE_TOKENS = new Set([
  "true",
  "1",
  "ya",
  "y",
  "yes",
  "benar",
  "t",
]);

const BOOLEAN_FALSE_TOKENS = new Set([
  "false",
  "0",
  "tidak",
  "no",
  "salah",
  "f",
]);

const CURRENCY_SYMBOLS = ["rp", "rp.", "idr", "$", "usd", "€", "eur", "£"];

export function isNullOrEmpty(value: string): boolean {
  if (!value) return true;
  const trimmed = value.trim().toLowerCase();
  return NULL_TOKENS.has(trimmed);
}

export function normalizeColumnName(
  rawName: string,
  index: number,
  existingNames: Set<string>
): string {
  let name = (rawName || "").trim().toLowerCase();

  name = name.replace(/\$/g, "_usd");
  name = name.replace(/€/g, "_eur");
  name = name.replace(/%/g, "_pct");
  name = name.replace(/\?/g, "");
  name = name.replace(/[^a-z0-9]+/g, "_");
  name = name.replace(/^_+|_+$/g, "");

  if (!name) {
    name = `col_${index + 1}`;
  }

  if (/^[0-9]/.test(name)) {
    name = `col_${name}`;
  }

  let finalName = name;
  let counter = 2;
  while (existingNames.has(finalName)) {
    finalName = `${name}_${counter}`;
    counter++;
  }

  existingNames.add(finalName);
  return finalName;
}

export function profileColumn(
  rawHeader: string,
  colIndex: number,
  values: string[],
  existingNames: Set<string>
): ColumnProfile {
  const normalizedName = normalizeColumnName(rawHeader, colIndex, existingNames);
  const totalRows = values.length;

  let nullCount = 0;
  const valueCounts = new Map<string, number>();
  const nonNullValues: string[] = [];

  for (const v of values) {
    if (isNullOrEmpty(v)) {
      nullCount++;
    } else {
      const cleanVal = v.trim();
      nonNullValues.push(cleanVal);
      valueCounts.set(cleanVal, (valueCounts.get(cleanVal) || 0) + 1);
    }
  }

  const nullPercentage =
    totalRows > 0 ? Math.round((nullCount / totalRows) * 100) : 0;
  const distinctCount = valueCounts.size;

  const sortedValues = Array.from(valueCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([val, cnt]) => ({ value: val, count: cnt }));

  const sampleValues = nonNullValues.slice(0, 10);

  if (nonNullValues.length === 0) {
    return {
      columnIndex: colIndex,
      rawHeader,
      normalizedName,
      inferredType: "STRING",
      nullCount,
      nullPercentage,
      distinctCount: 0,
      sampleValues: [],
      topValues: [],
      isAmbiguous: false,
    };
  }

  let booleanMatches = 0;
  const matchedTrueTokens = new Set<string>();
  const matchedFalseTokens = new Set<string>();

  for (const v of nonNullValues) {
    const low = v.toLowerCase();
    if (BOOLEAN_TRUE_TOKENS.has(low)) {
      booleanMatches++;
      matchedTrueTokens.add(v);
    } else if (BOOLEAN_FALSE_TOKENS.has(low)) {
      booleanMatches++;
      matchedFalseTokens.add(v);
    }
  }

  if (booleanMatches / nonNullValues.length >= 0.85) {
    return {
      columnIndex: colIndex,
      rawHeader,
      normalizedName,
      inferredType: "BOOLEAN",
      nullCount,
      nullPercentage,
      distinctCount,
      sampleValues,
      topValues: sortedValues,
      isAmbiguous: false,
      detectedFormat: {
        booleanTrueTokens: Array.from(matchedTrueTokens),
        booleanFalseTokens: Array.from(matchedFalseTokens),
      },
    };
  }

  let isoDateCount = 0;
  let timestampCount = 0;
  let slashOrDashDateCount = 0;
  let dayFirstCount = 0;
  let monthFirstCount = 0;

  for (const v of nonNullValues) {
    if (
      /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?/.test(v) ||
      /^\d{2}[/-]\d{2}[/-]\d{4}[ T]\d{2}:\d{2}/.test(v)
    ) {
      timestampCount++;
      continue;
    }

    if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(v)) {
      isoDateCount++;
      continue;
    }

    const parts = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (parts) {
      slashOrDashDateCount++;
      const p1 = parseInt(parts[1], 10);
      const p2 = parseInt(parts[2], 10);

      if (p1 > 12 && p2 <= 12) {
        dayFirstCount++;
      } else if (p2 > 12 && p1 <= 12) {
        monthFirstCount++;
      }
    }
  }

  if (timestampCount / nonNullValues.length >= 0.8) {
    return {
      columnIndex: colIndex,
      rawHeader,
      normalizedName,
      inferredType: "TIMESTAMP",
      nullCount,
      nullPercentage,
      distinctCount,
      sampleValues,
      topValues: sortedValues,
      isAmbiguous: false,
      detectedFormat: {
        dateFormat: "yyyy-MM-dd HH:mm:ss",
      },
    };
  }

  const totalDates = isoDateCount + slashOrDashDateCount;
  if (totalDates / nonNullValues.length >= 0.8) {
    if (isoDateCount >= slashOrDashDateCount) {
      return {
        columnIndex: colIndex,
        rawHeader,
        normalizedName,
        inferredType: "DATE",
        nullCount,
        nullPercentage,
        distinctCount,
        sampleValues,
        topValues: sortedValues,
        isAmbiguous: false,
        detectedFormat: {
          dateFormat: "yyyy-MM-dd",
        },
      };
    }

    let dateFormat = "dd/MM/yyyy";
    let isAmbiguous = false;
    let ambiguityReason: string | undefined;

    if (dayFirstCount > 0 && monthFirstCount === 0) {
      dateFormat = "dd/MM/yyyy";
    } else if (monthFirstCount > 0 && dayFirstCount === 0) {
      dateFormat = "MM/dd/yyyy";
    } else if (dayFirstCount > monthFirstCount) {
      dateFormat = "dd/MM/yyyy";
    } else if (monthFirstCount > dayFirstCount) {
      dateFormat = "MM/dd/yyyy";
    } else {
      isAmbiguous = true;
      dateFormat = "dd/MM/yyyy";
      ambiguityReason =
        "Format tanggal ambigu (bisa DD/MM atau MM/DD karena semua angka <= 12). Default ke DD/MM/YYYY.";
    }

    return {
      columnIndex: colIndex,
      rawHeader,
      normalizedName,
      inferredType: "DATE",
      nullCount,
      nullPercentage,
      distinctCount,
      sampleValues,
      topValues: sortedValues,
      isAmbiguous,
      ambiguityReason,
      detectedFormat: {
        dateFormat,
      },
    };
  }

  let currencyCount = 0;
  let detectedCurrency = "";
  let intCount = 0;
  let idDecimalCount = 0;
  let usDecimalCount = 0;

  for (const v of nonNullValues) {
    let clean = v.toLowerCase().replace(/%/g, "").trim();

    for (const curr of CURRENCY_SYMBOLS) {
      if (clean.startsWith(curr)) {
        clean = clean.substring(curr.length).trim();
        currencyCount++;
        detectedCurrency = curr.toUpperCase();
        break;
      } else if (clean.endsWith(curr)) {
        clean = clean.substring(0, clean.length - curr.length).trim();
        currencyCount++;
        detectedCurrency = curr.toUpperCase();
        break;
      }
    }

    if (/^[-+]?\d+$/.test(clean)) {
      intCount++;
      continue;
    }

    if (/^[-+]?(\d{1,3}(\.\d{3})*|\d+),\d+$/.test(clean)) {
      idDecimalCount++;
      continue;
    }

    if (/^[-+]?(\d{1,3}(,\d{3})*|\d+)\.\d+$/.test(clean)) {
      usDecimalCount++;
      continue;
    }
  }

  const numericCount = intCount + idDecimalCount + usDecimalCount;

  if (currencyCount / nonNullValues.length >= 0.7) {
    const isIdFormat = idDecimalCount >= usDecimalCount;
    return {
      columnIndex: colIndex,
      rawHeader,
      normalizedName,
      inferredType: "DECIMAL",
      nullCount,
      nullPercentage,
      distinctCount,
      sampleValues,
      topValues: sortedValues,
      isAmbiguous: false,
      detectedFormat: {
        currencySymbol: detectedCurrency,
        decimalSeparator: isIdFormat ? "," : ".",
        thousandSeparator: isIdFormat ? "." : ",",
      },
    };
  }

  if (numericCount / nonNullValues.length >= 0.8) {
    if (intCount / nonNullValues.length >= 0.95) {
      return {
        columnIndex: colIndex,
        rawHeader,
        normalizedName,
        inferredType: "INT",
        nullCount,
        nullPercentage,
        distinctCount,
        sampleValues,
        topValues: sortedValues,
        isAmbiguous: false,
      };
    }

    const isIdFormat = idDecimalCount >= usDecimalCount;
    return {
      columnIndex: colIndex,
      rawHeader,
      normalizedName,
      inferredType: "DECIMAL",
      nullCount,
      nullPercentage,
      distinctCount,
      sampleValues,
      topValues: sortedValues,
      isAmbiguous: false,
      detectedFormat: {
        decimalSeparator: isIdFormat ? "," : ".",
        thousandSeparator: isIdFormat ? "." : ",",
      },
    };
  }

  return {
    columnIndex: colIndex,
    rawHeader,
    normalizedName,
    inferredType: "STRING",
    nullCount,
    nullPercentage,
    distinctCount,
    sampleValues,
    topValues: sortedValues,
    isAmbiguous: false,
  };
}
