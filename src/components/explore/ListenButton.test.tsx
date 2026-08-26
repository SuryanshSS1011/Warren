import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { ListenButton } from "./ListenButton";

const synth = {
  speak: vi.fn(),
  cancel: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
};

beforeEach(() => {
  push.mockReset();
  synth.speak.mockReset();
  synth.cancel.mockReset();
  // Provide a speechSynthesis + constructor so the component considers TTS supported.
  vi.stubGlobal("speechSynthesis", synth);
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      text: string;
      rate = 1;
      onend: (() => void) | null = null;
      constructor(t: string) {
        this.text = t;
      }
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("<ListenButton>", () => {
  it("renders nothing when speech synthesis is unavailable", () => {
    vi.unstubAllGlobals(); // remove speechSynthesis
    const { container } = render(<ListenButton text="hello" tier="pro" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("a free user is nudged to /pricing instead of speaking", () => {
    render(<ListenButton text="hello world" tier="free" />);
    fireEvent.click(screen.getByRole("button", { name: /listen/i }));
    expect(push).toHaveBeenCalledWith("/pricing");
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it("a Pro user starts narration", () => {
    render(<ListenButton text="hello world" tier="pro" />);
    fireEvent.click(screen.getByRole("button", { name: /listen/i }));
    expect(synth.speak).toHaveBeenCalledOnce();
    expect(push).not.toHaveBeenCalled();
    // Now shows pause + stop controls.
    expect(screen.getByRole("button", { name: /pause/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /stop/i })).toBeInTheDocument();
  });

  it("a trialing/researcher tier can also use it", () => {
    render(<ListenButton text="x" tier="researcher" />);
    fireEvent.click(screen.getByRole("button", { name: /listen/i }));
    expect(synth.speak).toHaveBeenCalled();
  });
});
