import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AiAttribution } from "./AiAttribution";
import type { AiAttribution as AiAttributionData } from "@/lib/attribution";

const data: AiAttributionData = {
  generated: true,
  model: "claude-haiku-4-5",
  license: {
    id: "CC-BY-SA-4.0",
    name: "CC BY-SA 4.0",
    url: "https://creativecommons.org/licenses/by-sa/4.0/",
  },
  sources: [
    { title: "Bonobo", url: "https://en.wikipedia.org/wiki/Bonobo" },
    { title: "Chimpanzee", url: "https://en.wikipedia.org/wiki/Chimpanzee" },
  ],
};

describe("<AiAttribution>", () => {
  it("shows the AI-generated flag", () => {
    render(<AiAttribution attribution={data} />);
    expect(screen.getByText(/AI-generated/i)).toBeInTheDocument();
  });

  it("links the license to the CC deed", () => {
    render(<AiAttribution attribution={data} />);
    const licenseLink = screen.getByRole("link", { name: /CC BY-SA 4\.0/i });
    expect(licenseLink).toHaveAttribute("href", data.license.url);
    expect(licenseLink).toHaveAttribute("target", "_blank");
    expect(licenseLink).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("renders a link per source article", () => {
    render(<AiAttribution attribution={data} />);
    const bonobo = screen.getByRole("link", { name: "Bonobo" });
    const chimp = screen.getByRole("link", { name: "Chimpanzee" });
    expect(bonobo).toHaveAttribute("href", "https://en.wikipedia.org/wiki/Bonobo");
    expect(chimp).toHaveAttribute("href", "https://en.wikipedia.org/wiki/Chimpanzee");
  });

  it("omits the sources clause when there are none", () => {
    render(<AiAttribution attribution={{ ...data, sources: [] }} />);
    expect(screen.queryByText(/^from/i)).not.toBeInTheDocument();
    // The flag + license still render.
    expect(screen.getByText(/AI-generated/i)).toBeInTheDocument();
  });
});
