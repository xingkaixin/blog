import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TocNav } from "@/components/toc-nav";

describe("TocNav", () => {
  it("highlights the active heading in the desktop toc", () => {
    render(
      <TocNav
        items={[
          { id: "intro", text: "介绍", depth: 2 },
          { id: "details", text: "细节", depth: 3 },
        ]}
        activeId="details"
      />,
    );

    expect(screen.getAllByRole("link", { name: "细节" })[0]).toHaveAttribute(
      "aria-current",
      "location",
    );
    expect(screen.getAllByRole("link", { name: "介绍" })[0]).not.toHaveAttribute("aria-current");
  });

  it("shows the existing empty state when the post has no headings", () => {
    const { container } = render(<TocNav items={[]} activeId={null} />);

    expect(container).toBeEmptyDOMElement();
  });
});
