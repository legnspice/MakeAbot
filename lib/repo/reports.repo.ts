import { db } from "../db";
import { reports, type InsertReport } from "../db/schema";

export async function insertReport(data: InsertReport) {
  return await db.insert(reports).values(data).returning();
}
