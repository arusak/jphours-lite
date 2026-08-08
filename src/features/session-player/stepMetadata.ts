import type { SessionStep } from "../../domain/session";
import { formatTime } from "./formatTime";

export function stepMetadata(step: SessionStep): string {
  if (step.kind === "break") return `Break · ${formatTime(step.durationSec)}`;
  const metadata = [step.title];
  if (step.tempoBpm !== null) metadata.push(`${step.tempoBpm} BPM`);
  if (step.durationSec !== null) metadata.push(formatTime(step.durationSec));
  return metadata.join(" · ");
}
