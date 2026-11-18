import { describe, expect, it } from "vitest";
import { clampBodyCenter, getThemeGravityY, THEME_GRAVITY } from "./gravity-world";

describe("gravity world helpers", () => {
  it("inverts gravity in dark mode and restores downward gravity in light mode", () => {
    expect(getThemeGravityY("dark")).toBe(-THEME_GRAVITY);
    expect(getThemeGravityY("light")).toBe(THEME_GRAVITY);
    expect(getThemeGravityY(undefined)).toBe(THEME_GRAVITY);
  });

  it("clamps body centers safely inside world bounds even in compact containers", () => {
    expect(clampBodyCenter(-20, 999, 30, 40, 200, 300)).toEqual({ x: 30, y: 260 });
    expect(clampBodyCenter(10, 10, 80, 90, 100, 120)).toEqual({ x: 80, y: 90 });
  });
});
