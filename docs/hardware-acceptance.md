# Physical acceptance gates / 真实设备验收

These gates remain pending because no development board is available. A mocked process, detected system COM port, successful source build or installer build does not satisfy them. Record Windows version, IDE commit, exact board/model/revision, USB driver, COM port, CLI/core or firmware versions, LED pin, wiring and tester.

## Arduino / V0.1

- [ ] Install on a fresh Windows 10/11 machine without Node.js and provision the offline tool bundle.
- [ ] Detect the board's actual COM port and choose its matching target.
- [ ] Save/reopen Blink, compile/upload it and confirm the LED's physical behavior.
- [ ] Read serial output at 115200 and send text to a separate echo sketch.
- [ ] Upload while monitoring successfully twice, with no descendants holding the port.
- [ ] Verify disconnect, busy port, missing driver, compile error and canceled upload recovery.

## Blockly / V0.2

- [ ] LED, button, DHT11, SH1106 and NeoPixel examples run with the documented wiring and libraries.
- [ ] Saved block projects regenerate the same intended behavior after reopening.

## MicroPython / V0.3

- [ ] Verify chip, firmware family, flash offset and firmware digest; back up required files.
- [ ] Flash only with permission to overwrite firmware/data; confirm firmware boot and REPL.
- [ ] Execute scripts; upload/download/list/delete files; disconnect and reconnect.
- [ ] Check wrong chip, invalid image, occupied port and interrupted operation recovery.

## Classroom / V1.0

- [ ] Complete an offline lesson on a fresh Windows installation.
- [ ] Teacher exports a lesson, student imports it and returns an assignment file.
- [ ] Keyboard and screen-reader checks with actual assistive software and intended users.
- [ ] Review release signatures, notices, source availability and maintenance gates.
