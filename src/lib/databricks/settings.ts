import fs from "fs";
import path from "path";
import crypto from "crypto";
import { z } from "zod";
import { DatabricksConfig } from "./types";

export interface EncryptedPayload {
  iv: string;
  tag: string;
  data: string;
}

export interface StoredSettings {
  host: string;
  warehouseId: string;
  encryptedToken?: EncryptedPayload | null;
  tokenMasked?: string;
  defaultCatalog: string;
  defaultSchema: string;
  defaultVolume: string;
  maxUploadSizeMb: number;
  updatedAt?: string;
}

export interface SafeSettings {
  host: string;
  warehouseId: string;
  tokenMasked: string;
  hasToken: boolean;
  defaultCatalog: string;
  defaultSchema: string;
  defaultVolume: string;
  volumePath: string;
  maxUploadSizeMb: number;
  isConfigured: boolean;
}

const DATA_DIR = path.join(process.cwd(), "data");
const KEY_FILE = path.join(DATA_DIR, ".key");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getOrCreateKey(): Buffer {
  ensureDataDir();
  if (fs.existsSync(KEY_FILE)) {
    const key = fs.readFileSync(KEY_FILE);
    if (key.length === 32) {
      return key;
    }
  }

  const newKey = crypto.randomBytes(32);
  fs.writeFileSync(KEY_FILE, newKey, { mode: 0o600 });
  try {
    fs.chmodSync(KEY_FILE, 0o600);
  } catch {}
  return newKey;
}

export function encryptToken(token: string): EncryptedPayload {
  const key = getOrCreateKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(token, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");
  return {
    iv: iv.toString("hex"),
    tag,
    data: encrypted,
  };
}

export function decryptToken(payload: EncryptedPayload): string {
  const key = getOrCreateKey();
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(payload.iv, "hex"),
  );
  decipher.setAuthTag(Buffer.from(payload.tag, "hex"));
  let decrypted = decipher.update(payload.data, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export function normalizeWorkspaceUrl(rawUrl: string): string {
  let cleaned = rawUrl.trim();
  if (!cleaned) return "";
  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = `https://${cleaned}`;
  }
  return cleaned.replace(/\/+$/, "");
}

export const SettingsInputSchema = z.object({
  host: z
    .string()
    .min(1, "URL Workspace wajib diisi")
    .transform(normalizeWorkspaceUrl)
    .refine((val) => {
      try {
        const u = new URL(val);
        return u.protocol === "https:" || u.protocol === "http:";
      } catch {
        return false;
      }
    }, "Format URL Workspace tidak valid"),
  warehouseId: z.string().min(1, "SQL Warehouse ID wajib diisi").trim(),
  token: z.string().trim().optional(),
  defaultCatalog: z.string().min(1, "Katalog wajib diisi").trim(),
  defaultSchema: z.string().min(1, "Skema wajib diisi").trim(),
  defaultVolume: z.string().min(1, "Volume wajib diisi").trim(),
  maxUploadSizeMb: z.number().int().positive().default(500),
});

export type SettingsInput = z.infer<typeof SettingsInputSchema>;

export function maskToken(rawToken: string): string {
  const trimmed = rawToken.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 4) return "••••";
  return `••••••••••••${trimmed.slice(-4)}`;
}

export function readStoredSettings(): StoredSettings {
  ensureDataDir();
  if (!fs.existsSync(SETTINGS_FILE)) {
    const initialSettings: StoredSettings = {
      host: "https://dbc-f8a4707b-9fe1.cloud.databricks.com",
      warehouseId: "5e6af75272a52041",
      encryptedToken: encryptToken("test-token-bukan-asli"),
      tokenMasked: "••••••••••••a998",
      defaultCatalog: "main",
      defaultSchema: "csv_tidy",
      defaultVolume: "raw_uploads",
      maxUploadSizeMb: 500,
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(
      SETTINGS_FILE,
      JSON.stringify(initialSettings, null, 2),
      "utf8",
    );
    return initialSettings;
  }

  try {
    const raw = fs.readFileSync(SETTINGS_FILE, "utf8");
    return JSON.parse(raw) as StoredSettings;
  } catch {
    return {
      host: "",
      warehouseId: "",
      encryptedToken: null,
      tokenMasked: "",
      defaultCatalog: "main",
      defaultSchema: "csv_tidy",
      defaultVolume: "raw_uploads",
      maxUploadSizeMb: 500,
    };
  }
}

export function getDatabricksConfigFromSettings(): DatabricksConfig {
  const stored = readStoredSettings();
  let decrypted = "";
  if (stored.encryptedToken) {
    try {
      decrypted = decryptToken(stored.encryptedToken);
    } catch {}
  }

  return {
    host: stored.host || "",
    warehouseId: stored.warehouseId || "",
    token: decrypted,
    defaultCatalog: stored.defaultCatalog || "main",
    defaultSchema: stored.defaultSchema || "csv_tidy",
    defaultVolume: stored.defaultVolume || "raw_uploads",
    maxUploadSizeMb: stored.maxUploadSizeMb || 500,
  };
}

export function getSafeSettings(): SafeSettings {
  const stored = readStoredSettings();
  const hasToken = !!(stored.encryptedToken && stored.encryptedToken.data);
  const isConfigured = !!(stored.host && stored.warehouseId && hasToken);
  const catalog = stored.defaultCatalog || "main";
  const schema = stored.defaultSchema || "csv_tidy";
  const volume = stored.defaultVolume || "raw_uploads";

  return {
    host: stored.host || "",
    warehouseId: stored.warehouseId || "",
    tokenMasked: stored.tokenMasked || (hasToken ? "••••••••••••" : ""),
    hasToken,
    defaultCatalog: catalog,
    defaultSchema: schema,
    defaultVolume: volume,
    volumePath: `/Volumes/${catalog}/${schema}/${volume}`,
    maxUploadSizeMb: stored.maxUploadSizeMb || 500,
    isConfigured,
  };
}

export function writeSettings(input: SettingsInput): SafeSettings {
  ensureDataDir();
  const current = readStoredSettings();

  let encrypted = current.encryptedToken;
  let tokenMasked = current.tokenMasked || "";

  if (input.token && input.token.trim().length > 0) {
    const trimmed = input.token.trim();
    encrypted = encryptToken(trimmed);
    tokenMasked = maskToken(trimmed);
  }

  const updated: StoredSettings = {
    host: input.host,
    warehouseId: input.warehouseId,
    encryptedToken: encrypted,
    tokenMasked,
    defaultCatalog: input.defaultCatalog,
    defaultSchema: input.defaultSchema,
    defaultVolume: input.defaultVolume,
    maxUploadSizeMb: input.maxUploadSizeMb || 500,
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2), "utf8");
  return getSafeSettings();
}
