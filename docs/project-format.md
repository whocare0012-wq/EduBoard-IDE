# EduBoard project format v1

An Arduino project uses `Name/Name.eduboard.json` plus the exported `Name/Name.ino`. The JSON document is authoritative for block layout, language, mode, board target and source. Open the JSON to restore blocks; opening `.ino` directly starts a legacy text workflow. Both workflows remain supported.

```json
{
  "format": "eduboard-project",
  "version": 1,
  "language": "arduino",
  "mode": "blocks",
  "fqbn": "esp32:esp32:esp32",
  "source": "// generated code...",
  "workspace": {"blocks": {"languageVersion": 0, "blocks": []}}
}
```

The workspace uses [Blockly JSON serialization](https://docs.blockly.com/guides/configure/serialization/). Only the application's supported blocks and variable serializer are accepted. Unknown format versions, unsupported block types, dangerous property keys, oversized fields, over 1000 blocks, excessive nesting and excessive conditional mutation counts are rejected. Source is limited to 1 MB, workspace to 2 MB and the final saved document to 4 MB.

`mode: "text"` has a null workspace. `mode: "blocks"` keeps the workspace and regenerates its code. Text editing does not convert arbitrary C++ back into blocks. The “生成文本副本” action first saves the block project, then starts a separate editable text project so the original layout remains on disk.

Numeric variables use C++ doubles. Numeric literal generation preserves floating-point division. GPIO, serial, control flow and sensor statements have dedicated [language generators](https://docs.blockly.com/guides/create-custom-blocks/code-generation/overview/). Unconnected top-level blocks produce a warning. Duplicate program roots, conflicting device settings and invalid NeoPixel indices produce errors and block compilation. An unfinished layout can still be saved for later repair.

Each file is saved by atomic rename. The source export is written first and the authoritative JSON last; a failure is reported and never updates the active project path or marks the UI saved. This is not a filesystem transaction across both files. If interrupted between writes, reopen the JSON and save again to regenerate its source export.

Project documents contain no tool executable paths. Those remain in local application preferences; selecting a project cannot change which host program the IDE executes.
