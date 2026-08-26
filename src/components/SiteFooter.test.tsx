import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteFooter } from "./SiteFooter";
import { CC_BY_SA_4_0 } from "@/lib/attribution";

describe("<SiteFooter>", () => {
  it("discloses AI assistance and the Wikipedia/CC BY-SA source", () => {
    render(<SiteFooter />);
    expect(screen.getByText(/AI-assisted/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Wikipedia/i })).toHaveAttribute(
      "href",
      "https://en.wikipedia.org",
    );
    expect(screen.getByRole("link", { name: /CC BY-SA 4\.0/i })).toHaveAttribute(
      "href",
      CC_BY_SA_4_0.url,
    );
  });

  it("carries the Wikimedia non-affiliation disclaimer", () => {
    render(<SiteFooter />);
    expect(screen.getByText(/not endorsed by or affiliated with the Wikimedia Foundation/i)).toBeInTheDocument();
  });

  it("links to the about/attribution page", () => {
    render(<SiteFooter />);
    expect(screen.getByRole("link", { name: /About/i })).toHaveAttribute("href", "/about");
  });
});
