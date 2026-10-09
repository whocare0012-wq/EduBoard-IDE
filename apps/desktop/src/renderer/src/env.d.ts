// SPDX-License-Identifier: GPL-3.0-only
import type { EduBoardApi } from '../../shared/types';

declare global {
  interface Window {
    eduboard: EduBoardApi;
  }
}

export {};
