export type BeatAccent = 'primary' | 'secondary'

export interface BeatSnapshot {
  beatIndex: number
  positionInPattern: number
  accent: BeatAccent
  audioTime: number | null
  tempoBpm: number | null
  running: boolean
  generation: number
}

type Listener = () => void

/** Publishes Beat boundaries at their audible Web Audio time. */
export class BeatClock {
  private snapshot: BeatSnapshot = {
    beatIndex: -1,
    positionInPattern: 0,
    accent: 'primary',
    audioTime: null,
    tempoBpm: null,
    running: false,
    generation: 0,
  }
  private readonly listeners = new Set<Listener>()
  private readonly timers = new Set<ReturnType<typeof setTimeout>>()

  getSnapshot = (): BeatSnapshot => this.snapshot

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  start(tempoBpm: number): number {
    this.cancelPending()
    const generation = this.snapshot.generation + 1
    this.snapshot = { ...this.snapshot, tempoBpm, running: true, generation, audioTime: null }
    this.emit()
    return generation
  }

  stop(): void {
    this.cancelPending()
    this.snapshot = {
      ...this.snapshot,
      running: false,
      audioTime: null,
      tempoBpm: null,
      generation: this.snapshot.generation + 1,
    }
    this.emit()
  }

  schedule(snapshot: Omit<BeatSnapshot, 'running' | 'generation'>, delayMs: number): void {
    const generation = this.snapshot.generation
    const timer = window.setTimeout(
      () => {
        this.timers.delete(timer)
        if (generation !== this.snapshot.generation || !this.snapshot.running) return
        this.snapshot = { ...snapshot, running: true, generation }
        this.emit()
      },
      Math.max(0, delayMs),
    )
    this.timers.add(timer)
  }

  private cancelPending(): void {
    for (const timer of this.timers) window.clearTimeout(timer)
    this.timers.clear()
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener())
  }
}
