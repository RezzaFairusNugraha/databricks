import { quoteIdentifier, quoteTable } from "../databricks/sql-builder";
import { CleaningPlan, CleaningPlanSchema } from "./schema";

export interface GeneratedSqlResult {
  cleanSql: string;
  quarantineSql: string;
  createCleanTableSql?: string;
  createQuarantineTableSql?: string;
  previewSql: string;
  rawPreviewSql: string;
}

function escapeSqlString(str: string): string {
  return str.replace(/'/g, "''");
}

export function generateCleaningSql(rawPlan: unknown): GeneratedSqlResult {
  const plan: CleaningPlan = CleaningPlanSchema.parse(rawPlan);

  const delimiter = escapeSqlString(plan.sourceOptions?.delimiter || ",");
  const volumePath = escapeSqlString(plan.sourceVolumePath);

  const columnExprs = new Map<string, string>();
  const quarantineChecks: Array<{ column: string; condition: string; reason: string }> = [];
  const columnAliases = new Map<string, string>();

  const getExpr = (col: string) => columnExprs.get(col) || quoteIdentifier(col);

  for (const op of plan.operations) {
    switch (op.type) {
      case "rename": {
        columnAliases.set(op.source, op.target);
        break;
      }

      case "trim": {
        const current = getExpr(op.column);
        if (op.mode === "left") {
          columnExprs.set(op.column, `ltrim(${current})`);
        } else if (op.mode === "right") {
          columnExprs.set(op.column, `rtrim(${current})`);
        } else {
          columnExprs.set(op.column, `trim(${current})`);
        }
        break;
      }

      case "case_change": {
        const current = getExpr(op.column);
        if (op.mode === "upper") {
          columnExprs.set(op.column, `upper(${current})`);
        } else if (op.mode === "lower") {
          columnExprs.set(op.column, `lower(${current})`);
        } else if (op.mode === "title") {
          columnExprs.set(op.column, `initcap(${current})`);
        }
        break;
      }

      case "replace": {
        const current = getExpr(op.column);
        const pat = escapeSqlString(op.pattern);
        const rep = escapeSqlString(op.replacement || "");
        if (op.isRegex) {
          columnExprs.set(op.column, `regexp_replace(${current}, '${pat}', '${rep}')`);
        } else {
          columnExprs.set(op.column, `replace(${current}, '${pat}', '${rep}')`);
        }
        break;
      }

      case "strip_currency": {
        const current = getExpr(op.column);
        const decSep = op.decimalSeparator || ",";
        let cleaned: string;

        if (decSep === ",") {
          cleaned = `replace(replace(regexp_replace(trim(${current}), '[^0-9.,-]', ''), '.', ''), ',', '.')`;
        } else {
          cleaned = `replace(regexp_replace(trim(${current}), '[^0-9.,-]', ''), ',', '')`;
        }

        const castExpr = `try_cast(${cleaned} AS DECIMAL(18, 2))`;
        columnExprs.set(op.column, castExpr);

        quarantineChecks.push({
          column: op.column,
          condition: `(${current} IS NOT NULL AND length(trim(${current})) > 0 AND ${castExpr} IS NULL)`,
          reason: `Gagal konversi mata uang/desimal pada kolom ${op.column}`,
        });
        break;
      }

      case "parse_number": {
        const current = getExpr(op.column);
        const decSep = op.decimalSeparator || ",";
        let normalizedNumber: string;

        if (decSep === ",") {
          normalizedNumber = `replace(replace(trim(${current}), '.', ''), ',', '.')`;
        } else {
          normalizedNumber = `replace(trim(${current}), ',', '')`;
        }

        const castExpr = `try_cast(${normalizedNumber} AS DECIMAL(18, 2))`;
        columnExprs.set(op.column, castExpr);

        quarantineChecks.push({
          column: op.column,
          condition: `(${current} IS NOT NULL AND length(trim(${current})) > 0 AND ${castExpr} IS NULL)`,
          reason: `Gagal mem-parsing angka pada kolom ${op.column}`,
        });
        break;
      }

      case "parse_date": {
        const current = getExpr(op.column);
        const fmt = escapeSqlString(op.format);
        const dateExpr = `try_to_date(trim(${current}), '${fmt}')`;

        const targetCol = op.outputColumn || op.column;
        columnExprs.set(targetCol, dateExpr);

        quarantineChecks.push({
          column: op.column,
          condition: `(${current} IS NOT NULL AND length(trim(${current})) > 0 AND ${dateExpr} IS NULL)`,
          reason: `Format tanggal tidak sesuai (${op.format}) pada kolom ${op.column}`,
        });
        break;
      }

      case "parse_boolean": {
        const current = getExpr(op.column);
        const trueList = (op.trueValues || ["true", "1", "ya", "y", "yes", "benar"])
          .map((v) => `'${escapeSqlString(v.toLowerCase())}'`)
          .join(", ");
        const falseList = (op.falseValues || ["false", "0", "tidak", "t", "no", "salah"])
          .map((v) => `'${escapeSqlString(v.toLowerCase())}'`)
          .join(", ");

        const boolExpr = `CASE WHEN lower(trim(${current})) IN (${trueList}) THEN TRUE WHEN lower(trim(${current})) IN (${falseList}) THEN FALSE ELSE NULL END`;
        columnExprs.set(op.column, boolExpr);

        quarantineChecks.push({
          column: op.column,
          condition: `(${current} IS NOT NULL AND length(trim(${current})) > 0 AND ${boolExpr} IS NULL)`,
          reason: `Nilai boolean tidak valid pada kolom ${op.column}`,
        });
        break;
      }

      case "map_values": {
        const current = getExpr(op.column);
        const cases = Object.entries(op.mapping)
          .map(
            ([from, to]) =>
              `WHEN ${current} = '${escapeSqlString(from)}' THEN '${escapeSqlString(to)}'`
          )
          .join(" ");

        const defaultClause = op.defaultValue
          ? `ELSE '${escapeSqlString(op.defaultValue)}'`
          : `ELSE ${current}`;

        columnExprs.set(op.column, `CASE ${cases} ${defaultClause} END`);
        break;
      }

      case "fill_null": {
        const current = getExpr(op.column);
        let fillLit: string;
        if (typeof op.fillValue === "number") {
          fillLit = String(op.fillValue);
        } else if (typeof op.fillValue === "boolean") {
          fillLit = op.fillValue ? "TRUE" : "FALSE";
        } else {
          fillLit = `'${escapeSqlString(String(op.fillValue))}'`;
        }
        columnExprs.set(op.column, `coalesce(${current}, ${fillLit})`);
        break;
      }

      case "cast": {
        const current = getExpr(op.column);
        let targetTypeSql: string = op.targetType;
        if (op.targetType === "DECIMAL") {
          targetTypeSql = `DECIMAL(${op.precision || 18}, ${op.scale || 2})`;
        }

        const castExpr = `try_cast(${current} AS ${targetTypeSql})`;
        columnExprs.set(op.column, castExpr);

        quarantineChecks.push({
          column: op.column,
          condition: `(${current} IS NOT NULL AND length(trim(string(${current}))) > 0 AND ${castExpr} IS NULL)`,
          reason: `Gagal cast ke tipe ${op.targetType} pada kolom ${op.column}`,
        });
        break;
      }

      case "drop_duplicates": {
        break;
      }
    }
  }

  const rawCte = `WITH raw_source AS (
  SELECT * FROM read_files(
    '${volumePath}',
    format => 'csv',
    header => true,
    delimiter => '${delimiter}',
    multiLine => true
  )
)`;

  const selectClauses: string[] = [];
  const targetColNames: string[] = [];

  if (plan.targetColumns && plan.targetColumns.length > 0 && plan.columnMappings) {
    for (const tc of plan.targetColumns) {
      targetColNames.push(tc.name);
      let targetTypeSql: string = tc.type;
      if (tc.type === "DECIMAL") {
        targetTypeSql = `DECIMAL(${tc.precision || 18}, ${tc.scale || 2})`;
      }

      const mapItem = plan.columnMappings.find((m) => m.targetColumnName === tc.name);
      let colExpr: string;

      if (!mapItem || mapItem.mapping.type === "empty") {
        colExpr = `CAST(NULL AS ${targetTypeSql})`;
      } else if (mapItem.mapping.type === "constant") {
        colExpr = `try_cast('${escapeSqlString(mapItem.mapping.value)}' AS ${targetTypeSql})`;
      } else if (mapItem.mapping.type === "csv_column") {
        const baseSrc = columnExprs.get(mapItem.mapping.sourceColumn) || quoteIdentifier(mapItem.mapping.sourceColumn);
        colExpr = `try_cast(${baseSrc} AS ${targetTypeSql})`;
      } else if (mapItem.mapping.type === "split") {
        const src = quoteIdentifier(mapItem.mapping.sourceColumn);
        const del = escapeSqlString(mapItem.mapping.delimiter);
        const pIdx = mapItem.mapping.partIndex;
        colExpr = `try_cast(element_at(split(${src}, '${del}'), ${pIdx}) AS ${targetTypeSql})`;
      } else if (mapItem.mapping.type === "merge") {
        const srcCols = mapItem.mapping.sourceColumns.map(quoteIdentifier).join(", ");
        const sep = escapeSqlString(mapItem.mapping.separator);
        colExpr = `try_cast(concat_ws('${sep}', ${srcCols}) AS ${targetTypeSql})`;
      } else {
        colExpr = `CAST(NULL AS ${targetTypeSql})`;
      }

      if (!tc.nullable) {
        quarantineChecks.push({
          column: tc.name,
          condition: `(${colExpr} IS NULL)`,
          reason: `Kolom wajib (non-nullable) '${tc.name}' tidak boleh bernilai NULL`,
        });
      }

      selectClauses.push(`  ${colExpr} AS ${quoteIdentifier(tc.name)}`);
    }
  } else {
    columnExprs.forEach((expr, col) => {
      const finalAlias = columnAliases.get(col) || col;
      targetColNames.push(finalAlias);
      selectClauses.push(`  ${expr} AS ${quoteIdentifier(finalAlias)}`);
    });
  }

  const projectedColumns = selectClauses.length > 0 ? selectClauses.join(",\n") : "  *";

  let quarantineFilter = "FALSE";
  let quarantineReasonExpr = "''";

  if (quarantineChecks.length > 0) {
    const conditions = quarantineChecks.map((q) => q.condition);
    quarantineFilter = conditions.join(" OR ");

    const reasonCases = quarantineChecks
      .map((q) => `CASE WHEN ${q.condition} THEN '${escapeSqlString(q.reason)}' END`)
      .join(",\n    ");

    quarantineReasonExpr = `concat_ws('; ', \n    ${reasonCases}\n  )`;
  }

  const dedupOp = plan.operations.find((op) => op.type === "drop_duplicates");
  const dedupClause =
    dedupOp && dedupOp.type === "drop_duplicates"
      ? `QUALIFY row_number() OVER (PARTITION BY ${dedupOp.columns.map(quoteIdentifier).join(", ")} ORDER BY 1) = 1`
      : "";

  const cleanSql = `${rawCte}
SELECT
${projectedColumns}
FROM raw_source
WHERE NOT (${quarantineFilter})
${dedupClause};`.trim();

  const quarantineSql = `${rawCte}
SELECT
  *,
  ${quarantineReasonExpr} AS ${quoteIdentifier("_quarantine_reason")},
  current_timestamp() AS ${quoteIdentifier("_quarantine_timestamp")}
FROM raw_source
WHERE (${quarantineFilter});`.trim();

  let createCleanTableSql: string | undefined;
  let createQuarantineTableSql: string | undefined;

  if (plan.targetTable) {
    const targetTableId = quoteTable(
      plan.targetTable.catalog,
      plan.targetTable.schema,
      plan.targetTable.table
    );

    const writeMode = plan.writeMode || "create";

    if (writeMode === "create") {
      createCleanTableSql = `CREATE OR REPLACE TABLE ${targetTableId} AS\n${cleanSql}`;
    } else if (writeMode === "append") {
      const colList = targetColNames.map(quoteIdentifier).join(", ");
      createCleanTableSql = `INSERT INTO ${targetTableId} (${colList})\n${cleanSql}`;
    } else if (writeMode === "overwrite") {
      createCleanTableSql = `INSERT OVERWRITE TABLE ${targetTableId}\n${cleanSql}`;
    } else if (writeMode === "merge" && plan.mergeKeyColumns && plan.mergeKeyColumns.length > 0) {
      const matchConditions = plan.mergeKeyColumns
        .map((k) => `target.${quoteIdentifier(k)} = source.${quoteIdentifier(k)}`)
        .join(" AND ");

      const updateClauses = targetColNames
        .filter((col) => !plan.mergeKeyColumns?.includes(col))
        .map((col) => `target.${quoteIdentifier(col)} = source.${quoteIdentifier(col)}`)
        .join(",\n      ");

      const insertCols = targetColNames.map((c) => quoteIdentifier(c)).join(", ");
      const insertVals = targetColNames.map((c) => `source.${quoteIdentifier(c)}`).join(", ");

      createCleanTableSql = `MERGE INTO ${targetTableId} AS target
USING (
${cleanSql.replace(/;$/, "")}
) AS source
ON ${matchConditions}
WHEN MATCHED THEN
  UPDATE SET
      ${updateClauses || "1 = 1"}
WHEN NOT MATCHED THEN
  INSERT (${insertCols})
  VALUES (${insertVals});`;
    } else {
      createCleanTableSql = `CREATE OR REPLACE TABLE ${targetTableId} AS\n${cleanSql}`;
    }

    const qCatalog = plan.quarantineTable?.catalog || plan.targetTable.catalog;
    const qSchema = plan.quarantineTable?.schema || plan.targetTable.schema;
    const qTable = plan.quarantineTable?.table || `${plan.targetTable.table}_quarantine`;
    const qTableId = quoteTable(qCatalog, qSchema, qTable);

    createQuarantineTableSql = `CREATE OR REPLACE TABLE ${qTableId} AS\n${quarantineSql}`;
  }

  const previewSql = `${cleanSql.replace(/;$/, "")} LIMIT 50;`;
  const rawPreviewSql = `${rawCte}\nSELECT * FROM raw_source LIMIT 50;`;

  return {
    cleanSql,
    quarantineSql,
    createCleanTableSql,
    createQuarantineTableSql,
    previewSql,
    rawPreviewSql,
  };
}
