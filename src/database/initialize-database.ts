import { openHouseFundDatabase } from "./connection";

export async function initializeDatabase() {
  const database = await openHouseFundDatabase();
  return database;
}
