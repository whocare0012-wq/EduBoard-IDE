# EduBoard project format v1

A complete project uses `Name/Name.eduboard.json`. The JSON is authoritative. Saving also exports its active source to `Name/Name.ino` (Arduino) or `Name/main.py` (MicroPython). Open the JSON to restore every workspace; opening a standalone source file uses a legacy text workflow.

```json
{
  "format": "eduboard-project",
  "version": 1,
  "language": "arduino",
  "mode": "text",
  "fqbn": "esp32:esp32:esp32",
  "microBoard": "esp32c3",
  "source": "void setup() {}\nvoid loop() {}\n",
  "drafts": {
    "arduino": "void setup() {}\nvoid loop() {}\n",
    "micropython": "print('hello')\n"
  },
  "blockTarget": "micropython",
  "workspace": {"blocks": {"languageVersion": 0, "blocks": []}}
}
```

The optional `drafts`, `blockTarget` and `microBoard` fields extend v1 without breaking existing projects. Old projects initialize only their active text buffer. A null draft means the language has not been initialized; an empty string is an intentionally empty buffer. Both draft keys are required when the extension is present. In text mode `source` must equal the active draft; in blocks mode it is generated source and `blockTarget` must match `language`.

Text mode may retain a workspace. Mode switching restores independent content; explicit adoption replaces only the selected text draft after confirmation. Arbitrary C++ or Python is not converted back into blocks. `microBoard` and the Arduino FQBN persist regardless of the active language. Only the active source is exported; inactive drafts remain in JSON. After a language switch, the previous language's export file is left as it was and is not authoritative. Saving asks before replacing an existing export file that does not hold what this project last saved for that language. A standalone `.py` file is converted into a project only through an explicit save dialog, because projects require a `Name/Name.eduboard.json` folder.

The workspace uses [Blockly JSON serialization](https://docs.blockly.com/guides/configure/serialization/). Only supported blocks and variable serialization are accepted. Unknown versions, unsupported blocks, unsafe keys, oversized fields, more than 1000 blocks, excessive nesting and excessive conditional mutation counts are rejected. Each source/draft is limited to 1 MB, workspace to 2 MB and the final saved document to 4 MB.

Numeric variables use C++ doubles or Python numbers. Orphan blocks warn; duplicate roots, conflicting device settings and invalid indices fail generation. An unfinished layout can be saved for repair; generation errors disable compile/run in the UI. Such a save stores an empty `source` and leaves the existing source export untouched, so the last good program on disk is not truncated.

Each file is saved by atomic rename. The active source export is written first, JSON last. A failure does not update active paths or mark the UI saved. This is not a transaction across both files; if interrupted, reopen JSON and save to restore the source export. Compiler/run handlers reject a source export inconsistent with the JSON.

Documents contain no host executable paths. Tool selections are local application preferences.

Editor cursor/selection/scroll state and undo/redo remain in memory for the current project session. They survive mode switches but reset on new/open and are not serialized. Panel sizes and visibility are also application-session preferences. These UI changes do not alter format v1.

Syntax/compiler reports, inline markers and log navigation also remain in memory. They are bound to the checked source snapshot and are not saved in project JSON or source exports.
