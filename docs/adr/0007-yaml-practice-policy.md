# Define practice policy in validated YAML

Keep shared practice defaults, bounds, increments, synthesis presets, audio levels, and the stop-confirmation threshold in `src/config/practice.yml`. YAML is the accepted configuration format, imported at build time by the existing Rollup YAML plugin and converted into typed `PracticeConfig` by a validating adapter. Central policy gives factories, domain validation, editor controls, and audio a common source instead of separately maintained constants.

This file defines application policy, not saved Routine data or a user-import format. Changing it requires rebuilding and deploying the application. It has no format-version field or migration contract; Routine storage and transfer versioning are covered by [ADR 0005](0005-routine-storage-and-file-compatibility.md).

## Format

The root is a YAML mapping. Use these keys and numeric units; the current values remain authoritative in [practice.yml](../../src/config/practice.yml).

| Key                      | Shape and units                                                                                    |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| `tempo`                  | `default`, `min`, `max`, `increment`; BPM                                                          |
| `exerciseDuration`       | Same numeric policy; seconds                                                                       |
| `breakDuration`          | Same numeric policy; seconds                                                                       |
| `quickRestDuration`      | Same numeric policy; seconds                                                                       |
| `warningLeadTime`        | Same numeric policy; seconds                                                                       |
| `metronome.defaultSound` | `classic`, `wood`, or `digital`                                                                    |
| `metronome.sounds`       | Mapping for those three names; each supplies `waveform`, `frequency` in Hz, and `decay` in seconds |
| `audio`                  | `beatPeak`, `warningPeak`, `completionPeak`; gain levels in `[0, 1]`                               |
| `interaction`            | `slideToStopThreshold`; completion fraction in `(0, 1]`                                            |

For example, a numeric policy is written as:

```yaml
tempo:
  default: 80
  min: 20
  max: 300
  increment: 1
```

The adapter requires finite numeric values, `min <= default <= max`, and a positive increment. Sound waveforms must be `sine`, `triangle`, `square`, or `sawtooth`; frequency and decay must be finite, and the default sound must name a supported preset. Audio gains and the interaction fraction are range-checked. Invalid configuration throws during initialization instead of silently substituting defaults. Domain schemas separately enforce applicable Routine value bounds and increments; the YAML adapter does not validate every domain rule or reject every unknown key.

Implementation:

- [YAML source](../../src/config/practice.yml), [typed adapter](../../src/config/practice-config.ts), [domain schemas](../../src/domain/routine-schema.ts), and [build-time YAML import](../../vite.config.ts).
- [Configuration validation tests](../../src/config/practice-config.test.ts).
