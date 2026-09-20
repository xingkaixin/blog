import { describe, expect, it } from "vitest";
import { Fishing, FishingPhase, type FishingStatus } from "./fishing";
import { getReelPose } from "./fishing-overlay";
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
    const state = fishing.state;
    if (state.phase !== FishingPhase.Reeling) {
      throw new Error("Expected a hooked fish");
    }
    const caughtVertices = state.pose.vertices.slice();
    expect(state.pose.vertices).not.toBe(koi.meshes[state.fish].vertices);
    expect(state.pose.vertices).toEqual(koi.meshes[state.fish].vertices);
    expect(state.pose.mouth).toEqual({
      x: koi.meshes[state.fish].spine[0],
      y: koi.meshes[state.fish].spine[1],
    });
    advance(0.5);
    expect(state.pose.vertices).toEqual(caughtVertices);
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

  it("starts a catch at its actual mouth without rotating or resizing on a cropped pond", () => {
    const { fishing, waitForBite } = setup();
    waitForBite();
    fishing.strike();
    const state = fishing.state;
    if (state.phase !== FishingPhase.Reeling) {
      throw new Error("Expected a hooked fish");
    }
    const height = 180;
    const reel = getReelPose(state.pose, 0, height * 2, height);
    const mouth = {
      x: (reel.end.x - height) / height + 1.5,
      y: 1 - reel.end.y / height,
    };
    expect(mouth.x).toBeCloseTo(state.pose.mouth.x);
    expect(mouth.y).toBeCloseTo(state.pose.mouth.y);
    expect(reel).toMatchObject({ angle: 0, scale: 1, opacity: 1, wriggle: 0 });
  });

  it("keeps reeling rotation continuous when the fish faces away from the basket", () => {
    const koi = createKoiSchool();
    const pose = {
      vertices: koi.meshes[0].vertices,
      mouth: { x: 1.5, y: 0.85 },
      angle: 2.9,
      phase: 0,
      length: koi.b[0] * 2,
    };
    let previous = 0;
    for (let frame = 1; frame <= 72; frame++) {
      const { angle } = getReelPose(pose, frame / 60, 366, 183);
      const turn = Math.atan2(Math.sin(angle - previous), Math.cos(angle - previous));
      expect(Math.abs(turn)).toBeLessThan(Math.PI / 6);
      previous = angle;
    }
  });
});
