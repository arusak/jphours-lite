import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBreak, createExercise, createRoutine } from "../../domain/routine";
import { SessionPlayer } from "./SessionPlayer";

const audio = {
  unlock: vi.fn().mockResolvedValue(true),
  startMetronome: vi.fn(),
  updateMetronomeTempo: vi.fn(),
  updateMetronomeSound: vi.fn(),
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

const routineWith = (...entries: ReturnType<typeof createExercise>[]) => createRoutine({ entries });

describe("SessionPlayer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("puts tempo controls in the paced exercise ring and saves a divergent tempo", async () => {
    const onSaveTempo = vi.fn();
    render(
      <SessionPlayer
        routine={routineWith(createExercise({ id: "scales", title: "Scales", tempoBpm: 90 }))}
        onExit={vi.fn()}
        onSaveTempo={onSaveTempo}
      />,
    );
    expect(await screen.findByText("90", { selector: "strong" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Increase tempo" }));
    expect(screen.getByText("91", { selector: "strong" })).toBeInTheDocument();
    expect(audio.updateMetronomeTempo).toHaveBeenCalledWith(91);
    fireEvent.click(screen.getByRole("button", { name: "Save tempo" }));
    expect(onSaveTempo).toHaveBeenCalledWith("scales", 91);
  });

  it("applies a live Metronome sound override and saves it separately from Tempo", async () => {
    const onSaveMetronomeSound = vi.fn();
    render(
      <SessionPlayer
        routine={routineWith(createExercise({ id: "scales", title: "Scales", tempoBpm: 90 }))}
        onExit={vi.fn()}
        onSaveMetronomeSound={onSaveMetronomeSound}
      />,
    );
    const select = await screen.findByLabelText("Metronome sound");
    fireEvent.change(select, { target: { value: "wood" } });
    expect(audio.updateMetronomeSound).toHaveBeenCalledWith("wood");
    fireEvent.click(screen.getByRole("button", { name: "Save sound" }));
    expect(onSaveMetronomeSound).toHaveBeenCalledWith("wood");
  });

  it("uses the neutral, accessible elapsed-time ring for an unpaced open-ended exercise", async () => {
    render(
      <SessionPlayer
        routine={routineWith(
          createExercise({ title: "Improv", tempoBpm: null, durationSec: null }),
        )}
        onExit={vi.fn()}
      />,
    );
    const ring = await screen.findByTestId("timer-ring");
    expect(ring).toHaveAttribute("data-open-ended", "true");
    expect(ring).toHaveAccessibleName(/elapsed time/i);
    expect(screen.getByTestId("exercise-silhouette")).toBeInTheDocument();
  });

  it("opens a read-only Now Playing list of meaningful steps and marks the next exercise during Quick Rest", async () => {
    const one = createExercise({ id: "one", title: "One", durationSec: 30 });
    const two = createExercise({ id: "two", title: "Two", durationSec: 30 });
    render(<SessionPlayer routine={routineWith(one, two)} onExit={vi.fn()} />);
    await screen.findByRole("heading", { name: "One" });
    fireEvent.click(screen.getByRole("button", { name: /now playing/i }));
    expect(await screen.findByRole("dialog", { name: "Now Playing" })).toBeInTheDocument();
    expect(screen.getByText("One · 80 BPM · 0:30")).toBeInTheDocument();
    expect(screen.queryByText(/Quick Rest/)).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Finish step" }));
    expect(await screen.findByRole("heading", { name: "Quick Rest" })).toBeInTheDocument();
    expect(screen.getByTestId("quick-rest-silhouette")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skip Quick Rest" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /now playing/i }));
    expect(await screen.findByText("Up next")).toBeInTheDocument();
  });

  it("presents the four media controls and only stops after slide confirmation", async () => {
    render(
      <SessionPlayer routine={routineWith(createExercise({ title: "One" }))} onExit={vi.fn()} />,
    );
    await screen.findByRole("heading", { name: "One" });
    expect(screen.getByRole("button", { name: "Rewind step" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pause session" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Stop session" }));
    const slider = await screen.findByRole("slider", { name: /slide to stop/i });
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    fireEvent.blur(slider);
    expect(screen.queryByText("Session stopped")).not.toBeInTheDocument();
    fireEvent.keyDown(slider, { key: "End" });
    expect(await screen.findByText("Session stopped")).toBeInTheDocument();
  });

  it("renders a Break as a meaningful dark-accent ring", async () => {
    const breakEntry = createBreak({ id: "break", durationSec: 60 });
    render(
      <SessionPlayer
        routine={createRoutine({ entries: [breakEntry] })}
        onExit={vi.fn()}
      />,
    );
    expect(await screen.findByRole("heading", { name: "Break" })).toBeInTheDocument();
    expect(screen.getByTestId("timer-ring")).toHaveAttribute("data-tone", "break");
    expect(screen.getByTestId("break-silhouette")).toBeInTheDocument();
  });
});
