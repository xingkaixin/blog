import { describe, expect, it } from "vitest";
import { cookieLocale, preferredLocale } from "./i18n";

describe("preferredLocale", () => {
  it.each([
    [null, null],
    ["", null],
    ["*", null],
    ["en-US,en;q=0.9", "en"],
    ["fr-FR", "en"],
    ["zh-CN,zh;q=0.9,en;q=0.8", "zh"],
    ["zh-TW", "zh"],
    ["en;q=0.5, zh-HK", "zh"],
    ["zh;q=0, fr", "en"],
  ])("reads %j as %s", (acceptLanguage, locale) => {
    expect(preferredLocale(acceptLanguage)).toBe(locale);
  });
});

describe("cookieLocale", () => {
  it.each([
    ["theme=dark; lang=en", "en"],
    ["lang=zh", "zh"],
    ["lang=ja", null],
    [null, null],
  ])("reads %j as %s", (cookie, locale) => {
    expect(cookieLocale(cookie)).toBe(locale);
  });
});
