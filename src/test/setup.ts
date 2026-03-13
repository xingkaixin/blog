import "@testing-library/jest-dom/vitest";

if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = () => {};
}
