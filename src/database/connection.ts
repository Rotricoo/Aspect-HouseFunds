import Database from "@tauri-apps/plugin-sql";

export async function openHouseFundDatabase() {
  const database = await Database.load("sqlite:housefund.db");
  return database;
}
