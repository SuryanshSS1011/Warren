import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { AskArticle } from "./AskArticle";

const fetchMock = vi.fn();
beforeEach(() => {
  push.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function typeAndAsk(q: string) {
  fireEvent.change(screen.getByRole("textbox"), { target: { value: q } });
  fireEvent.click(screen.getByRole("button", { name: /^ask$/i }));
}

describe("<AskArticle>", () => {
  it("a free user is sent to /pricing and no request is made", () => {
    render(<AskArticle title="Jazz" tier="free" />);
    typeAndAsk("why is it important?");
    expect(push).toHaveBeenCalledWith("/pricing");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a Pro user gets an answer with the attribution + errors label", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        answer: "It shaped modern music.",
        attribution: {
          generated: true, model: "m",
          license: { id: "CC-BY-SA-4.0", name: "CC BY-SA 4.0", url: "https://cc" },
          sources: [{ title: "Jazz", url: "https://en.wikipedia.org/wiki/Jazz" }],
        },
      }),
    });
    render(<AskArticle title="Jazz" tier="pro" />);
    typeAndAsk("why important?");
    await waitFor(() => expect(screen.getByText(/shaped modern music/i)).toBeInTheDocument());
    expect(screen.getByText(/may contain errors/i)).toBeInTheDocument();
    // "AI-generated" appears in both the disclaimer and the attribution badge.
    expect(screen.getAllByText(/AI-generated/i).length).toBeGreaterThanOrEqual(1);
    // The CC BY-SA license link (from the attribution component) is present.
    expect(screen.getByRole("link", { name: /CC BY-SA 4\.0/i })).toBeInTheDocument();
  });

  it("redirects to /pricing on a 402 from the server (defense in depth)", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 402, json: async () => ({}) });
    render(<AskArticle title="Jazz" tier="pro" />);
    typeAndAsk("q");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/pricing"));
  });

  it("shows an error on a 429", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429, json: async () => ({}) });
    render(<AskArticle title="Jazz" tier="pro" />);
    typeAndAsk("q");
    await waitFor(() => expect(screen.getByText(/try again/i)).toBeInTheDocument());
  });

  it("does nothing on an empty question", () => {
    render(<AskArticle title="Jazz" tier="pro" />);
    fireEvent.click(screen.getByRole("button", { name: /^ask$/i }));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
