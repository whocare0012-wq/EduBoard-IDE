// SPDX-License-Identifier: GPL-3.0-only
export type MicroBoardId = 'esp32' | 'esp32c3' | 'esp32s3' | 'esp32s3-octal';
export interface MicroBoard {
  id: MicroBoardId; name: string; chip: string; imageChipId: number; offset: number;
  minimumFlash: number; minimumRevision: number; filename: string; sha256: string; url: string; notes: string;
}
const base = { minimumFlash: 4 * 1024 * 1024, minimumRevision: 0 };
export const MICRO_BOARDS: readonly MicroBoard[] = [
  { ...base, id: 'esp32', name: 'ESP32 Generic（双核）', chip: 'esp32', imageChipId: 0, offset: 0x1000,
    filename: 'ESP32_GENERIC-20260824-v1.29.0.bin', sha256: 'e67ad6015a0a504c1fec9aa9bbf589d0432ed28e62546f4f8dd8a147f8bd95f6',
    url: 'https://micropython.org/resources/firmware/ESP32_GENERIC-20260824-v1.29.0.bin', notes: '经典双核 ESP32，至少 4 MiB 闪存；不支持 UNICORE / D2WD 变体。' },
  { ...base, id: 'esp32c3', name: 'ESP32-C3 Generic', chip: 'esp32c3', imageChipId: 5, offset: 0, minimumRevision: 3,
    filename: 'ESP32_GENERIC_C3-20260824-v1.29.0.bin', sha256: 'bf72ed9eb88ad3a8f49d02c3d371f9ea34c90a8a303aeb9e324d8efd4a2a655a',
    url: 'https://micropython.org/resources/firmware/ESP32_GENERIC_C3-20260824-v1.29.0.bin', notes: '至少 4 MiB 闪存、芯片修订版 0.3 或更新；GPIO18/19 用于 USB 串口。' },
  { ...base, id: 'esp32s3', name: 'ESP32-S3 Generic', chip: 'esp32s3', imageChipId: 9, offset: 0,
    filename: 'ESP32_GENERIC_S3-20260824-v1.29.0.bin', sha256: '1dd9dcd27ba2d6a1cb7f7b49a063f46d3d807d68b0151161233920228285e300',
    url: 'https://micropython.org/resources/firmware/ESP32_GENERIC_S3-20260824-v1.29.0.bin', notes: '至少 4 MiB 闪存；无 PSRAM 或普通 SPI PSRAM。Octal PSRAM 请选择对应变体。' },
  { ...base, id: 'esp32s3-octal', name: 'ESP32-S3 Octal PSRAM', chip: 'esp32s3', imageChipId: 9, offset: 0,
    filename: 'ESP32_GENERIC_S3-SPIRAM_OCT-20260824-v1.29.0.bin', sha256: 'ab24eadfe3ef0e6ee38834d730e648def7cd82f3fa51ee0bbc59c29a6e1bd176',
    url: 'https://micropython.org/resources/firmware/ESP32_GENERIC_S3-SPIRAM_OCT-20260824-v1.29.0.bin', notes: '仅用于 Octal PSRAM 变体，至少 4 MiB 闪存。必须确认实际模块规格。' }
];

export function microBoard(value: unknown): MicroBoard {
  const board = MICRO_BOARDS.find(item => item.id === value);
  if (!board) throw new Error('不支持的 MicroPython 开发板。');
  return board;
}
