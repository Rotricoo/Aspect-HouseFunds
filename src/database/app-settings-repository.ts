import type { AppSettings } from "../types/app-settings";
import { executeDatabaseTransaction } from "./database-transaction";
import { openHouseFundDatabase } from "./connection";

export const defaultAppSettings: AppSettings = {
  automaticBackupsEnabled: true,
  automaticBackupRetention: 14,
  purchasePageSize: 15,
};

export async function loadAppSettings(): Promise<AppSettings> {
  const database = await openHouseFundDatabase();
  const rows = await database.select<Array<{ setting_key: keyof AppSettings; setting_value: string }>>(
    "SELECT setting_key, setting_value FROM app_settings",
  );
  const values = new Map(rows.map((row) => [row.setting_key, row.setting_value]));
  return {
    automaticBackupsEnabled: values.get("automaticBackupsEnabled") !== "false",
    automaticBackupRetention: Number(values.get("automaticBackupRetention") ?? defaultAppSettings.automaticBackupRetention),
    purchasePageSize: Number(values.get("purchasePageSize") ?? defaultAppSettings.purchasePageSize),
  };
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  const now = new Date().toISOString();
  await executeDatabaseTransaction(
    Object.entries(settings).map(([key, value]) => ({
      sql: `INSERT INTO app_settings (setting_key, setting_value, updated_at) VALUES (?, ?, ?)
        ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value, updated_at=excluded.updated_at`,
      values: [key, String(value), now],
    })),
  );
}
