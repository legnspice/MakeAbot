import { indexById, groupBidsByParent } from "@/lib/tracker";

describe("indexById", () => {
  it("maps rows by id", () => {
    const m = indexById([{ id: "a", v: 1 }, { id: "b", v: 2 }]);
    expect(m.get("a")).toEqual({ id: "a", v: 1 });
    expect(m.get("z")).toBeUndefined();
  });
});

describe("groupBidsByParent", () => {
  it("groups bids under their parent key", () => {
    const bids = [
      { id: "1", offer_id: "o1" },
      { id: "2", offer_id: "o1" },
      { id: "3", offer_id: "o2" },
    ];
    const m = groupBidsByParent(bids, (b) => b.offer_id);
    expect(m.get("o1")).toHaveLength(2);
    expect(m.get("o2")).toHaveLength(1);
    expect(m.get("o3")).toBeUndefined();
  });
  it("returns an empty map for no bids", () => {
    expect(groupBidsByParent([], (b: { offer_id: string }) => b.offer_id).size).toBe(0);
  });
});
