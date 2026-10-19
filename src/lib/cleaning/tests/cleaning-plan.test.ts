import { describe, it, expect } from "vitest";
import { CleaningPlanSchema, CleaningPlan } from "../schema";
import { generateCleaningSql } from "../sql-generator";
import { calculateSimilarity, findBestColumnMatch } from "../../detector/similarity";

describe("Cleaning Plan Zod Validation", () => {
  it("validates a complete, well-formed cleaning plan", () => {
    const validPlan: CleaningPlan = {
      version: "1.0",
      jobId: "job-123",
      sourceVolumePath: "/Volumes/main/csv_tidy/raw_uploads/job-123/data.csv",
      sourceOptions: {
        delimiter: ";",
        header: true,
        headerRowIndex: 0,
        encoding: "UTF-8",
      },
      operations: [
        { type: "trim", column: "nama_pelanggan", mode: "both" },
        { type: "case_change", column: "nama_pelanggan", mode: "title" },
        {
          type: "strip_currency",
          column: "total_bayar",
          currency: "Rp",
          decimalSeparator: ",",
        },
        {
          type: "parse_date",
          column: "tanggal_transaksi",
          format: "dd/MM/yyyy",
        },
        {
          type: "parse_boolean",
          column: "lunas",
          trueValues: ["ya", "y", "true"],
          falseValues: ["tidak", "t", "false"],
        },
        { type: "fill_null", column: "catatan", fillValue: "Tidak ada catatan" },
        { type: "rename", source: "nama_pelanggan", target: "customer_name" },
      ],
    };

    const parsed = CleaningPlanSchema.safeParse(validPlan);
    expect(parsed.success).toBe(true);
  });

  it("rejects unknown operation types outside the whitelist", () => {
    const invalidPlan = {
      version: "1.0",
      jobId: "job-123",
      sourceVolumePath: "/Volumes/main/test.csv",
      operations: [
        {
          type: "execute_arbitrary_code",
          column: "test",
        },
      ],
    };

    const parsed = CleaningPlanSchema.safeParse(invalidPlan);
    expect(parsed.success).toBe(false);
  });
});

describe("Databricks SQL Generation & Malicious Column Protection", () => {
  it("quotes all column identifiers using safe backticks and generates try_cast/try_to_date", () => {
    const plan: CleaningPlan = {
      version: "1.0",
      jobId: "job-clean-01",
      sourceVolumePath: "/Volumes/main/csv_tidy/raw_uploads/job-clean-01/sales.csv",
      sourceOptions: {
        delimiter: ";",
        header: true,
        headerRowIndex: 0,
        encoding: "UTF-8",
      },
      operations: [
        { type: "trim", column: "customer_name", mode: "both" },
        {
          type: "parse_date",
          column: "order_date",
          format: "dd/MM/yyyy",
        },
        {
          type: "strip_currency",
          column: "amount",
          decimalSeparator: ",",
        },
      ],
    };

    const result = generateCleaningSql(plan);

    expect(result.cleanSql).toContain("read_files");
    expect(result.cleanSql).toContain("format => 'csv'");
    expect(result.cleanSql).toContain("delimiter => ';'");

    expect(result.cleanSql).toContain("try_to_date(trim(`order_date`), 'dd/MM/yyyy')");
    expect(result.cleanSql).toContain("try_cast(");
    expect(result.cleanSql).toContain("`customer_name`");

    expect(result.quarantineSql).toContain("`_quarantine_reason`");
    expect(result.quarantineSql).toContain("WHERE (");
  });

  it("handles malicious column names without SQL injection vulnerabilities", () => {
    const maliciousPlan: CleaningPlan = {
      version: "1.0",
      jobId: "job-security-test",
      sourceVolumePath: "/Volumes/main/csv_tidy/raw_uploads/test.csv",
      operations: [
        {
          type: "trim",
          column: "col_with_spaces and `backtick`",
        },
        {
          type: "rename",
          source: "col_with_spaces and `backtick`",
          target: "clean_col",
        },
      ],
    };

    const result = generateCleaningSql(maliciousPlan);

    expect(result.cleanSql).toContain("`col_with_spaces and ``backtick```");
    expect(result.cleanSql).toContain("`clean_col`");

    expect(result.cleanSql).not.toContain("`col_with_spaces and `backtick``");
  });

  it("generates CREATE TABLE statements when target tables are provided", () => {
    const plan: CleaningPlan = {
      version: "1.0",
      jobId: "job-target-01",
      sourceVolumePath: "/Volumes/main/csv_tidy/raw_uploads/test.csv",
      targetTable: {
        catalog: "main",
        schema: "csv_tidy",
        table: "clean_sales",
      },
      quarantineTable: {
        catalog: "main",
        schema: "csv_tidy",
        table: "quarantine_sales",
      },
      operations: [
        {
          type: "cast",
          column: "id",
          targetType: "INT",
        },
      ],
    };

    const result = generateCleaningSql(plan);

    expect(result.createCleanTableSql).toBeDefined();
    expect(result.createCleanTableSql).toContain(
      "CREATE OR REPLACE TABLE `main`.`csv_tidy`.`clean_sales` AS"
    );

    expect(result.createQuarantineTableSql).toBeDefined();
    expect(result.createQuarantineTableSql).toContain(
      "CREATE OR REPLACE TABLE `main`.`csv_tidy`.`quarantine_sales` AS"
    );
  });

  it("generates SQL with custom column mapping, split, and merge", () => {
    const plan: CleaningPlan = {
      version: "1.0",
      jobId: "job-mapping-01",
      sourceVolumePath: "/Volumes/main/csv_tidy/raw_uploads/test.csv",
      targetTable: {
        catalog: "main",
        schema: "csv_tidy",
        table: "dim_customers",
      },
      targetColumns: [
        { id: "1", name: "customer_id", type: "INT", nullable: false },
        { id: "2", name: "first_name", type: "STRING", nullable: true },
        { id: "3", name: "last_name", type: "STRING", nullable: true },
        { id: "4", name: "full_address", type: "STRING", nullable: true },
        { id: "5", name: "source_system", type: "STRING", nullable: false },
        { id: "6", name: "notes", type: "STRING", nullable: true },
      ],
      columnMappings: [
        {
          targetColumnName: "customer_id",
          mapping: { type: "csv_column", sourceColumn: "id_pelanggan" },
        },
        {
          targetColumnName: "first_name",
          mapping: {
            type: "split",
            sourceColumn: "nama_lengkap",
            delimiter: " ",
            partIndex: 1,
          },
        },
        {
          targetColumnName: "last_name",
          mapping: {
            type: "split",
            sourceColumn: "nama_lengkap",
            delimiter: " ",
            partIndex: 2,
          },
        },
        {
          targetColumnName: "full_address",
          mapping: {
            type: "merge",
            sourceColumns: ["alamat_jalan", "kota", "provinsi"],
            separator: ", ",
          },
        },
        {
          targetColumnName: "source_system",
          mapping: { type: "constant", value: "CSV_TIDY" },
        },
        {
          targetColumnName: "notes",
          mapping: { type: "empty" },
        },
      ],
      writeMode: "create",
      operations: [],
    };

    const result = generateCleaningSql(plan);

    expect(result.cleanSql).toContain("element_at(split(`nama_lengkap`, ' '), 1)");
    expect(result.cleanSql).toContain("element_at(split(`nama_lengkap`, ' '), 2)");

    expect(result.cleanSql).toContain(
      "concat_ws(', ', `alamat_jalan`, `kota`, `provinsi`)"
    );

    expect(result.cleanSql).toContain("try_cast('CSV_TIDY' AS STRING) AS `source_system`");

    expect(result.cleanSql).toContain("CAST(NULL AS STRING) AS `notes`");

    expect(result.quarantineSql).toContain("customer_id");
  });

  it("generates MERGE INTO statement when writeMode is 'merge' with key columns", () => {
    const plan: CleaningPlan = {
      version: "1.0",
      jobId: "job-merge-01",
      sourceVolumePath: "/Volumes/main/csv_tidy/raw_uploads/test.csv",
      targetTable: {
        catalog: "main",
        schema: "csv_tidy",
        table: "dim_users",
      },
      targetColumns: [
        { id: "1", name: "user_id", type: "INT", nullable: false },
        { id: "2", name: "email", type: "STRING", nullable: false },
        { id: "3", name: "status", type: "STRING", nullable: true },
      ],
      columnMappings: [
        { targetColumnName: "user_id", mapping: { type: "csv_column", sourceColumn: "id" } },
        { targetColumnName: "email", mapping: { type: "csv_column", sourceColumn: "surel" } },
        { targetColumnName: "status", mapping: { type: "constant", value: "ACTIVE" } },
      ],
      writeMode: "merge",
      mergeKeyColumns: ["user_id"],
      operations: [],
    };

    const result = generateCleaningSql(plan);

    expect(result.createCleanTableSql).toContain("MERGE INTO `main`.`csv_tidy`.`dim_users` AS target");
    expect(result.createCleanTableSql).toContain("ON target.`user_id` = source.`user_id`");
    expect(result.createCleanTableSql).toContain("WHEN MATCHED THEN");
    expect(result.createCleanTableSql).toContain("UPDATE SET");
    expect(result.createCleanTableSql).toContain("WHEN NOT MATCHED THEN");
    expect(result.createCleanTableSql).toContain("INSERT (`user_id`, `email`, `status`)");
  });
});

describe("Column Name Similarity & Auto-Suggest", () => {
  it("matches exact and synonym column names", () => {
    const available = ["id_pelanggan", "nama_pembeli", "tgl_order", "total_harga"];

    const matchId = findBestColumnMatch("customer_id", available);
    expect(matchId).not.toBeNull();
    expect(matchId?.bestMatch).toBe("id_pelanggan");

    const matchName = findBestColumnMatch("customer_name", available);
    expect(matchName).not.toBeNull();
    expect(matchName?.bestMatch).toBe("nama_pembeli");

    const matchDate = findBestColumnMatch("order_date", available);
    expect(matchDate).not.toBeNull();
    expect(matchDate?.bestMatch).toBe("tgl_order");
  });

  it("scores exact matches higher than partial matches", () => {
    const exact = calculateSimilarity("email", "email");
    const partial = calculateSimilarity("email", "user_email");
    expect(exact).toBe(1.0);
    expect(exact).toBeGreaterThan(partial);
  });
});

describe("Security & SQL Injection Hardening Tests", () => {
  it("safely escapes malicious column names with SQL injection payloads", () => {
    const maliciousPlan: CleaningPlan = {
      version: "1.0",
      jobId: "sec-col-test",
      sourceVolumePath: "/Volumes/main/csv_tidy/raw_uploads/test.csv",
      operations: [
        {
          type: "trim",
          column: "user_input`; DROP TABLE users; --",
        },
        {
          type: "rename",
          source: "user_input`; DROP TABLE users; --",
          target: "clean_col`--",
        },
      ],
    };

    const sql = generateCleaningSql(maliciousPlan);

    expect(sql.cleanSql).toContain("`user_input``; DROP TABLE users; --`");
    expect(sql.cleanSql).toContain("`clean_col``--`");
    expect(sql.cleanSql).not.toMatch(/`user_input`; DROP TABLE/);
  });

  it("safely escapes SQL injection in constant, fill_null, and replace operation values", () => {
    const maliciousOperationsPlan: CleaningPlan = {
      version: "1.0",
      jobId: "sec-ops-test",
      sourceVolumePath: "/Volumes/main/csv_tidy/raw_uploads/test.csv",
      operations: [
        {
          type: "fill_null",
          column: "status",
          fillValue: "' OR '1'='1'; DELETE FROM users; --",
        },
        {
          type: "replace",
          column: "notes",
          pattern: "'; DROP SCHEMA prod CASCADE; --",
          replacement: "safe_val'--",
          isRegex: false,
        },
        {
          type: "parse_date",
          column: "created_at",
          format: "yyyy-MM-dd'; SHUTDOWN; --",
        },
      ],
    };

    const opsSql = generateCleaningSql(maliciousOperationsPlan);
    expect(opsSql.cleanSql).toContain("coalesce(`status`, ''' OR ''1''=''1''; DELETE FROM users; --')");
    expect(opsSql.cleanSql).toContain("replace(`notes`, '''; DROP SCHEMA prod CASCADE; --', 'safe_val''--')");
    expect(opsSql.cleanSql).toContain("try_to_date(trim(`created_at`), 'yyyy-MM-dd''; SHUTDOWN; --')");

    const maliciousMappingsPlan: CleaningPlan = {
      version: "1.0",
      jobId: "sec-map-test",
      sourceVolumePath: "/Volumes/main/csv_tidy/raw_uploads/test.csv",
      targetColumns: [
        { id: "1", name: "injected_const", type: "STRING", nullable: true },
        { id: "2", name: "split_test", type: "STRING", nullable: true },
        { id: "3", name: "merge_test", type: "STRING", nullable: true },
      ],
      columnMappings: [
        {
          targetColumnName: "injected_const",
          mapping: {
            type: "constant",
            value: "' UNION ALL SELECT secret_token FROM secrets --",
          },
        },
        {
          targetColumnName: "split_test",
          mapping: {
            type: "split",
            sourceColumn: "full_name",
            delimiter: "'; DROP TABLE audit; --",
            partIndex: 1,
          },
        },
        {
          targetColumnName: "merge_test",
          mapping: {
            type: "merge",
            sourceColumns: ["col_a", "col_b"],
            separator: "', ''); DROP TABLE t; --",
          },
        },
      ],
      writeMode: "create",
      operations: [],
    };

    const mapSql = generateCleaningSql(maliciousMappingsPlan);
    expect(mapSql.cleanSql).toContain("''' UNION ALL SELECT secret_token FROM secrets --'");
    expect(mapSql.cleanSql).toContain("split(`full_name`, '''; DROP TABLE audit; --')");
    expect(mapSql.cleanSql).toContain("concat_ws(''', ''''); DROP TABLE t; --', `col_a`, `col_b`)");
    expect(mapSql.quarantineSql).toBeDefined();
    expect(mapSql.quarantineSql).not.toContain("DELETE FROM users; --");
  });

  it("handles malicious target table and catalog names without breaking DDL syntax", () => {
    const maliciousTablePlan: CleaningPlan = {
      version: "1.0",
      jobId: "sec-table-test",
      sourceVolumePath: "/Volumes/main/test.csv",
      targetTable: {
        catalog: "main`--",
        schema: "csv_tidy`; DROP SCHEMA --",
        table: "safe_table`--",
      },
      quarantineTable: {
        catalog: "main`--",
        schema: "csv_tidy`; DROP SCHEMA --",
        table: "quarantine`--",
      },
      operations: [],
    };

    const sql = generateCleaningSql(maliciousTablePlan);

    expect(sql.createCleanTableSql).toContain("`main``--`.`csv_tidy``; DROP SCHEMA --`.`safe_table``--`");
    expect(sql.createQuarantineTableSql).toContain("`main``--`.`csv_tidy``; DROP SCHEMA --`.`quarantine``--`");
  });
});
