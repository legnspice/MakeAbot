import { NextRequest, NextResponse } from "next/server";
import { expireStaleOfferBids } from "@/lib/services/offers.service";
import { expireStaleRequestBids } from "@/lib/services/requests.service";
import { sendPushToUser } from "@/lib/services/push.service";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[cron/expire-bids] starting");

    const [expiredOfferBids, expiredRequestBids] = await Promise.allSettled([
      expireStaleOfferBids(),
      expireStaleRequestBids(),
    ]);

    const offerResults =
      expiredOfferBids.status === "fulfilled" ? expiredOfferBids.value : [];
    const requestResults =
      expiredRequestBids.status === "fulfilled"
        ? expiredRequestBids.value
        : [];

    // Fire bid_expired notifications (fire-and-forget)
    await Promise.allSettled([
      ...offerResults.map((r) =>
        sendPushToUser(r.bidderId, "bid_expired", {
          title: "Inquiry closed",
          body: `${r.offerTitle} has been inactive for 2 weeks. Your inquiry was automatically closed.`,
          url: "/",
          contextId: null,
        }),
      ),
      ...requestResults.map((r) =>
        sendPushToUser(r.bidderId, "bid_expired", {
          title: "Inquiry closed",
          body: `${r.requestTitle} has been inactive for 2 weeks. Your inquiry was automatically closed.`,
          url: "/",
          contextId: null,
        }),
      ),
    ]);

    console.log("[cron/expire-bids] completed", {
      expiredOfferBids: offerResults.length,
      expiredRequestBids: requestResults.length,
    });

    return NextResponse.json({
      ok: true,
      expiredOfferBids: offerResults.length,
      expiredRequestBids: requestResults.length,
    });
  } catch (err) {
    console.error("[cron/expire-bids] failed", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
