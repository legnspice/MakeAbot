import { after } from "next/server";

/**
 * Run notification work after the response is sent.
 *
 * A bare `void (async () => …)()` is not safe on serverless: once the action
 * returns, the function instance can be frozen or reclaimed before the promise
 * settles, so pushes and bell rows silently go missing. `after()` keeps the
 * invocation alive until the task finishes.
 *
 * Falls back to a detached promise when there is no request scope (unit tests,
 * scripts) so callers never have to care which context they are in.
 */
export function runAfterResponse(task: () => Promise<void>): void {
  const safeTask = async () => {
    try {
      await task();
    } catch {
      // Notification delivery must never surface to the caller.
    }
  };

  try {
    after(safeTask);
  } catch {
    void safeTask();
  }
}
