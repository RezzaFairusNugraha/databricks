import crypto from "crypto";
import { getDatabricksConfig, getDatabricksBearerToken } from "./config";
import { mapDatabricksError } from "./errors";
import {
  buildListCatalogsQuery,
  buildListSchemasQuery,
  buildListTablesQuery,
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

    // Poll if still PENDING or RUNNING (handles warehouse auto-start)
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

  if (!config.host || !config.warehouseId) {
    return {
      success: false,
      latencyMs: 0,
      message:
        "DATABRICKS_HOST atau DATABRICKS_WAREHOUSE_ID belum diisi di environment variables.",
      diagnostics: [
        {
          step: "Environment Variables",
          status: "error",
          detail:
            "Environment variables DATABRICKS_HOST atau DATABRICKS_WAREHOUSE_ID tidak ditemukan.",
        },
      ],
      error: "Missing configuration",
    };
  }

  try {
    diagnostics.push({
      step: "Environment Configuration",
      status: "success",
      detail: `Host: ${config.host}, Warehouse ID: ${config.warehouseId}, Target: ${config.defaultCatalog}.${config.defaultSchema}.${config.defaultVolume}`,
    });

    // 1. Check Bearer Token resolution
    let token: string;
    try {
      token = await getDatabricksBearerToken();
      diagnostics.push({
        step: "Token Resolution",
        status: "success",
        detail: `Token berhasil didapatkan via ${config.token ? "PAT" : "OAuth M2M"}.`,
      });
    } catch (tokenErr) {
      const mapped = mapDatabricksError(tokenErr);
      diagnostics.push({
        step: "Token Resolution",
        status: "error",
        detail: mapped.friendlyMessageId,
      });
      return {
        success: false,
        latencyMs: Date.now() - start,
        message: mapped.friendlyMessageId,
        diagnostics,
        error: mapped.message,
      };
    }

    // 2. Fetch Warehouse Status
    let warehouseStatus: ConnectionTestResult["warehouseStatus"] = "UNKNOWN";
    let warehouseName = "";
    try {
      const whRes = await fetch(
        `${config.host}/api/2.0/sql/warehouses/${config.warehouseId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (whRes.ok) {
        const whData = await whRes.json();
        warehouseStatus = whData.state;
        warehouseName = whData.name || config.warehouseId;
        diagnostics.push({
          step: "Warehouse API Check",
          status: "success",
          detail: `Warehouse '${warehouseName}' status: ${warehouseStatus} (Size: ${whData.cluster_size || "Auto"})`,
        });
      } else {
        diagnostics.push({
          step: "Warehouse API Check",
          status: "warning",
          detail: `Peringatan: API status warehouse mengembalikan HTTP ${whRes.status}. Melanjutkan uji SQL...`,
        });
      }
    } catch (whErr) {
      diagnostics.push({
        step: "Warehouse API Check",
        status: "warning",
        detail: `Tidak dapat memverifikasi status warehouse: ${whErr instanceof Error ? whErr.message : "Error"}`,
      });
    }

    // 3. Execute live test query via SQL Statements API
    try {
      const testSql = buildTestQuery();
      const sqlResult = await runSql(testSql, { timeoutSecs: 45 });
      diagnostics.push({
        step: "SQL Statements API Test",
        status: "success",
        detail: `Query verifikasi berhasil dieksekusi dalam ${sqlResult.executionDurationMs}ms (Statement ID: ${sqlResult.statementId}).`,
      });
    } catch (sqlErr) {
      const mapped = mapDatabricksError(sqlErr);
      diagnostics.push({
        step: "SQL Statements API Test",
        status: "error",
        detail: mapped.friendlyMessageId,
      });
      return {
        success: false,
        latencyMs: Date.now() - start,
        warehouseStatus,
        warehouseName,
        message: mapped.friendlyMessageId,
        diagnostics,
        error: mapped.message,
      };
    }

    // 4. List catalogs check
    let catalogCount = 0;
    try {
      const catalogs = await listCatalogs();
      catalogCount = catalogs.length;
      diagnostics.push({
        step: "Unity Catalog Verification",
        status: "success",
        detail: `Terdeteksi ${catalogCount} Unity Catalog pada workspace.`,
      });
    } catch (catErr) {
      diagnostics.push({
        step: "Unity Catalog Verification",
        status: "warning",
        detail: `Daftar katalog tidak dapat diambil: ${catErr instanceof Error ? catErr.message : "Error"}`,
      });
    }

    const latencyMs = Date.now() - start;

    return {
      success: true,
      latencyMs,
      warehouseStatus: warehouseStatus || "RUNNING",
      warehouseName,
      catalogCount,
      message:
        "Koneksi ke Databricks Unity Catalog berhasil terverifikasi dan siap digunakan!",
      diagnostics,
    };
  } catch (err) {
    const mapped = mapDatabricksError(err);
    return {
      success: false,
      latencyMs: Date.now() - start,
      message: mapped.friendlyMessageId,
      diagnostics,
      error: mapped.message,
    };
  }
}

/**
 * Lists all catalogs in Unity Catalog.
 */
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

/**
Lists *  schemas in a given catalog.
 */
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

/**
 * Lists tables in a given catalog and schema.
 */
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

/**
 * Streams a file directly to Databricks Unity Catalog Volume via the Files API.
 * NEVER loads the whole CSV into server memory.
 * Uses HTTP PUT with stream body and duplex: 'half'.
 */
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
    // Stream directly to Databricks Files API
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
      },
      body: stream as unknown as BodyInit,
      // @ts-expect-error duplex is required in Node.js fetch when streaming body
      duplex: "half",
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
