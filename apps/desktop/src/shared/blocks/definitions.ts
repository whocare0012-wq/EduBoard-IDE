// SPDX-License-Identifier: GPL-3.0-only
import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import * as zh from 'blockly/msg/zh-hans';

const pin = (name = 'PIN', value = 2): object => ({ type: 'field_number', name, value, min: 0, max: 48, precision: 1 });
const number = (name: string, value: number, min: number, max: number): object => ({ type: 'field_number', name, value, min, max, precision: 1 });
const statement = { previousStatement: null, nextStatement: null };

export function registerBlocks(): void {
  Blockly.setLocale(Object.fromEntries(Object.entries(zh).filter(([, value]) => typeof value === 'string')) as Record<string, string>);
  if (Blockly.Blocks.edu_setup) return;
  const setVariable = Blockly.Blocks.variables_set.init;
  Blockly.Blocks.variables_set.init = function () { setVariable.call(this); this.getInput('VALUE')?.setCheck('Number'); };
  const getVariable = Blockly.Blocks.variables_get.init;
  Blockly.Blocks.variables_get.init = function () { getVariable.call(this); this.setOutput(true, 'Number'); };
  Blockly.defineBlocksWithJsonArray([
    { type: 'edu_setup', message0: '启动时 %1', args0: [{ type: 'input_statement', name: 'BODY' }], colour: 230 },
    { type: 'edu_loop', message0: '不断重复 %1', args0: [{ type: 'input_statement', name: 'BODY' }], colour: 230 },
    { type: 'edu_pin_mode', message0: '设置引脚 %1 为 %2', args0: [pin(), { type: 'field_dropdown', name: 'MODE', options: [['输出', 'OUTPUT'], ['输入', 'INPUT'], ['上拉输入', 'INPUT_PULLUP']] }], ...statement, colour: 160 },
    { type: 'edu_write', message0: '引脚 %1 输出 %2', args0: [pin(), { type: 'field_dropdown', name: 'VALUE', options: [['高电平', 'HIGH'], ['低电平', 'LOW']] }], ...statement, colour: 160 },
    { type: 'edu_read', message0: '读取引脚 %1 的数字电平', args0: [pin('PIN', 18)], output: 'Number', colour: 160 },
    { type: 'edu_analog_read', message0: '读取引脚 %1 的模拟值', args0: [pin('PIN', 34)], output: 'Number', colour: 160 },
    { type: 'edu_delay', message0: '等待 %1 毫秒', args0: [number('MS', 1000, 0, 86_400_000)], ...statement, colour: 230 },
    { type: 'edu_print', message0: '串口打印 %1', args0: [{ type: 'input_value', name: 'VALUE' }], ...statement, colour: 200 },
    { type: 'edu_dht_read', message0: 'DHT11 引脚 %1 读取 %2', args0: [pin('PIN', 4), { type: 'field_dropdown', name: 'KIND', options: [['温度 °C', 'TEMP'], ['湿度 %', 'HUM']] }], output: 'Number', colour: 40 },
    { type: 'edu_oled_text', message0: 'SH1106 显示 %1 SDA %2 SCL %3 地址 %4', args0: [{ type: 'field_input', name: 'TEXT', text: 'Hello, EduBoard!' }, pin('SDA', 21), pin('SCL', 22), { type: 'field_dropdown', name: 'ADDR', options: [['0x3C', '0x3C'], ['0x3D', '0x3D']] }], ...statement, colour: 40 },
    { type: 'edu_pixel', message0: 'NeoPixel 引脚 %1 灯数 %2 第 %3 颗 红 %4 绿 %5 蓝 %6', args0: [pin('PIN', 4), number('COUNT', 8, 1, 256), number('INDEX', 0, 0, 255), number('R', 64, 0, 255), number('G', 0, 0, 255), number('B', 0, 0, 255)], ...statement, colour: 40 }
  ]);
}

const block = (type: string, fields?: Record<string, unknown>, inputs?: Record<string, unknown>): object => ({ kind: 'block', type, ...(fields ? { fields } : {}), ...(inputs ? { inputs } : {}) });
export const TOOLBOX = {
  kind: 'categoryToolbox', contents: [
    { kind: 'category', name: '程序', colour: 230, contents: [block('edu_setup'), block('edu_loop')] },
    { kind: 'category', name: '引脚', colour: 160, contents: [block('edu_pin_mode'), block('edu_write'), block('edu_read'), block('edu_analog_read')] },
    { kind: 'category', name: '控制', colour: 230, contents: [block('edu_delay'), block('controls_repeat_ext', undefined, { TIMES: { shadow: { type: 'math_number', fields: { NUM: 10 } } } }), block('controls_if'), block('controls_whileUntil')] },
    { kind: 'category', name: '逻辑', colour: 210, contents: [block('logic_compare'), block('logic_operation'), block('logic_boolean'), block('logic_negate')] },
    { kind: 'category', name: '数学', colour: 230, contents: [block('math_number'), block('math_arithmetic'), block('math_modulo')] },
    { kind: 'category', name: '变量（数值）', custom: 'VARIABLE', colour: 330 },
    { kind: 'category', name: '文本 / 串口', colour: 200, contents: [block('text'), block('edu_print', undefined, { VALUE: { shadow: { type: 'text', fields: { TEXT: 'Hello!' } } } })] },
    { kind: 'category', name: '传感器 / 显示', colour: 40, contents: [block('edu_dht_read'), block('edu_oled_text'), block('edu_pixel')] }
  ]
};
