/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Service to request and release browser wakelock to prevent screen sleep
 */
export class WakeLockService {
  private static wakeLock: any = null;

  public static async requestScreenWakeLock(): Promise<any> {
    if ("wakeLock" in navigator) {
      try {
        const lock = await (navigator as any).wakeLock.request("screen");
        this.wakeLock = lock;
        return lock;
      } catch (err: any) {
        console.warn(`Wake Lock Request failure: ${err.message}`);
        this.wakeLock = null;
        throw err;
      }
    }
    throw new Error("Wake lock is not supported on this platform");
  }

  public static async releaseScreenWakeLock(lockObj?: any): Promise<void> {
    const activeLock = lockObj || this.wakeLock;
    if (activeLock) {
      try {
        await activeLock.release();
        if (activeLock === this.wakeLock) {
          this.wakeLock = null;
        }
      } catch (err: any) {
        console.warn(`Wake Lock Release failure: ${err.message}`);
      }
    }
  }
}
