import { describe, expect, it } from "vitest";
import { pickRandom } from "@/lib/record-shuffle";

describe("record shuffle", () => {
  it("never repeats the current record when another one exists", () => {
    expect(pickRandom(["a", "b"], "a", () => 0)).toBe("b");
    expect(pickRandom(["a"], "a", () => 0)).toBe("a");
  });
});
