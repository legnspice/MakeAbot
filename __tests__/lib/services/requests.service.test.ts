import * as requestsService from "@/lib/services/requests.service";
import * as requestsRepo from "@/lib/repo/requests.repo";

jest.mock("@/lib/repo/requests.repo");
jest.mock("@/lib/services/push.service");
jest.mock("@/lib/services/broadcast.service");

describe("requests.service bid scoping", () => {
  beforeEach(() => jest.clearAllMocks());

  it("withdrawRequestBid closes the bid through the bidder-and-Pending-scoped repo fn", async () => {
    (requestsRepo.withdrawRequestBidForBidder as jest.Mock).mockResolvedValue(
      true,
    );

    await requestsService.withdrawRequestBid("bid-1", "bidder-1");

    expect(requestsRepo.withdrawRequestBidForBidder).toHaveBeenCalledWith(
      "bid-1",
      "bidder-1",
    );
    expect(requestsRepo.updateRequestBidStatus).not.toHaveBeenCalled();
    expect(requestsRepo.updateRequestBidStatusForBidder).not.toHaveBeenCalled();
  });

  it("reopenRequestBid reopens the bid through the bidder-scoped repo fn", async () => {
    await requestsService.reopenRequestBid("bid-1", "bidder-1");

    expect(requestsRepo.updateRequestBidStatusForBidder).toHaveBeenCalledWith(
      "bid-1",
      "bidder-1",
      "Pending",
    );
    expect(requestsRepo.updateRequestBidStatus).not.toHaveBeenCalled();
  });
});

const OWNER = "user-owner";
const activeRequest = {
  id: "req-1",
  user_id: OWNER,
  title: "Need a pen",
  status: "Active",
};

describe("requestsService.createRequestBid", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requestsRepo.insertRequestBid as jest.Mock).mockResolvedValue({
      id: "bid-new",
      request_id: "req-1",
      bidder_id: "bidder-new",
    });
    (requestsRepo.findRequestById as jest.Mock).mockResolvedValue(activeRequest);
  });

  it("touches the parent request so the expiry clock resets", async () => {
    await requestsService.createRequestBid({
      request_id: "req-1",
      bidder_id: "bidder-new",
    });

    expect(requestsRepo.updateRequest).toHaveBeenCalledWith(
      "req-1",
      { updated_at: expect.any(Date) },
      OWNER,
    );
  });

  it("still returns the bid when the parent lookup finds nothing", async () => {
    (requestsRepo.findRequestById as jest.Mock).mockResolvedValue(undefined);

    const bid = await requestsService.createRequestBid({
      request_id: "req-1",
      bidder_id: "bidder-new",
    });

    expect(bid).toEqual({ id: "bid-new", request_id: "req-1", bidder_id: "bidder-new" });
    expect(requestsRepo.updateRequest).not.toHaveBeenCalled();
  });

  it("fails closed (throws, does not insert) when the parent lookup rejects", async () => {
    // A thrown read means we cannot confirm the request is still Active, so
    // the guard must not let the bid through — unlike a genuine "not found"
    // (see the "finds nothing" case above), which fails open.
    (requestsRepo.findRequestById as jest.Mock).mockRejectedValue(
      new Error("db unavailable"),
    );

    await expect(
      requestsService.createRequestBid({
        request_id: "req-1",
        bidder_id: "bidder-new",
      }),
    ).rejects.toThrow("Could not verify this request is still open");

    expect(requestsRepo.insertRequestBid).not.toHaveBeenCalled();
  });

  it("still returns the bid when the parent update throws", async () => {
    (requestsRepo.updateRequest as jest.Mock).mockRejectedValue(
      new Error("db unavailable"),
    );

    const bid = await requestsService.createRequestBid({
      request_id: "req-1",
      bidder_id: "bidder-new",
    });

    expect(bid).toEqual({ id: "bid-new", request_id: "req-1", bidder_id: "bidder-new" });
  });
});

describe("requestsService terminal-state guards", () => {
  beforeEach(() => jest.clearAllMocks());

  it("editRequest throws when the request is Completed, and does not call the repo update", async () => {
    (requestsRepo.findRequestById as jest.Mock).mockResolvedValue({
      ...activeRequest,
      status: "Completed",
    });

    await expect(
      requestsService.editRequest("req-1", { title: "New title" }, OWNER),
    ).rejects.toThrow("This request is closed and can no longer be edited");

    expect(requestsRepo.updateRequest).not.toHaveBeenCalled();
  });

  it("createRequestBid throws when the parent request is Completed, and does not insert", async () => {
    (requestsRepo.findRequestById as jest.Mock).mockResolvedValue({
      ...activeRequest,
      status: "Completed",
    });

    await expect(
      requestsService.createRequestBid({
        request_id: "req-1",
        bidder_id: "bidder-new",
      }),
    ).rejects.toThrow("This request is no longer accepting bids");

    expect(requestsRepo.insertRequestBid).not.toHaveBeenCalled();
  });

  it("reopenRequestBid throws when the parent request is Completed", async () => {
    (requestsRepo.findRequestBidById as jest.Mock).mockResolvedValue({
      id: "bid-1",
      request_id: "req-1",
      bidder_id: "bidder-1",
      status: "Closed",
    });
    (requestsRepo.findRequestById as jest.Mock).mockResolvedValue({
      ...activeRequest,
      status: "Completed",
    });

    await expect(
      requestsService.reopenRequestBid("bid-1", "bidder-1"),
    ).rejects.toThrow("This listing is no longer open");

    expect(requestsRepo.updateRequestBidStatusForBidder).not.toHaveBeenCalled();
  });

  it("withdrawRequestBid throws when the scoped repo call reports no row affected", async () => {
    (requestsRepo.withdrawRequestBidForBidder as jest.Mock).mockResolvedValue(
      false,
    );

    await expect(
      requestsService.withdrawRequestBid("bid-1", "bidder-1"),
    ).rejects.toThrow("This inquiry can no longer be withdrawn");
  });

  it("editRequest throws a 404 (not the terminal-state message) when the request does not exist", async () => {
    (requestsRepo.findRequestById as jest.Mock).mockResolvedValue(undefined);

    await expect(
      requestsService.editRequest(
        "req-missing",
        { title: "New title" },
        OWNER,
      ),
    ).rejects.toThrow("Request not found");

    expect(requestsRepo.updateRequest).not.toHaveBeenCalled();
  });

  it("reopenRequestBid throws a 404 (not the terminal-state message) when the parent request does not exist", async () => {
    (requestsRepo.findRequestBidById as jest.Mock).mockResolvedValue({
      id: "bid-1",
      request_id: "req-missing",
      bidder_id: "bidder-1",
      status: "Closed",
    });
    (requestsRepo.findRequestById as jest.Mock).mockResolvedValue(undefined);

    await expect(
      requestsService.reopenRequestBid("bid-1", "bidder-1"),
    ).rejects.toThrow("Request not found");

    expect(requestsRepo.updateRequestBidStatusForBidder).not.toHaveBeenCalled();
  });
});

describe("requestsService.closeRequest", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requestsRepo.findRequestById as jest.Mock).mockResolvedValue(activeRequest);
    (requestsRepo.closeRequestAtomic as jest.Mock).mockResolvedValue({
      completed: [{ id: "bid-a", bidder_id: "bidder-a" }],
      silent: [{ id: "bid-b", bidder_id: "bidder-b" }],
      finalStatus: "Completed",
    });
  });

  it("closes the request and returns only the conversing bidders", async () => {
    const result = await requestsService.closeRequest("req-1", OWNER);

    expect(requestsRepo.closeRequestAtomic).toHaveBeenCalledWith("req-1", OWNER);
    expect(result.completed).toEqual([{ id: "bid-a", bidder_id: "bidder-a" }]);
    expect(result.finalStatus).toBe("Completed");
  });

  it("reports Cancelled when nobody conversed", async () => {
    (requestsRepo.closeRequestAtomic as jest.Mock).mockResolvedValue({
      completed: [],
      silent: [],
      finalStatus: "Cancelled",
    });

    const result = await requestsService.closeRequest("req-1", OWNER);

    expect(result.finalStatus).toBe("Cancelled");
    expect(result.completed).toEqual([]);
  });

  it("rejects a caller who does not own the request", async () => {
    await expect(
      requestsService.closeRequest("req-1", "someone-else"),
    ).rejects.toThrow("Only the requester can close this");

    expect(requestsRepo.closeRequestAtomic).not.toHaveBeenCalled();
  });

  it("rejects a request that is already closed", async () => {
    (requestsRepo.findRequestById as jest.Mock).mockResolvedValue({
      ...activeRequest,
      status: "Completed",
    });

    await expect(
      requestsService.closeRequest("req-1", OWNER),
    ).rejects.toThrow("This request is already closed");

    expect(requestsRepo.closeRequestAtomic).not.toHaveBeenCalled();
  });

  it("rejects a request that does not exist", async () => {
    (requestsRepo.findRequestById as jest.Mock).mockResolvedValue(undefined);

    await expect(
      requestsService.closeRequest("req-1", OWNER),
    ).rejects.toThrow("Request not found");

    expect(requestsRepo.closeRequestAtomic).not.toHaveBeenCalled();
  });
});
