import { describe, it, expect } from "vitest";
import {
  encryptToken,
  decryptToken,
  maskToken,
  normalizeWorkspaceUrl,
  SettingsInputSchema,
  getSafeSettings,
} from "../settings";

describe("Databricks Settings & AES-256-GCM Encryption", () => {
  it("encrypts and decrypts a token correctly using AES-256-GCM", () => {
    const originalToken = "test-token-bukan-asli";
    const encrypted = encryptToken(originalToken);

    expect(encrypted.data).not.toBe(originalToken);
    expect(encrypted.iv).toHaveLength(24);
    expect(encrypted.tag).toHaveLength(32);

    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(originalToken);
  });

  it("masks token showing dots and only the last 4 characters", () => {
    expect(maskToken("test-token-bukan-asli")).toBe("••••••••••••a998");
    expect(maskToken("test")).toBe("••••");
    expect(maskToken("")).toBe("");
  });

  it("normalizes workspace URLs properly", () => {
    expect(normalizeWorkspaceUrl("dbc-1234.cloud.databricks.com")).toBe(
      "https://dbc-1234.cloud.databricks.com",
    );
    expect(
      normalizeWorkspaceUrl("https://dbc-1234.cloud.databricks.com/"),
    ).toBe("https://dbc-1234.cloud.databricks.com");
    expect(normalizeWorkspaceUrl("  http://my-host.net///  ")).toBe(
      "http://my-host.net",
    );
  });

  it("validates valid settings input with Zod", () => {
    const valid = {
      host: "dbc-test.cloud.databricks.com",
      warehouseId: "wh-1234",
      token: "dapi_secret_token_1234",
      defaultCatalog: "main",
      defaultSchema: "sales",
      defaultVolume: "raw",
    };

    const parsed = SettingsInputSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.host).toBe("https://dbc-test.cloud.databricks.com");
      expect(parsed.data.maxUploadSizeMb).toBe(500);
    }
  });

  it("rejects invalid input missing mandatory fields", () => {
    const invalid = {
      host: "",
      warehouseId: "",
      defaultCatalog: "",
      defaultSchema: "",
      defaultVolume: "",
    };

    const parsed = SettingsInputSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it("safe settings does not expose the plaintext token", () => {
    const safe = getSafeSettings();
    expect(safe).not.toHaveProperty("token");
    expect(safe).not.toHaveProperty("encryptedToken");
    expect(safe.tokenMasked.startsWith("••••")).toBe(true);
  });
});
