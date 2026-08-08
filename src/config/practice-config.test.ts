import { describe, expect, it } from "vitest";
import { practiceConfig, validatePracticeConfig } from "./practice-config";

describe("practice configuration", () => {
  it("exposes the YAML-defined defaults and bounds", () => {
    expect(practiceConfig.tempo).toMatchObject({ default: 80, min: 20, max: 300, increment: 1 });
    expect(practiceConfig.exerciseDuration).toMatchObject({ default: 300, increment: 60 });
    expect(practiceConfig.quickRestDuration).toMatchObject({
      default: 30,
      min: 0,
      max: 180,
      increment: 5,
    });
    expect(Object.keys(practiceConfig.metronome.sounds)).toEqual(["classic", "wood", "digital"]);
  });

  it("rejects invalid policy bounds at the application boundary", () => {
    expect(() =>
      validatePracticeConfig({ tempo: { default: 10, min: 20, max: 30, increment: 1 } }),
    ).toThrow();
  });
});
