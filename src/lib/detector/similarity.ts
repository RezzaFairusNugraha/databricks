const COMMON_SYNONYMS: Record<string, string[]> = {
  id: ["no", "kode", "code", "num", "number", "key", "identifier"],
  name: ["nama"],
  customer: ["pelanggan", "pembeli", "client", "buyer", "user"],
  date: ["tanggal", "tgl", "waktu", "time", "timestamp", "created"],
  amount: ["total", "jumlah", "nilai", "harga", "price", "subtotal", "cost"],
  status: ["kondisi", "state", "keterangan"],
  address: ["alamat", "lokasi", "location", "jalan", "kota", "city"],
  email: ["surel", "mail"],
  phone: ["telp", "telepon", "kontak", "contact", "hp", "mobile"],
  category: ["kategori", "jenis", "tipe", "type"],
  quantity: ["qty", "kuantitas", "banyak", "count"],
};

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[_\s\-\.\/]+/g, " ")
    .trim();
}

function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

export function calculateSimilarity(targetName: string, sourceName: string): number {
  const normTarget = normalizeString(targetName);
  const normSource = normalizeString(sourceName);

  if (normTarget === normSource) return 1.0;
  if (normTarget.replace(/\s+/g, "") === normSource.replace(/\s+/g, "")) return 0.95;

  const targetTokens = new Set(normTarget.split(" "));
  const sourceTokens = new Set(normSource.split(" "));

  let intersectionCount = 0;
  targetTokens.forEach((t) => {
    if (sourceTokens.has(t)) {
      intersectionCount++;
    } else {
      for (const [key, synonyms] of Object.entries(COMMON_SYNONYMS)) {
        if ((t === key || synonyms.includes(t)) && Array.from(sourceTokens).some((s) => s === key || synonyms.includes(s))) {
          intersectionCount += 0.8;
          break;
        }
      }
    }
  });

  const unionSize = new Set([...targetTokens, ...sourceTokens]).size;
  const jaccard = unionSize > 0 ? intersectionCount / unionSize : 0;

  const maxLen = Math.max(normTarget.length, normSource.length);
  const levScore = maxLen > 0 ? 1 - levenshteinDistance(normTarget, normSource) / maxLen : 0;

  return Math.max(jaccard, levScore * 0.8);
}

export function findBestColumnMatch(
  targetName: string,
  availableSourceColumns: string[],
  threshold = 0.35
): { bestMatch: string; score: number } | null {
  let highestScore = 0;
  let bestCandidate = "";

  for (const src of availableSourceColumns) {
    const score = calculateSimilarity(targetName, src);
    if (score > highestScore) {
      highestScore = score;
      bestCandidate = src;
    }
  }

  if (highestScore >= threshold && bestCandidate) {
    return { bestMatch: bestCandidate, score: highestScore };
  }

  return null;
}
