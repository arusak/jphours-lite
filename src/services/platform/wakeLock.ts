export interface WakeLockHandle {
  release(): Promise<void>
}

type WakeLockNavigator = Navigator & {
  wakeLock?: { request(type: 'screen'): Promise<WakeLockHandle> }
}

/** Progressive screen wake-lock wrapper: unsupported browsers continue normally. */
export class WakeLockController {
  private lock: WakeLockHandle | null = null

  async acquire(): Promise<void> {
    if (this.lock || !('wakeLock' in navigator)) return
    try {
      this.lock = (await (navigator as WakeLockNavigator).wakeLock?.request('screen')) ?? null
    } catch {
      // A lock can be denied because of platform power policy. It is non-essential.
      this.lock = null
    }
  }

  async release(): Promise<void> {
    const lock = this.lock
    this.lock = null
    await lock?.release().catch(() => undefined)
  }
}
