// SPDX-License-Identifier: GPL-3.0-only
import * as Blockly from 'blockly/core';

export interface GeneratedCode { code: string; warnings: string[]; libraries: string[]; }

export function cppString(text: string): string {
  return '"' + Array.from(text, char => {
    if (char === '"') return '\\"';
    if (char === '\\') return '\\\\';
    if (char === '\n') return '\\n';
    if (char === '\r') return '\\r';
    if (char === '\t') return '\\t';
    const code = char.charCodeAt(0);
    return code < 32 || code === 127 ? '\\' + code.toString(8).padStart(3, '0') : char;
  }).join('') + '"';
}

class ArduinoGenerator extends Blockly.CodeGenerator {
  readonly includes = new Set<string>(['#include <Arduino.h>', '#include <math.h>']);
  readonly globals = new Map<string, string>();
  readonly startup = new Map<string, string>();
  readonly libraries = new Set<string>();
  private readonly devices = new Map<string, string>();

  constructor(workspace: Blockly.Workspace) {
    super('Arduino');
    this.addReservedWords('setup,loop,Serial,Wire,HIGH,LOW,INPUT,OUTPUT,INPUT_PULLUP,delay,int,double,bool,for,while,if,else,void,true,false,pinMode,digitalRead,digitalWrite,analogRead,eduDisplay,eduDisplayReady');
    this.nameDB_ = new Blockly.Names(this.RESERVED_WORDS_, 'eduVar_');
    this.nameDB_.setVariableMap(workspace.getVariableMap());
    this.isInitialized = true;
    this.scrub_ = (block, code, thisOnly) => code + (!thisOnly && block.nextConnection?.targetBlock() ? this.blockToCode(block.nextConnection.targetBlock()!) : '');
    const value = (block: Blockly.Block, name: string, fallback = '0'): string => this.valueToCode(block, name, 99) || fallback;
    const numeric = (block: Blockly.Block, field: string, min = 0, max = 48): number => {
      const n = Number(block.getFieldValue(field));
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) throw new Error('积木数字超出范围：' + field);
      return n;
    };
    const variable = (block: Blockly.Block): string => this.nameDB_!.getName(block.getFieldValue('VAR'), Blockly.Names.NameType.VARIABLE);
    this.forBlock.math_number = block => {
      const n = Number(block.getFieldValue('NUM'));
      if (!Number.isFinite(n)) throw new Error('数字必须有限。');
      return [Number.isInteger(n) && Math.abs(n) < 1e21 ? String(n) + '.0' : String(n), 0];
    };
    this.forBlock.text = block => [cppString(String(block.getFieldValue('TEXT'))), 0];
    this.forBlock.logic_boolean = block => [block.getFieldValue('BOOL') === 'TRUE' ? 'true' : 'false', 0];
    this.forBlock.math_arithmetic = block => {
      const a = value(block, 'A'); const b = value(block, 'B');
      const op = { ADD: '+', MINUS: '-', MULTIPLY: '*', DIVIDE: '/' }[block.getFieldValue('OP') as 'ADD'];
      return [op ? '(' + a + ' ' + op + ' ' + b + ')' : 'pow(' + a + ', ' + b + ')', 0];
    };
    this.forBlock.math_modulo = block => ['fmod(' + value(block, 'DIVIDEND') + ', ' + value(block, 'DIVISOR', '1') + ')', 0];
    this.forBlock.logic_compare = block => {
      const op = { EQ: '==', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=' }[block.getFieldValue('OP') as 'EQ'];
      return ['(' + value(block, 'A') + ' ' + op + ' ' + value(block, 'B') + ')', 0];
    };
    this.forBlock.logic_operation = block => ['(' + value(block, 'A', 'false') + (block.getFieldValue('OP') === 'AND' ? ' && ' : ' || ') + value(block, 'B', 'false') + ')', 0];
    this.forBlock.logic_negate = block => ['(!' + value(block, 'BOOL', 'false') + ')', 0];
    this.forBlock.variables_get = block => [variable(block), 0];
    this.forBlock.variables_set = block => variable(block) + ' = ' + value(block, 'VALUE') + ';\n';
    this.forBlock.math_change = block => variable(block) + ' += ' + value(block, 'DELTA', '1') + ';\n';
    this.forBlock.controls_if = block => {
      let code = '';
      for (let index = 0; block.getInput('IF' + index); index++) {
        code += (index ? 'else ' : '') + 'if (' + value(block, 'IF' + index, 'false') + ') {\n' + this.statementToCode(block, 'DO' + index) + '}\n';
      }
      if (block.getInput('ELSE')) code += 'else {\n' + this.statementToCode(block, 'ELSE') + '}\n';
      return code;
    };
    this.forBlock.controls_repeat_ext = block => {
      const count = this.nameDB_!.getDistinctName('repeatCount', Blockly.Names.NameType.VARIABLE);
      const index = this.nameDB_!.getDistinctName('repeatIndex', Blockly.Names.NameType.VARIABLE);
      return 'for (double ' + index + ' = 0, ' + count + ' = ' + value(block, 'TIMES') + '; ' + index + ' < ' + count + '; ++' + index + ') {\n' + this.statementToCode(block, 'DO') + '}\n';
    };
    this.forBlock.controls_whileUntil = block => 'while (' + (block.getFieldValue('MODE') === 'UNTIL' ? '!' : '') + '(' + value(block, 'BOOL', 'false') + ')) {\n' + this.statementToCode(block, 'DO') + '}\n';
    this.forBlock.edu_pin_mode = block => 'pinMode(' + numeric(block, 'PIN') + ', ' + block.getFieldValue('MODE') + ');\n';
    this.forBlock.edu_write = block => 'digitalWrite(' + numeric(block, 'PIN') + ', ' + block.getFieldValue('VALUE') + ');\n';
    this.forBlock.edu_read = block => ['digitalRead(' + numeric(block, 'PIN') + ')', 0];
    this.forBlock.edu_analog_read = block => ['analogRead(' + numeric(block, 'PIN') + ')', 0];
    this.forBlock.edu_delay = block => 'delay(' + numeric(block, 'MS', 0, 86_400_000) + ');\n';
    this.forBlock.edu_print = block => 'Serial.println(' + value(block, 'VALUE', '""') + ');\n';
    this.forBlock.edu_dht_read = block => {
      const pin = numeric(block, 'PIN'); const name = 'eduDht_' + pin;
      this.includes.add('#include <DHT.h>'); this.libraries.add('DHT sensor library@1.4.7');
      this.globals.set(name, 'DHT ' + name + '(' + pin + ', DHT11);');
      this.startup.set(name, name + '.begin();');
      return [name + (block.getFieldValue('KIND') === 'HUM' ? '.readHumidity()' : '.readTemperature()'), 0];
    };
    this.forBlock.edu_oled_text = block => {
      const sda = numeric(block, 'SDA'); const scl = numeric(block, 'SCL'); const address = block.getFieldValue('ADDR');
      if (!['0x3C', '0x3D'].includes(address)) throw new Error('无效 OLED 地址。');
      this.requireDevice('oled', sda + ':' + scl + ':' + address);
      this.includes.add('#include <Wire.h>'); this.includes.add('#include <Adafruit_SH110X.h>'); this.libraries.add('Adafruit SH110X@2.1.15');
      this.globals.set('oled', 'Adafruit_SH1106G eduDisplay(128, 64, &Wire, -1);\nbool eduDisplayReady = false;');
      this.startup.set('oled', 'Wire.begin(' + sda + ', ' + scl + ');\neduDisplayReady = eduDisplay.begin(' + address + ', true);\nif (!eduDisplayReady) Serial.println("SH1106 not found");');
      return 'if (eduDisplayReady) {\n  eduDisplay.clearDisplay();\n  eduDisplay.setTextSize(1);\n  eduDisplay.setTextColor(SH110X_WHITE);\n  eduDisplay.setCursor(0, 0);\n  eduDisplay.println(' + cppString(String(block.getFieldValue('TEXT'))) + ');\n  eduDisplay.display();\n}\n';
    };
    this.forBlock.edu_pixel = block => {
      const pin = numeric(block, 'PIN'); const count = numeric(block, 'COUNT', 1, 256); const index = numeric(block, 'INDEX', 0, 255);
      if (index >= count) throw new Error('NeoPixel 灯珠序号必须小于灯数（从 0 开始）。');
      const name = 'eduStrip_' + pin;
      this.requireDevice(name, String(count));
      this.includes.add('#include <Adafruit_NeoPixel.h>'); this.libraries.add('Adafruit NeoPixel@1.15.5');
      this.globals.set(name, 'Adafruit_NeoPixel ' + name + '(' + count + ', ' + pin + ', NEO_GRB + NEO_KHZ800);');
      this.startup.set(name, name + '.begin();\n' + name + '.clear();\n' + name + '.show();');
      return name + '.setPixelColor(' + index + ', ' + name + '.Color(' + numeric(block, 'R', 0, 255) + ', ' + numeric(block, 'G', 0, 255) + ', ' + numeric(block, 'B', 0, 255) + '));\n' + name + '.show();\n';
    };
    for (const model of workspace.getVariableMap().getAllVariables()) {
      const name = this.nameDB_.getName(model.getId(), Blockly.Names.NameType.VARIABLE);
      this.globals.set('var:' + model.getId(), 'double ' + name + ' = 0;');
    }
  }

  private requireDevice(key: string, configuration: string): void {
    const previous = this.devices.get(key);
    if (previous && previous !== configuration) throw new Error('同一设备的积木配置不一致：' + key);
    this.devices.set(key, configuration);
  }
}

export function generateArduino(workspace: Blockly.Workspace): GeneratedCode {
  const generator = new ArduinoGenerator(workspace);
  const roots = workspace.getTopBlocks(true).filter(block => block.isEnabled());
  const setup = roots.filter(block => block.type === 'edu_setup');
  const loop = roots.filter(block => block.type === 'edu_loop');
  if (setup.length > 1 || loop.length > 1) throw new Error('只能有一个“启动时”和一个“不断重复”积木。');
  const setupCode = setup[0] ? generator.statementToCode(setup[0], 'BODY') : '';
  const loopCode = loop[0] ? generator.statementToCode(loop[0], 'BODY') : '';
  const unconnected = roots.filter(block => block.type !== 'edu_setup' && block.type !== 'edu_loop').length;
  const warnings = unconnected ? ['有 ' + unconnected + ' 个未连接积木不会执行，请连接到程序中。'] : [];
  const startup = Array.from(generator.startup.values()).join('\n').split('\n').filter(Boolean).map(line => '  ' + line).join('\n');
  const code = '// Generated by EduBoard IDE. Blocks are the source of truth.\n' + Array.from(generator.includes).sort().join('\n') + '\n\n' + Array.from(generator.globals.values()).join('\n') + '\n\nvoid setup() {\n  Serial.begin(115200);\n' + (startup ? startup + '\n' : '') + setupCode + '}\n\nvoid loop() {\n' + loopCode + '}\n';
  return { code, warnings, libraries: Array.from(generator.libraries).sort() };
}
