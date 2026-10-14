# Development-board examples

Open a `Lesson_*/Lesson_*.eduboard.json` file to restore blocks or the sibling `.ino` for text editing. These examples target `esp32:esp32:esp32` and were compiled with Arduino CLI 1.5.1 and ESP32 core 3.3.12. Physical behavior remains unverified until [hardware acceptance](../docs/hardware-acceptance.md).

| Example | Wiring baseline | Required libraries |
| --- | --- | --- |
| LED | GPIO2, board-specific LED or external LED with resistor | None |
| Button | GPIO18 to GND with INPUT_PULLUP; LED GPIO2 | None |
| DHT11 | Data GPIO4, module-specific power and data pull-up | DHT sensor library 1.4.7; Unified Sensor 1.1.15 |
| SH1106 | 128×64 I2C, SDA21/SCL22, address 0x3C | SH110X 2.1.15; GFX 1.12.6; BusIO 1.17.4 |
| NeoPixel | DIN4, 8 pixels, index 0, low initial brightness, common ground | NeoPixel 1.15.5 |

Always check the actual board's pin map and the component's power requirements. ESP32 input-only and flash/PSRAM pins must not be used as generic output pins. Default OLED fonts display English; Chinese font rendering is not implemented. NeoPixel power must not come from a GPIO.

`npm run test:examples` generates ignored check output and compiles each example without uploading. `npm run examples:generate` also refreshes these source/project companions after successful compilation. Both require the installed toolchain/libraries. UI examples include wiring notes.

`Python_*/Python_*.eduboard.json` and `main.py` contain MicroPython LED, button, DHT11 and NeoPixel examples. `npm run test:python-examples` syntax-checks generation for all four catalogue variants without running user code. C3 fresh examples remap LED2 to LED3 and button18 to button5 to avoid USB pins; existing workspaces are never rewritten when selecting a different board. Check actual board pins and firmware compatibility before running.
