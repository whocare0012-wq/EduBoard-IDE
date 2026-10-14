# EduBoard IDE

[English](README.md) · [开发路线图](ROADMAP.md) · [贡献指南](CONTRIBUTING.md)

> 用于开发板的开源桌面 IDE，可以直接切换图形化、C++ 和 Python 工作区。

**当前状态：0.3 开发预览。** Windows 预览包尚未签名；目前没有可用开发板，真实上传、刷机和全新 Windows 机器验收仍待完成。

## 功能

- **图形化 / C++ / Python 直接切换**：分别保留两份文本代码和积木布局，保存到同一个 EduBoard 项目中。
- **积木代码生成**：选择 Arduino C++ 或 MicroPython，查看生成代码，明确点击“采用生成代码”更新文本工作区。文本修改不会自动转回积木。
- **项目与编辑**：新建、打开、保存，离线 Monaco 和 Blockly 编辑，Ctrl+S，以及未保存内容保护。
- **Arduino 工具链**：配置 CLI，选择 ESP32 目标，编译上传与串口监视。
- **MicroPython**：配置 Python 工具环境，检查语法，在开发板运行程序，连接 REPL，管理设备文件。
- **固件安装**：校验指定官方固件，确认擦除后检查芯片、闪存容量与安全配置，再执行刷写。
- **开发板示例**：LED、按钮、DHT11、OLED（C++）和 NeoPixel，附接线与依赖说明。

基础编辑不需要账户或联网；工具链、板包、库和固件需要提前安装。本项目仅围绕 IDE 和开发板使用进行开发。

## 开发目标

| 阶段 | 目标 |
| --- | --- |
| V0.1 | Windows 桌面、Arduino C++、项目管理、ESP32 工具链与串口 |
| V0.2 | Blockly 保存恢复、C++ 生成与开发板示例 |
| V0.3 | MicroPython、固件检查、REPL、设备文件和三个模式直接切换 |

各项软件进度与待完成的实物验收见 [路线图](ROADMAP.md)。主要目标是 **Windows 10/11 + ESP32**；MicroPython 固件支持范围见 [配置说明](docs/micropython.md)。

## 本地运行

需要 Node.js **22.12+** 和 npm。Arduino CLI、板包及 Python 工具环境独立安装。

```bash
git clone https://github.com/whocare0012-wq/EduBoard-IDE.git
cd EduBoard-IDE
npm ci
npm run dev
```

在界面中选择工具路径，或设置 `ARDUINO_CLI_PATH`、`ARDUINO_CLI_CONFIG_FILE` 和 `EDUBOARD_PYTHON_PATH`。详细操作见 [中文使用指南](docs/user-guide.zh-CN.md) 和 [开发环境](docs/development.md)。

运行 `npm run check` 执行统一软件检查。真实 C++ 编译检查还需要已安装的 ESP32 工具链与传感器库。`npm run package:win` 生成未签名 Windows 预览安装包；GitHub Actions 保留七天构建产物。检查证据见 [开发记录](docs/progress.md)，实物项目见 [硬件验收表](docs/hardware-acceptance.md)。

统一检查后的优化结果与后续改进点见 [代码检查记录](docs/code-review.md)。

## 参与和许可证

欢迎通过 [Issues](https://github.com/whocare0012-wq/EduBoard-IDE/issues) 反馈问题，或贡献开发板适配、积木、示例和文档。提交前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。

仓库代码使用 **GPL-3.0-only**，第三方组件遵守自身许可证，详见 [依赖说明](docs/third-party-licenses.md)。本项目独立开发，不隶属 Arduino、Google Blockly 或米思齐官方。
