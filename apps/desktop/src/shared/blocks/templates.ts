// SPDX-License-Identifier: GPL-3.0-only
import type { WorkspaceState } from '../project-format';

interface SerializedBlock {
  type: string;
  fields?: Record<string, unknown>;
  inputs?: Record<string, { block: SerializedBlock }>;
  next?: { block: SerializedBlock };
  extraState?: Record<string, unknown>;
  x?: number;
  y?: number;
}
const b = (type: string, fields?: Record<string, unknown>, inputs?: Record<string, { block: SerializedBlock }>): SerializedBlock => ({ type, ...(fields ? { fields } : {}), ...(inputs ? { inputs } : {}) });
const text = (value: string): { block: SerializedBlock } => ({ block: b('text', { TEXT: value }) });
const chain = (...blocks: SerializedBlock[]): SerializedBlock => {
  for (let index = 0; index + 1 < blocks.length; index++) blocks[index].next = { block: blocks[index + 1] };
  return blocks[0];
};
const workspace = (setup: SerializedBlock | null, loop: SerializedBlock | null): WorkspaceState => ({
  blocks: { languageVersion: 0, blocks: [
    { ...b('edu_setup', undefined, setup ? { BODY: { block: setup } } : undefined), x: 32, y: 32 },
    { ...b('edu_loop', undefined, loop ? { BODY: { block: loop } } : undefined), x: 32, y: 250 }
  ] }
});

export interface LearningTemplate {
  id: string;
  name: string;
  summary: string;
  goals: string[];
  wiring: string[];
  libraries: string[];
  createWorkspace: () => WorkspaceState;
}

export const TEMPLATES: LearningTemplate[] = [
  {
    id: 'led', name: 'LED 闪烁', summary: '每秒切换 LED，并输出串口消息。',
    goals: ['认识数字输出与重复执行', '比较等待时间与闪烁频率'],
    wiring: ['默认 GPIO2；确认实际板子的 LED 引脚，或接外置 LED 与限流电阻。', '所有示例默认经典 ESP32 Dev Module，换板时重新检查引脚。'], libraries: [],
    createWorkspace: () => workspace(b('edu_pin_mode', { PIN: 2, MODE: 'OUTPUT' }), chain(
      b('edu_write', { PIN: 2, VALUE: 'HIGH' }), b('edu_print', undefined, { VALUE: text('LED ON') }), b('edu_delay', { MS: 1000 }),
      b('edu_write', { PIN: 2, VALUE: 'LOW' }), b('edu_print', undefined, { VALUE: text('LED OFF') }), b('edu_delay', { MS: 1000 })
    ))
  },
  {
    id: 'button', name: '按钮控制 LED', summary: '读取上拉输入，按下按钮点亮 LED。',
    goals: ['理解上拉输入和低电平按下', '使用条件分支控制输出'],
    wiring: ['按钮连接 GPIO18 与 GND。GPIO18 使用内部上拉。', 'LED 使用 GPIO2，按板型调整；外置 LED 串联限流电阻。'], libraries: [],
    createWorkspace: () => {
      const condition = b('logic_compare', { OP: 'EQ' }, { A: { block: b('edu_read', { PIN: 18 }) }, B: { block: b('math_number', { NUM: 0 }) } });
      const branch = b('controls_if', undefined, { IF0: { block: condition }, DO0: { block: b('edu_write', { PIN: 2, VALUE: 'HIGH' }) }, ELSE: { block: b('edu_write', { PIN: 2, VALUE: 'LOW' }) } });
      branch.extraState = { hasElse: true };
      return workspace(chain(b('edu_pin_mode', { PIN: 18, MODE: 'INPUT_PULLUP' }), b('edu_pin_mode', { PIN: 2, MODE: 'OUTPUT' })), chain(branch, b('edu_delay', { MS: 20 })));
    }
  },
  {
    id: 'dht11', name: 'DHT11 温湿度', summary: '每两秒读取并打印温度、湿度。',
    goals: ['读取传感器数值', '理解库依赖与采样间隔'],
    wiring: ['DHT11 数据接 GPIO4；VCC/GND 按具体模块规格连接，共地。', '裸传感器需要数据上拉电阻；NaN 表示读取失败，请检查接线。'], libraries: ['DHT sensor library@1.4.7', 'Adafruit Unified Sensor@1.1.15'],
    createWorkspace: () => workspace(null, chain(
      b('edu_print', undefined, { VALUE: text('Temperature C:') }), b('edu_print', undefined, { VALUE: { block: b('edu_dht_read', { PIN: 4, KIND: 'TEMP' }) } }),
      b('edu_print', undefined, { VALUE: text('Humidity %:') }), b('edu_print', undefined, { VALUE: { block: b('edu_dht_read', { PIN: 4, KIND: 'HUM' }) } }), b('edu_delay', { MS: 2000 })
    ))
  },
  {
    id: 'sh1106', name: 'SH1106 OLED', summary: '在 128×64 I2C 屏幕上显示问候。',
    goals: ['理解 I2C 地址与 SDA/SCL', '使用显示库输出文本'],
    wiring: ['经典 ESP32：SDA 接 GPIO21，SCL 接 GPIO22，屏幕地址默认 0x3C。', '此示例针对 SH1106 128×64 I2C；默认字库显示英文，不支持中文字体。'], libraries: ['Adafruit SH110X@2.1.15', 'Adafruit GFX Library@1.12.6', 'Adafruit BusIO@1.17.4'],
    createWorkspace: () => workspace(b('edu_oled_text', { TEXT: 'Hello, EduBoard!', SDA: 21, SCL: 22, ADDR: '0x3C' }), b('edu_delay', { MS: 1000 }))
  },
  {
    id: 'neopixel', name: 'NeoPixel 彩灯', summary: '点亮 8 颗灯带中的第 0 颗，使用较低亮度。',
    goals: ['理解 RGB 颜色和从 0 开始的编号', '检查供电与灯带数据方向'],
    wiring: ['DIN 接 GPIO4，示例灯数为 8；按具体灯带规格供电，开发板与灯带共地。', '勿由 GPIO 给灯带供电；按元件要求使用供电、限流及电平转换方案。'], libraries: ['Adafruit NeoPixel@1.15.5'],
    createWorkspace: () => workspace(b('edu_pixel', { PIN: 4, COUNT: 8, INDEX: 0, R: 64, G: 0, B: 0 }), b('edu_delay', { MS: 1000 }))
  }
];
