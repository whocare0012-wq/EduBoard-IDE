// SPDX-License-Identifier: GPL-3.0-only
/** Tool colours must not interfere with log text or location matching. */
export function plainOutput(text: string): string {
  return text.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '');
}
