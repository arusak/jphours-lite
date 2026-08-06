import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createExercise, createRoutine } from "../../domain/routine";
import { SessionPlayer } from "./SessionPlayer";

const audio = {
  unlock: vi.fn().mockResolvedValue(true),
  startMetronome: vi.fn(),
  updateMetronomeTempo: vi.fn(),
  stopMetronome: vi.fn(),
  playCue: vi.fn(),
  dispose: vi.fn(),
};
vi.mock("../../services/audio", () => ({
  AudioController: class {
    constructor() {
      return audio;
    }
  },
}));
vi.mock("../../services/platform/wakeLock", () => ({
  WakeLockController: class {
    acquire = vi.fn();
    release = vi.fn();
  },
}));
vi.mock("../../services/platform/visibilityLifecycle", () => ({
  observeVisibility: vi.fn(() => vi.fn()),
}));

describe("SessionPlayer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates a paced exercise immediately and saves the divergent tempo", async () => {
    const onSaveTempo = vi.fn();
    render(
      <SessionPlayer
        routine={createRoutine({
          name: "Daily",
          exercises: [createExercise({ id: "scales", title: "Scales", tempoBpm: 90 })],
        })}
        onExit={vi.fn()}
        onSaveTempo={onSaveTempo}
      />,
    );
    expect(await screen.findByText("90")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Increase tempo" }));
    expect(screen.getByText("91")).toBeInTheDocument();
    expect(audio.updateMetronomeTempo).toHaveBeenCalledWith(91);
    fireEvent.click(screen.getByRole("button", { name: "Save tempo" }));
    expect(onSaveTempo).toHaveBeenCalledWith("scales", 91);
    expect(screen.queryByRole("button", { name: "Save tempo" })).not.toBeInTheDocument();
  });

  it("shows elapsed time and a static ring for an open-ended exercise", async () => {
    render(
      <SessionPlayer
        routine={createRoutine({ exercises: [createExercise({ title: "Improv" })] })}
        onExit={vi.fn()}
      />,
    );
    expect(await screen.findByText("ELAPSED")).toBeInTheDocument();
    expect(screen.getByTestId("timer-ring")).toHaveAttribute("data-open-ended", "true");
  });

  it("rewinds from a break and exits immediately with Back", async () => {
    const onExit = vi.fn();
    render(
      <SessionPlayer
        routine={createRoutine({
          exercises: [
            createExercise({ title: "One", durationSec: 30 }),
            createExercise({ title: "Two", durationSec: 30 }),
          ],
        })}
        onExit={onExit}
      />,
    );
    await screen.findByText("One");
    fireEvent.click(screen.getByRole("button", { name: /finish.*skip/i }));
    expect(await screen.findByRole("heading", { name: "Break" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /rewind/i }));
    expect(await screen.findByText("One")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(onExit).toHaveBeenCalledOnce();
  });

  it("numbers exercises correctly when breaks are disabled", async () => {
    render(
      <SessionPlayer
        routine={createRoutine({
          defaultBreakDurationSec: 0,
          exercises: [createExercise({ title: "One" }), createExercise({ title: "Two" })],
        })}
        onExit={vi.fn()}
      />,
    );
    await screen.findByText("One");
    fireEvent.click(screen.getByRole("button", { name: /finish.*skip/i }));
    expect(await screen.findByText("Exercise 2 of 2")).toBeInTheDocument();
  });

  it("requires the stop slider threshold and supports keyboard confirmation", async () => {
    render(
      <SessionPlayer
        routine={createRoutine({ exercises: [createExercise({ title: "One" })] })}
        onExit={vi.fn()}
      />,
    );
    const slider = await screen.findByRole("slider", { name: /slide to stop/i });
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    fireEvent.blur(slider);
    expect(screen.queryByText("Session stopped")).not.toBeInTheDocument();
    fireEvent.keyDown(slider, { key: "End" });
    expect(await screen.findByText("Session stopped")).toBeInTheDocument();
  });
});
