# EduBoard IDE

[English](README.md) · [开发路线图](ROADMAP.md) · [贡献指南](CONTRIBUTING.md)

> 面向中小学编程和创客教育的免费、开源桌面 IDE，计划支持 Arduino C++、Blockly 图形化编程与 MicroPython。

**当前状态：早期开发 / Pre-alpha，尚无经过验证的正式安装包。** 请勿直接用于依赖稳定性的课堂教学。

## 产品定位

EduBoard IDE 希望让学生从图形化编程逐步过渡到文本编程，并在同一软件内完成真实开发板项目。

- **学生端：** 创建、保存项目，编写代码，选择开发板，编译上传，查看串口输出。
- **教师端（规划中）：** 课程模板、项目案例、教学任务和课堂工具。
- **离线优先：** 基础编辑功能不依赖账户；工具链、核心板包和依赖仍需要预先安装。
- **公开协作：** 欢迎增加开发板、传感器积木、语言支持、教学项目和翻译。

## 开发计划

| 版本 | 目标 | 进度 |
| --- | --- | --- |
| V0.1 | Windows 桌面程序、Arduino C++、ESP32 编译烧录、串口与项目管理 | 开发中 |
| V0.2 | Blockly 积木与 Arduino 代码生成 | 规划中 |
| V0.3 | MicroPython 固件、REPL、文件管理 | 规划中 |
| V1.0 | 稳定的教学工作流、教师资源 | 规划中 |

首期重点为 Windows 10/11 + ESP32。并非所有开发板都会支持全部语言。

## 开发环境运行

需要 Node.js 22+、npm、[Arduino CLI](https://docs.arduino.cc/arduino-cli/)。

```bash
git clone https://github.com/whocare0012-wq/EduBoard-IDE.git
cd EduBoard-IDE
npm install
npm run dev
```

可在系统 PATH 中配置 `arduino-cli`，或通过 `ARDUINO_CLI_PATH` 环境变量指定位置。ESP32 的板卡核心需要另行安装。详见 [开发说明](docs/development.md)。

```bash
npm run typecheck
npm run build
```

目前是源码开发方式，尚未提供面向普通用户的一键安装流程，也没有通过真实硬件测试的正式声明。

## 参与开源

个人发起并维护，欢迎通过 [Issues](https://github.com/whocare0012-wq/EduBoard-IDE/issues) 反馈问题，通过 Pull Request 贡献代码或教学资源。提交前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证与品牌

本仓库保留创建时采用的 **GPL-3.0** 开源许可证。第三方组件分别遵守自身许可证，详见 [依赖说明](docs/third-party-licenses.md)。

本项目独立开发，不隶属 Arduino、Google Blockly 或米思齐官方。
