import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createExercise, createRoutine, type Routine } from "../../domain/routine";
import type { RoutineRepository } from "../../services/persistence/routine-repository";
import { RoutineEditor } from "./RoutineEditor";

function repository(initial: Routine): RoutineRepository {
  return { load: () => initial, save: vi.fn() };
}

describe("RoutineEditor", () => {
  it("validates and saves a new paced open-ended exercise in a sheet", () => {
    render(<RoutineEditor repository={repository(createRoutine({ name: "Daily" }))} />);
    fireEvent.click(screen.getByRole("button", { name: /add exercise/i }));
    fireEvent.change(screen.getByLabelText(/exercise name/i), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    expect(screen.getByText("Enter an exercise name.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/exercise name/i), { target: { value: "Scales" } });
    fireEvent.change(screen.getByLabelText(/tempo/i), { target: { value: "90" } });
    fireEvent.change(screen.getByLabelText(/duration/i), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    expect(screen.getByText("Scales")).toBeInTheDocument();
    expect(screen.getByText("Paced open-ended")).toBeInTheDocument();
  });

  it("keeps the sheet field focused while typing", () => {
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    render(<RoutineEditor repository={repository(createRoutine({ name: "Daily" }))} />);
    fireEvent.click(screen.getByRole("button", { name: /add exercise/i }));

    const name = screen.getByLabelText(/exercise name/i);
    expect(name).toHaveFocus();
    focus.mockClear();

    fireEvent.change(name, { target: { value: "Scales" } });

    expect(name).toHaveFocus();
    expect(focus).not.toHaveBeenCalled();
    focus.mockRestore();
  });

  it("offers undo after deletion and restores the same exercise", () => {
    const exercise = createExercise({ title: "Chords", durationSec: 30 });
    render(
      <RoutineEditor
        repository={repository(createRoutine({ name: "Daily", exercises: [exercise] }))}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete Chords" }));
    expect(screen.queryByText("Chords")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /undo/i }));
    expect(screen.getByText("Chords")).toBeInTheDocument();
  });

  it("supports keyboard reordering from the drag handle", () => {
    const first = createExercise({ title: "First", durationSec: 30 });
    const second = createExercise({ title: "Second", durationSec: 30 });
    render(
      <RoutineEditor repository={repository(createRoutine({ exercises: [first, second] }))} />,
    );
    fireEvent.keyDown(screen.getByRole("button", { name: "Reorder First" }), {
      key: "ArrowDown",
    });
    expect(screen.getAllByTestId("exercise-title").map((node) => node.textContent)).toEqual([
      "Second",
      "First",
    ]);
  });
});
