import { describe, expect, it } from "vitest";
import { seasonAt } from "@/lib/season";

describe("seasonAt", () => {
  it("maps Shanghai months to meteorological seasons", () => {
    expect(seasonAt(new Date("2026-01-15T04:00:00Z"))).toBe("winter");
    expect(seasonAt(new Date("2026-04-15T04:00:00Z"))).toBe("spring");
    expect(seasonAt(new Date("2026-07-15T04:00:00Z"))).toBe("summer");
    expect(seasonAt(new Date("2026-10-15T04:00:00Z"))).toBe("autumn");
    expect(seasonAt(new Date("2026-12-15T04:00:00Z"))).toBe("winter");
  });

  it("switches seasons at Shanghai midnight rather than UTC midnight", () => {
    expect(seasonAt(new Date("2026-02-28T15:59:00Z"))).toBe("winter");
    expect(seasonAt(new Date("2026-02-28T16:00:00Z"))).toBe("spring");
  });
});
