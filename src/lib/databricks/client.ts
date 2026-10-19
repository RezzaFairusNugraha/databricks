import crypto from "crypto";
import fs from "fs";
import path from "path";
import { getDatabricksConfig, getDatabricksBearerToken } from "./config";
import { mapDatabricksError } from "./errors";
import {
  buildListCatalogsQuery,
  buildListSchemasQuery,
  buildListTablesQuery,
  buildListVolumesQuery,
  buildTestQuery,
  buildVolumeFilePath,
} from "./sql-builder";
import {
  CatalogItem,
  ConnectionTestResult,
  DatabricksError,
  SchemaItem,
  SqlColumn,
  SqlStatementResult,
  TableItem,
  UploadResult,
} from "./types";

interface DatabricksStatementApiResult {
  statement_id: string;
  status: {
    state:
      | "PENDING"
      | "RUNNING"
      | "SUCCEEDED"
      | "FAILED"
      | "CANCELED"
      | "CLOSED";
    error?: {
      error_code?: string;
      message?: string;
    };
  };
  manifest?: {
    format: string;
    schema?: {
      column_count: number;
      columns: Array<{
        name: string;
        type_name: string;
        type_text?: string;
        position: number;
      }>;
    };
    total_row_count?: number;
  };
  result?: {
    data_array?: unknown[][];
    row_count?: number;
  };
}

export async function runSql(
  query: string,
  options: { maxRows?: number; timeoutSecs?: number } = {},
): Promise<SqlStatementResult> {
  const config = getDatabricksConfig();
  if (!config.host || !config.warehouseId) {
    throw new DatabricksError({
      code: "ERR_AUTH_FAILED",
      message: "Databricks host or warehouse ID is not configured.",
      friendlyMessageId:
        "Host Databricks atau ID SQL Warehouse belum dikonfigurasi.",
      friendlyMessageEn:
        "Databricks host or SQL Warehouse ID is not configured.",
      statusCode: 500,
    });
  }

  const token = await getDatabricksBearerToken();
  const startTime = Date.now();
  const timeoutMs = (options.timeoutSecs || 90) * 1000;

  try {
    const postRes = await fetch(`${config.host}/api/2.0/sql/statements`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        warehouse_id: config.warehouseId,
        statement: query,
        wait_timeout: "25s",
        on_wait_timeout: "CONTINUE",
        format: "JSON_ARRAY",
        row_limit: options.maxRows || 1000,
      }),
    });

    if (!postRes.ok) {
      const errText = await postRes.text();
      throw mapDatabricksError(
        new Error(`SQL submission failed (${postRes.status}): ${errText}`),
      );
    }

    let statementData = (await postRes.json()) as DatabricksStatementApiResult;
    let state = statementData.status.state;

    while (state === "PENDING" || state === "RUNNING") {
      if (Date.now() - startTime > timeoutMs) {
        throw new DatabricksError({
          code: "ERR_TIMEOUT",
          message: "SQL statement execution timed out waiting for warehouse.",
          friendlyMessageId:
            "Eksekusi SQL melebihi batas waktu (timeout). SQL Warehouse mungkin sedang melakukan cold-start.",
          friendlyMessageEn:
            "SQL execution timed out. The SQL Warehouse might be undergoing a cold start.",
          suggestion: "Tunggu 30 detik lalu ulangi pengujian atau query.",
          statusCode: 504,
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const pollRes = await fetch(
        `${config.host}/api/2.0/sql/statements/${statementData.statement_id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!pollRes.ok) {
        const pollErr = await pollRes.text();
        throw mapDatabricksError(
          new Error(`SQL polling failed (${pollRes.status}): ${pollErr}`),
        );
      }

      statementData = (await pollRes.json()) as DatabricksStatementApiResult;
      state = statementData.status.state;
    }

    if (state === "FAILED" || state === "CANCELED" || state === "CLOSED") {
      const errorDetail =
        statementData.status.error?.message ||
        `SQL statement terminated with state: ${state}`;
      throw mapDatabricksError(new Error(errorDetail));
    }

    const columns: SqlColumn[] =
      statementData.manifest?.schema?.columns?.map((col) => ({
        name: col.name,
        type_name: col.type_name,
        type_text: col.type_text,
        position: col.position,
      })) || [];

    const rawRows = statementData.result?.data_array || [];
    const rows: Array<Record<string, unknown>> = rawRows.map((rowArr) => {
      const rowObj: Record<string, unknown> = {};
      columns.forEach((col, idx) => {
        rowObj[col.name] = rowArr[idx];
      });
      return rowObj;
    });

    return {
      statementId: statementData.statement_id,
      status: state,
      columns,
      rows,
      rowCount: statementData.result?.row_count ?? rows.length,
      executionDurationMs: Date.now() - startTime,
    };
  } catch (err) {
    throw mapDatabricksError(err);
  }
}

export async function testConnection(): Promise<ConnectionTestResult> {
  const config = getDatabricksConfig();
  const diagnostics: ConnectionTestResult["diagnostics"] = [];
  const start = Date.now();

  if (!config.host || !config.warehouseId || !config.token) {
    return {
      success: false,
      latencyMs: 0,
      failedStep: "unknown",
      message: "Konfigurasi Databricks belum lengkap di menu Pengaturan.",
      suggestion: "Lengkapi URL Workspace, SQL Warehouse ID, dan Personal Access Token di form Pengaturan.",
      diagnostics: [
        {
          step: "Pemeriksaan Pengaturan",
          status: "error",
          detail: "Parameter koneksi belum lengkap.",
          action: "Isi seluruh kolom wajib di halaman Pengaturan dan klik Simpan.",
        },
      ],
      error: "Missing configuration",
    };
  }

  diagnostics.push({
    step: "Pemeriksaan Pengaturan",
    status: "success",
    detail: `Host: ${config.host}, Warehouse ID: ${config.warehouseId}, Target: ${config.defaultCatalog}.${config.defaultSchema}.${config.defaultVolume}`,
  });

  let token: string;
  try {
    token = await getDatabricksBearerToken();
    diagnostics.push({
      step: "Token Autentikasi",
      status: "success",
      detail: "Personal Access Token terbaca dari penyimpanan terenkripsi.",
    });
  } catch (tokenErr) {
    const mapped = mapDatabricksError(tokenErr);
    diagnostics.push({
      step: "Token Autentikasi",
      status: "error",
      detail: mapped.friendlyMessageId,
      action: "Masukkan Personal Access Token baru pada menu Pengaturan dan klik Simpan.",
    });
    return {
      success: false,
      latencyMs: Date.now() - start,
      failedStep: "token",
      message: mapped.friendlyMessageId,
      suggestion: "Masukkan Personal Access Token baru pada menu Pengaturan.",
      diagnostics,
      error: mapped.message,
    };
  }

  let whRes: Response;
  try {
    whRes = await fetch(
      `${config.host}/api/2.0/sql/warehouses/${config.warehouseId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(15000),
      }
    );
  } catch (netErr) {
    const msg = netErr instanceof Error ? netErr.message : String(netErr);
    diagnostics.push({
      step: "Jangkauan URL Workspace",
      status: "error",
      detail: `Gagal menghubungi host '${config.host}': ${msg}`,
      action: "Pastikan format URL Workspace benar (contoh: https://dbc-xxxx.cloud.databricks.com), koneksi internet aktif, dan tidak terhalang firewall/proxy.",
    });
    return {
      success: false,
      latencyMs: Date.now() - start,
      failedStep: "url",
      message: "URL Workspace tidak dapat dijangkau.",
      suggestion: "Pastikan URL Workspace benar dan perangkat terhubung ke internet.",
      diagnostics,
      error: msg,
    };
  }

  if (whRes.status === 401 || whRes.status === 403) {
    diagnostics.push({
      step: "Validasi Token",
      status: "error",
      detail: `Autentikasi ditolak oleh Databricks (HTTP ${whRes.status}).`,
      action: "Buka Databricks > User Settings > Developer > Access Tokens, buat token baru, lalu perbarui token di halaman Pengaturan.",
    });
    return {
      success: false,
      latencyMs: Date.now() - start,
      failedStep: "token",
      message: "Personal Access Token tidak valid atau kedaluwarsa.",
      suggestion: "Buat token baru di menu Pengaturan Databricks lalu simpan token baru di halaman Pengaturan.",
      diagnostics,
      error: "Invalid access token",
    };
  }

  if (whRes.status === 404) {
    diagnostics.push({
      step: "Validasi SQL Warehouse",
      status: "error",
      detail: `SQL Warehouse dengan ID '${config.warehouseId}' tidak ditemukan pada workspace ini.`,
      action: "Buka menu SQL Warehouses di workspace Databricks Anda dan salin Warehouse ID yang benar dari tab Connection Details.",
    });
    return {
      success: false,
      latencyMs: Date.now() - start,
      failedStep: "warehouse",
      message: "SQL Warehouse ID tidak ditemukan.",
      suggestion: "Periksa kembali SQL Warehouse ID pada konsol Databricks Anda.",
      diagnostics,
      error: "Warehouse not found",
    };
  }

  let warehouseStatus: ConnectionTestResult["warehouseStatus"] = "UNKNOWN";
  let warehouseName = config.warehouseId;

  if (whRes.ok) {
    try {
      const whData = await whRes.json();
      warehouseStatus = whData.state;
      warehouseName = whData.name || config.warehouseId;

      if (warehouseStatus === "STOPPED") {
        diagnostics.push({
          step: "Status SQL Warehouse",
          status: "error",
          detail: `SQL Warehouse '${warehouseName}' saat ini berhenti (STOPPED).`,
          action: "Mulai (Start) SQL Warehouse di konsol Databricks Anda agar query dapat diproses.",
        });
        return {
          success: false,
          latencyMs: Date.now() - start,
          failedStep: "warehouse",
          warehouseStatus: "STOPPED",
          warehouseName,
          message: "SQL Warehouse sedang berhenti (STOPPED).",
          suggestion: "Buka konsol Databricks dan klik tombol 'Start' pada SQL Warehouse Anda.",
          diagnostics,
          error: "Warehouse stopped",
        };
      }

      if (warehouseStatus === "STARTING") {
        diagnostics.push({
          step: "Status SQL Warehouse",
          status: "warning",
          detail: `SQL Warehouse '${warehouseName}' sedang menyala (STARTING).`,
          action: "Tunggu 1-2 menit hingga status berubah menjadi RUNNING lalu lakukan tes kembali.",
        });
      } else {
        diagnostics.push({
          step: "Status SQL Warehouse",
          status: "success",
          detail: `Warehouse '${warehouseName}' aktif (${warehouseStatus}).`,
        });
      }
    } catch {}
  }

  try {
    const testSql = buildTestQuery();
    const sqlResult = await runSql(testSql, { timeoutSecs: 45 });
    diagnostics.push({
      step: "Eksekusi Query Verifikasi",
      status: "success",
      detail: `Query berhasil dieksekusi dalam ${sqlResult.executionDurationMs}ms (Statement ID: ${sqlResult.statementId}).`,
    });
  } catch (sqlErr) {
    const mapped = mapDatabricksError(sqlErr);
    const isPerm = mapped.code === "ERR_PERMISSION_DENIED";
    diagnostics.push({
      step: "Eksekusi Query Verifikasi",
      status: "error",
      detail: mapped.friendlyMessageId,
      action: isPerm
        ? "Berikan hak 'Can Use' pada SQL Warehouse kepada akun Anda di Databricks."
        : "Periksa log SQL Warehouse pada Databricks console.",
    });
    return {
      success: false,
      latencyMs: Date.now() - start,
      failedStep: isPerm ? "permission" : "warehouse",
      warehouseStatus,
      warehouseName,
      message: mapped.friendlyMessageId,
      suggestion: mapped.suggestion,
      diagnostics,
      error: mapped.message,
    };
  }

  let catalogCount = 0;
  try {
    const catalogs = await listCatalogs();
    catalogCount = catalogs.length;
    diagnostics.push({
      step: "Pemeriksaan Unity Catalog",
      status: "success",
      detail: `Terdeteksi ${catalogCount} Unity Catalog pada workspace.`,
    });

    if (config.defaultCatalog) {
      const schemas = await listSchemas(config.defaultCatalog);
      diagnostics.push({
        step: "Pemeriksaan Skema Default",
        status: "success",
        detail: `Katalog '${config.defaultCatalog}' dapat diakses (${schemas.length} skema).`,
      });

      if (config.defaultSchema) {
        const schemaFound = schemas.some(
          (s) => s.name.toLowerCase() === config.defaultSchema.toLowerCase()
        );
        if (!schemaFound) {
          diagnostics.push({
            step: "Pemeriksaan Skema Default",
            status: "error",
            detail: `Skema '${config.defaultSchema}' tidak ditemukan pada katalog '${config.defaultCatalog}'.`,
            action: `Buat skema dengan perintah: CREATE SCHEMA IF NOT EXISTS \`${config.defaultCatalog}\`.\`${config.defaultSchema}\`;`,
          });
          return {
            success: false,
            latencyMs: Date.now() - start,
            failedStep: "target",
            warehouseStatus: warehouseStatus || "RUNNING",
            warehouseName,
            message: `Skema '${config.defaultSchema}' tidak ditemukan.`,
            suggestion: `Buat skema '${config.defaultSchema}' di katalog '${config.defaultCatalog}' atau pilih dari skema yang tersedia.`,
            diagnostics,
            error: "Schema missing",
          };
        }

        if (config.defaultVolume) {
          try {
            const volumes = await listVolumes(config.defaultCatalog, config.defaultSchema);
            const volumeFound = volumes.some(
              (v) => v.name.toLowerCase() === config.defaultVolume.toLowerCase()
            );
            if (!volumeFound) {
              diagnostics.push({
                step: "Pemeriksaan Volume Default",
                status: "error",
                detail: `Volume '${config.defaultVolume}' tidak ditemukan pada skema '${config.defaultCatalog}.${config.defaultSchema}'.`,
                action: `Buat volume dengan perintah: CREATE VOLUME IF NOT EXISTS \`${config.defaultCatalog}\`.\`${config.defaultSchema}\`.\`${config.defaultVolume}\`;`,
              });
              return {
                success: false,
                latencyMs: Date.now() - start,
                failedStep: "target",
                warehouseStatus: warehouseStatus || "RUNNING",
                warehouseName,
                message: `Volume '${config.defaultVolume}' tidak ditemukan.`,
                suggestion: `Buat volume '${config.defaultVolume}' untuk menampung berkas unggahan atau pilih volume yang sudah ada.`,
                diagnostics,
                error: "Volume missing",
              };
            }

            diagnostics.push({
              step: "Pemeriksaan Volume Default",
              status: "success",
              detail: `Volume '${config.defaultCatalog}.${config.defaultSchema}.${config.defaultVolume}' siap digunakan.`,
            });
          } catch (volErr) {
            diagnostics.push({
              step: "Pemeriksaan Volume Default",
              status: "warning",
              detail: `Pemeriksaan volume dilewati: ${volErr instanceof Error ? volErr.message : "Peringatan"}`,
            });
          }
        }
      }
    }
  } catch (catErr) {
    const catMapped = mapDatabricksError(catErr);
    diagnostics.push({
      step: "Pemeriksaan Katalog",
      status: "error",
      detail: `Katalog '${config.defaultCatalog}' gagal diakses: ${catMapped.friendlyMessageId}`,
      action: `Pastikan nama katalog sesuai dan berikan hak: GRANT USE CATALOG ON CATALOG \`${config.defaultCatalog}\` TO \`user\`;`,
    });
    return {
      success: false,
      latencyMs: Date.now() - start,
      failedStep: "target",
      warehouseStatus: warehouseStatus || "RUNNING",
      warehouseName,
      message: `Katalog '${config.defaultCatalog}' tidak dapat diakses.`,
      suggestion: "Pastikan nama katalog sesuai dan akun memiliki izin USE CATALOG.",
      diagnostics,
      error: catMapped.message,
    };
  }

  const latencyMs = Date.now() - start;

  return {
    success: true,
    latencyMs,
    warehouseStatus: warehouseStatus || "RUNNING",
    warehouseName,
    catalogCount,
    message: "Koneksi ke Databricks Unity Catalog berhasil terverifikasi dan siap digunakan!",
    diagnostics,
  };
}

export async function listCatalogs(): Promise<CatalogItem[]> {
  const query = buildListCatalogsQuery();
  const res = await runSql(query);
  return res.rows
    .map((row) => {
      const name = String(
        row.catalog ||
          row.Catalog ||
          row.catalog_name ||
          Object.values(row)[0] ||
          "",
      );
      return { name };
    })
    .filter((c) => !!c.name);
}

export async function listSchemas(catalog: string): Promise<SchemaItem[]> {
  const query = buildListSchemasQuery(catalog);
  const res = await runSql(query);
  return res.rows
    .map((row) => {
      const name = String(
        row.databaseName ||
          row.schemaName ||
          row.schema ||
          row.database ||
          Object.values(row)[0] ||
          "",
      );
      return { name, catalog };
    })
    .filter((s) => !!s.name);
}

export async function listTables(
  catalog: string,
  schema: string,
): Promise<TableItem[]> {
  const query = buildListTablesQuery(catalog, schema);
  const res = await runSql(query);
  return res.rows
    .map((row) => {
      const name = String(
        row.tableName || row.table || Object.values(row)[0] || "",
      );
      const tableType = String(row.tableType || row.is_temporary || "");
      return { name, schema, catalog, tableType };
    })
    .filter((t) => !!t.name);
}

export async function listVolumes(
  catalog: string,
  schema: string
): Promise<Array<{ name: string; catalog: string; schema: string }>> {
  const query = buildListVolumesQuery(catalog, schema);
  const res = await runSql(query);
  return res.rows
    .map((row) => {
      const name = String(
        row.volumeName ||
          row.volume_name ||
          row.volume ||
          Object.values(row)[0] ||
          ""
      );
      return { name, catalog, schema };
    })
    .filter((v) => !!v.name);
}

export async function uploadToVolume(
  stream: ReadableStream | NodeJS.ReadableStream | ReadableStream<Uint8Array>,
  filename: string,
  options: {
    catalog?: string;
    schema?: string;
    volume?: string;
    subpath?: string;
  } = {},
): Promise<UploadResult> {
  const config = getDatabricksConfig();
  const token = await getDatabricksBearerToken();

  const catalog = options.catalog || config.defaultCatalog;
  const schema = options.schema || config.defaultSchema;
  const volume = options.volume || config.defaultVolume;

  const jobId = crypto.randomUUID();
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const subpath = options.subpath || `${jobId}/${safeFilename}`;

  const volumeFilePath = buildVolumeFilePath(catalog, schema, volume, subpath);
  const uploadUrl = `${config.host}/api/2.0/fs/files${volumeFilePath}?overwrite=true`;

  try {
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
      },
      body: stream as unknown as BodyInit,
      ...({ duplex: "half" } as Record<string, unknown>),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw mapDatabricksError(
        new Error(`Volume upload failed (${response.status}): ${errText}`),
      );
    }

    return {
      jobId,
      fileName: filename,
      volumeFilePath,
      fullVolumePath: `dbfs:${volumeFilePath}`,
      catalog,
      schema,
      volume,
      uploadedAt: new Date().toISOString(),
      status: "uploaded",
    };
  } catch (err) {
    throw mapDatabricksError(err);
  }
}

export async function fetchVolumeFileChunk(
  volumeFilePath: string,
  maxBytes = 65536
): Promise<Buffer> {
  if (
    volumeFilePath.startsWith("sample:") ||
    volumeFilePath.startsWith("/samples/") ||
    volumeFilePath.includes("samples/")
  ) {
    const cleanPath = volumeFilePath.replace(/^sample:/, "").replace(/^\//, "");
    const localFile = path.isAbsolute(cleanPath)
      ? cleanPath
      : path.join(process.cwd(), cleanPath);

    if (fs.existsSync(localFile)) {
      const fd = fs.openSync(localFile, "r");
      const buffer = Buffer.alloc(maxBytes);
      const bytesRead = fs.readSync(fd, buffer, 0, maxBytes, 0);
      fs.closeSync(fd);
      return buffer.subarray(0, bytesRead);
    }
  }

  const config = getDatabricksConfig();
  const token = await getDatabricksBearerToken();
  const url = `${config.host}/api/2.0/fs/files${volumeFilePath}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Range: `bytes=0-${maxBytes - 1}`,
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw mapDatabricksError(
        new Error(
          `Failed to fetch file chunk from volume (${response.status}): ${errText}`
        )
      );
    }

    if (!response.body) {
      throw new Error("Response body is null");
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    try {
      while (totalBytes < maxBytes) {
        const { done, value } = await reader.read();
        if (done || !value) break;

        const remaining = maxBytes - totalBytes;
        if (value.length > remaining) {
          chunks.push(value.subarray(0, remaining));
          totalBytes += remaining;
          break;
        } else {
          chunks.push(value);
          totalBytes += value.length;
        }
      }
    } finally {
      reader.cancel().catch(() => {});
    }

    return Buffer.concat(chunks);
  } catch (err) {
    throw mapDatabricksError(err);
  }
}

export interface AsyncStatementSubmission {
  statementId: string;
  state: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELED" | "CLOSED";
}

export interface StatementPollResult {
  statementId: string;
  state: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELED" | "CLOSED";
  rowCount?: number;
  errorMessage?: string;
  isComplete: boolean;
  isSuccess: boolean;
}

export async function submitSqlStatementAsync(
  query: string
): Promise<AsyncStatementSubmission> {
  const config = getDatabricksConfig();
  if (!config.host || !config.warehouseId) {
    throw new DatabricksError({
      code: "ERR_AUTH_FAILED",
      message: "Databricks host or warehouse ID is not configured.",
      friendlyMessageId:
        "Host Databricks atau ID SQL Warehouse belum dikonfigurasi.",
      friendlyMessageEn:
        "Databricks host or SQL Warehouse ID is not configured.",
      statusCode: 500,
    });
  }

  const token = await getDatabricksBearerToken();

  try {
    const postRes = await fetch(`${config.host}/api/2.0/sql/statements`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        warehouse_id: config.warehouseId,
        statement: query,
        wait_timeout: "0s",
        on_wait_timeout: "CONTINUE",
        format: "JSON_ARRAY",
      }),
    });

    if (!postRes.ok) {
      const errText = await postRes.text();
      throw mapDatabricksError(
        new Error(`SQL submission failed (${postRes.status}): ${errText}`)
      );
    }

    const data = (await postRes.json()) as DatabricksStatementApiResult;
    return {
      statementId: data.statement_id,
      state: data.status.state,
    };
  } catch (err) {
    throw mapDatabricksError(err);
  }
}

export async function pollSqlStatementStatus(
  statementId: string
): Promise<StatementPollResult> {
  const config = getDatabricksConfig();
  const token = await getDatabricksBearerToken();

  try {
    const pollRes = await fetch(
      `${config.host}/api/2.0/sql/statements/${statementId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!pollRes.ok) {
      const pollErr = await pollRes.text();
      throw mapDatabricksError(
        new Error(`SQL polling failed (${pollRes.status}): ${pollErr}`)
      );
    }

    const data = (await pollRes.json()) as DatabricksStatementApiResult;
    const state = data.status.state;

    return {
      statementId,
      state,
      rowCount: data.result?.row_count ?? data.manifest?.total_row_count ?? 0,
      errorMessage: data.status.error?.message,
      isComplete:
        state === "SUCCEEDED" ||
        state === "FAILED" ||
        state === "CANCELED" ||
        state === "CLOSED",
      isSuccess: state === "SUCCEEDED",
    };
  } catch (err) {
    throw mapDatabricksError(err);
  }
}
