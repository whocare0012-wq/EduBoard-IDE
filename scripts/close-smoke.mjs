// SPDX-License-Identifier: GPL-3.0-only
/** Test teardown only: discard the isolated temporary profile after UI assertions.
 * User-driven closing is exercised separately through the real close/quit events.
 */
export async function closeSmoke(application) {
  await application.evaluate(({ BrowserWindow }) => {
    for (const window of BrowserWindow.getAllWindows()) window.destroy();
  }).catch(() => {}); // The process may already have exited in a real close test.
  await application.close();
}
