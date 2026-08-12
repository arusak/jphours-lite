import type { Routine } from '../../domain/routine'
import type { RoutineRepository } from './routine-repository'

export class DebouncedRoutineSaver {
  private timeoutId: ReturnType<typeof setTimeout> | undefined
  private pending: Routine | undefined

  constructor(
    private readonly repository: RoutineRepository,
    private readonly delayMs = 300,
  ) {}

  schedule(routine: Routine): void {
    this.pending = routine
    if (this.timeoutId !== undefined) clearTimeout(this.timeoutId)
    this.timeoutId = setTimeout(() => this.flush(), this.delayMs)
  }

  flush(): void {
    if (this.timeoutId !== undefined) clearTimeout(this.timeoutId)
    this.timeoutId = undefined
    if (!this.pending) return
    this.repository.save(this.pending)
    this.pending = undefined
  }

  cancel(): void {
    if (this.timeoutId !== undefined) clearTimeout(this.timeoutId)
    this.timeoutId = undefined
    this.pending = undefined
  }

  dispose(): void {
    this.flush()
  }
}
