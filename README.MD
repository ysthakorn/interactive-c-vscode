# Interactive C for Robotics (VS Code Extension)

Interactive C (IC) extension for Visual Studio Code with language support and robotics tooling for educational boards.

## Features

- Syntax highlighting for `.ic` files
- IntelliSense completion and hover documentation
- Compile and firmware download commands
- Serial board connection and interactive terminal
- Board diagram and function reference webviews
- Sidebar views for board info, functions, and sensors/motors

## Supported Boards

- AX-11 Activity Board (INEX)
- Handy Board v1.2
- Sumo11
- LEGO Mindstorms RCX

## Commands

- `IC: Compile`
- `IC: Download to Board`
- `IC: Connect to Board`
- `IC: Disconnect from Board`
- `IC: Select Target Board`
- `IC: Select Serial Port`
- `IC: Download Firmware to Board`
- `IC: Show Board Diagram`
- `IC: Function Reference`
- `IC: Open Interactive Terminal`
- `IC: New Project from Template`

## Extension Settings

- `ic.targetBoard` (default: `ax11`)
- `ic.serialPort`
- `ic.baudRate` (9600, 19200, 38400, 57600, 115200)
- `ic.icPath`
- `ic.autoConnect`

## Example Files

Sample programs are available in:

- `examples/ax11_hello_world.ic`
- `examples/handyboard_hello_world.ic`
- `examples/rcx_hello_world.ic`

## Development

```bash
npm install
npm run compile
npm run lint
```

Package VSIX:

```bash
npx @vscode/vsce package --out interactive-c-vscode.vsix
```
