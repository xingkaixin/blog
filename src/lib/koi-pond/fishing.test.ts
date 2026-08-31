import { describe, expect, it } from "vitest";
import { Fishing, FishingPhase, type FishingStatus } from "./fishing";
import { createKoiSchool, KOI_COUNT } from "./koi";

function setup() {
  const koi = createKoiSchool();
  const changes: FishingStatus[] = [];
  const fishing = new Fishing(
    koi,
    () => {},
    (status) => changes.push(status),
  );
  let time = 0;
  const advance = (seconds: number) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      time += 1 / 60;
      fishing.update(time, 1 / 60);
    }
  };
  const waitForBite = () => {
    fishing.setActive(true);
    fishing.move(koi.a[0] + 0.25, koi.a[1]);
    for (let i = 0; i < 600 && fishing.state.phase !== FishingPhase.Bite; i++) {
      advance(1 / 60);
    }
    expect(fishing.state.phase).toBe(FishingPhase.Bite);
  };
  return { koi, fishing, changes, advance, waitForBite };
}

describe("pond fishing", () => {
  it("attracts a real fish, counts one catch and returns every fish to the pond", () => {
    const { koi, fishing, changes, advance, waitForBite } = setup();
    waitForBite();
    fishing.strike();
    fishing.strike();
    advance(0.5);
    expect(fishing.state.phase).toBe(FishingPhase.Reeling);
    expect(Array.from(koi.a).filter((value) => value === -10)).toHaveLength(2);
    advance(1);
    expect(changes.at(-1)?.caught).toBe(1);
    expect(fishing.state.phase).toBe(FishingPhase.Waiting);
    for (let i = 0; i < KOI_COUNT; i++) {
      expect(koi.a[i * 4]).toBeGreaterThan(0);
      expect(koi.a[i * 4]).toBeLessThan(3);
    }
  });

  it("ignores early strikes and lets a bite expire without counting a catch", () => {
    const { fishing, changes, advance, waitForBite } = setup();
    fishing.setActive(true);
    fishing.strike();
    expect(fishing.state.phase).toBe(FishingPhase.Waiting);
    waitForBite();
    advance(2.1);
    fishing.strike();
    expect(changes.at(-1)).toMatchObject({ phase: FishingPhase.Waiting, caught: 0, missed: true });
  });

  it("releases the hidden fish when reeling is cancelled and can start again", () => {
    const { koi, fishing, changes, advance, waitForBite } = setup();
    waitForBite();
    fishing.strike();
    advance(0.2);
    fishing.setActive(false);
    advance(0.1);
    expect(Array.from(koi.a)).not.toContain(-10);
    expect(changes.at(-1)).toMatchObject({ phase: FishingPhase.Idle, caught: 0 });
    fishing.setActive(true);
    expect(fishing.state.phase).toBe(FishingPhase.Waiting);
  });

  it("keeps out-of-bounds and non-finite pointer coordinates out of the simulation", () => {
    const { fishing, advance } = setup();
    fishing.setActive(true);
    fishing.move(-100, 100);
    advance(1);
    expect(fishing.bobber.x).toBeGreaterThanOrEqual(0.08);
    expect(fishing.bobber.y).toBeLessThanOrEqual(0.9);
    fishing.move(NaN, Infinity);
    advance(1);
    expect(Number.isFinite(fishing.bobber.x + fishing.bobber.y)).toBe(true);
  });

  it("keeps both the bobber and its destination visible when the pond is cropped", () => {
    const { fishing, advance } = setup();
    fishing.setActive(true);
    fishing.move(0.1, 0.5);
    advance(1);
    fishing.constrain(0.58, 2.42);
    expect(fishing.bobber.x).toBe(0.58);
    advance(0.5);
    expect(fishing.bobber.x).toBeGreaterThanOrEqual(0.58);
  });
});
