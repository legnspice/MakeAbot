import * as messagesService from "@/lib/services/messages.service";
import * as messagesRepo from "@/lib/repo/messages.repo";
import * as offersRepo from "@/lib/repo/offers.repo";
import * as requestsRepo from "@/lib/repo/requests.repo";

jest.mock("@/lib/repo/messages.repo");
jest.mock("@/lib/repo/offers.repo");
jest.mock("@/lib/repo/requests.repo");
jest.mock("@/lib/repo/users.repo");
jest.mock("@/lib/repo/notifications.repo");
jest.mock("@/lib/services/push.service");
jest.mock("@/lib/after-response", () => ({ runAfterResponse: jest.fn() }));

const base = {
  sender_id: "sender-1",
  receiver_id: "receiver-1",
  content: "hello",
};

describe("messagesService.createMessage tombstone guard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (messagesRepo.insertMessage as jest.Mock).mockResolvedValue({ id: "m-1" });
  });

  it("inserts when the parent offer bid is live", async () => {
    (offersRepo.findOfferBidById as jest.Mock).mockResolvedValue({
      id: "ob-1",
      offer_id: "offer-1",
      deleted_at: null,
    });

    await expect(
      messagesService.createMessage({ ...base, offer_bid_id: "ob-1" }),
    ).resolves.toEqual({ id: "m-1" });

    expect(messagesRepo.insertMessage).toHaveBeenCalled();
  });

  it("inserts when the parent request bid is live", async () => {
    (requestsRepo.findRequestBidById as jest.Mock).mockResolvedValue({
      id: "rb-1",
      request_id: "req-1",
      deleted_at: null,
    });

    await expect(
      messagesService.createMessage({ ...base, request_bid_id: "rb-1" }),
    ).resolves.toEqual({ id: "m-1" });
  });

  it("rejects, and never inserts, when the parent offer bid is gone", async () => {
    // findOfferBidById filters notDeleted, so a tombstoned bid reads as missing.
    (offersRepo.findOfferBidById as jest.Mock).mockResolvedValue(undefined);

    await expect(
      messagesService.createMessage({ ...base, offer_bid_id: "ob-1" }),
    ).rejects.toThrow("This conversation is no longer available");

    expect(messagesRepo.insertMessage).not.toHaveBeenCalled();
  });

  it("rejects, and never inserts, when the parent request bid is gone", async () => {
    (requestsRepo.findRequestBidById as jest.Mock).mockResolvedValue(undefined);

    await expect(
      messagesService.createMessage({ ...base, request_bid_id: "rb-1" }),
    ).rejects.toThrow("This conversation is no longer available");

    expect(messagesRepo.insertMessage).not.toHaveBeenCalled();
  });

  it("rejects a bid row that carries a deleted_at even if the finder returns it", async () => {
    (offersRepo.findOfferBidById as jest.Mock).mockResolvedValue({
      id: "ob-1",
      offer_id: "offer-1",
      deleted_at: new Date(),
    });

    await expect(
      messagesService.createMessage({ ...base, offer_bid_id: "ob-1" }),
    ).rejects.toThrow("This conversation is no longer available");

    expect(messagesRepo.insertMessage).not.toHaveBeenCalled();
  });

  it("fails closed (503, no insert) when the parent read rejects", async () => {
    (offersRepo.findOfferBidById as jest.Mock).mockRejectedValue(
      new Error("connection reset"),
    );

    await expect(
      messagesService.createMessage({ ...base, offer_bid_id: "ob-1" }),
    ).rejects.toThrow("Could not verify this conversation is still open");

    expect(messagesRepo.insertMessage).not.toHaveBeenCalled();
  });

  it("leaves contextless messages alone — there is no parent to check", async () => {
    await expect(messagesService.createMessage({ ...base })).resolves.toEqual({
      id: "m-1",
    });

    expect(offersRepo.findOfferBidById).not.toHaveBeenCalled();
    expect(requestsRepo.findRequestBidById).not.toHaveBeenCalled();
    expect(messagesRepo.insertMessage).toHaveBeenCalled();
  });
});
