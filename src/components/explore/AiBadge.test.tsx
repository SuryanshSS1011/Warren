import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AiBadge } from "./AiBadge";
import type { AiAttribution as AiAttributionData } from "@/lib/attribution";

const data: AiAttributionData = {
  generated: true,
  model: "m",
  license: {
    id: "CC-BY-SA-4.0",
    name: "CC BY-SA 4.0",
    url: "https://creativecommons.org/licenses/by-sa/4.0/",
  },
  sources: [
    { title: "Jazz", url: "https://en.wikipedia.org/wiki/Jazz" },
    { title: "Improvisation", url: "https://en.wikipedia.org/wiki/Improvisation" },
  ],
};

describe("<AiBadge>", () => {
  it("renders nothing without attribution", () => {
    const { container } = render(<AiBadge attribution={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the AI flag trigger with an accessible label", () => {
    render(<AiBadge attribution={data} />);
    expect(screen.getByRole("button", { name: /attribution/i })).toHaveTextContent("AI");
  });

  it("exposes the license link and per-source links in the popover", () => {
    render(<AiBadge attribution={data} />);
    expect(screen.getByRole("link", { name: /CC BY-SA 4\.0/i })).toHaveAttribute(
      "href",
      data.license.url,
    );
    expect(screen.getByRole("link", { name: "Jazz" })).toHaveAttribute(
      "href",
      "https://en.wikipedia.org/wiki/Jazz",
    );
    expect(screen.getByRole("link", { name: "Improvisation" })).toBeInTheDocument();
  });

  it("shows the AI-generated flag text", () => {
    render(<AiBadge attribution={data} />);
    expect(screen.getByText(/AI-generated/i)).toBeInTheDocument();
  });
});
