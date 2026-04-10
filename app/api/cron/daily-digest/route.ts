import { NextRequest, NextResponse } from "next/server";
import { sendDailyDigest } from "@/lib/services/email.service";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[cron/daily-digest] starting");
    await sendDailyDigest();
    console.log("[cron/daily-digest] completed");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[cron/daily-digest] failed", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
