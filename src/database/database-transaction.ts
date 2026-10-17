import { invoke } from "@tauri-apps/api/core";

export type DatabaseValue = string | number | boolean | null;

export interface DatabaseStatement {
  sql: string;
  values?: DatabaseValue[];
}

export async function executeDatabaseTransaction(statements: DatabaseStatement[]): Promise<void> {
  await invoke("execute_database_transaction", {
    statements: statements.map((statement) => ({
      sql: statement.sql,
      values: statement.values ?? [],
    })),
  });
}
