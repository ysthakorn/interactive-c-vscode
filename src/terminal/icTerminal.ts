import * as vscode from 'vscode';
import { EventEmitter } from 'vscode';
import { SerialManager } from '../serial/serialManager';

/**
 * ICTerminal provides an interactive pseudo-terminal C shell for the Interactive C environment.
 */
export class ICTerminal implements vscode.Pseudoterminal {
    private writeEmitter = new EventEmitter<string>();
    onDidWrite: vscode.Event<string> = this.writeEmitter.event;

    private closeEmitter = new EventEmitter<number | void>();
    onDidClose?: vscode.Event<number | void> = this.closeEmitter.event;

    private currentLine = '';
    private history: string[] = [];
    private historyIndex = -1;

    constructor(private serialManager?: SerialManager) {}

    /**
     * Called when the terminal is opened.
     */
    open(initialDimensions: vscode.TerminalDimensions | undefined): void {
        this.writeEmitter.fire('\x1b[1;36m=====================================================\r\n');
        this.writeEmitter.fire('  Interactive C (IC5) Interactive Shell\r\n');
        this.writeEmitter.fire('  Type any C statement (e.g. printf("Hello!\\n");, beep();, fd(0);)\r\n');
        this.writeEmitter.fire('  Type :help for terminal commands\r\n');
        this.writeEmitter.fire('=====================================================\x1b[0m\r\n\r\n');

        if (this.serialManager && this.serialManager.isPortConnected()) {
            this.writeEmitter.fire(`\x1b[32m[Status]: Connected to ${this.serialManager.getSelectedPort()} ⚡\x1b[0m\r\n\r\n`);
        } else {
            this.writeEmitter.fire('\x1b[33m[Status]: Offline / Simulation Mode (Type statements to test locally)\x1b[0m\r\n\r\n');
        }

        this.prompt();
    }

    close(): void {}

    /**
     * Handles incoming keystrokes and data from the user.
     */
    handleInput(data: string): void {
        // Handle enter key
        if (data === '\r') {
            this.writeEmitter.fire('\r\n');
            const command = this.currentLine.trim();
            if (command) {
                this.history.push(command);
                this.historyIndex = this.history.length;
                this.processCommand(command);
            } else {
                this.prompt();
            }
            this.currentLine = '';
            return;
        }

        // Handle backspace
        if (data === '\x7f' || data === '\b') {
            if (this.currentLine.length > 0) {
                this.currentLine = this.currentLine.slice(0, -1);
                this.writeEmitter.fire('\b \b');
            }
            return;
        }

        // Handle up arrow (history prev)
        if (data === '\x1b[A') {
            if (this.historyIndex > 0) {
                this.historyIndex--;
                this.replaceCurrentLine(this.history[this.historyIndex]);
            }
            return;
        }

        // Handle down arrow (history next)
        if (data === '\x1b[B') {
            if (this.historyIndex < this.history.length - 1) {
                this.historyIndex++;
                this.replaceCurrentLine(this.history[this.historyIndex]);
            } else {
                this.historyIndex = this.history.length;
                this.replaceCurrentLine('');
            }
            return;
        }

        // Handle normal printable characters
        if (data >= ' ' && data <= '~') {
            this.currentLine += data;
            this.writeEmitter.fire(data);
        }
    }

    private replaceCurrentLine(newLine: string): void {
        const clearSequence = '\r\x1b[K';
        this.writeEmitter.fire(clearSequence);
        this.prompt();
        this.currentLine = newLine;
        this.writeEmitter.fire(newLine);
    }

    private prompt(): void {
        this.writeEmitter.fire('\x1b[1;33mIC> \x1b[0m');
    }

    private processCommand(command: string): void {
        if (command.startsWith(':')) {
            this.handleSpecialCommand(command);
        } else {
            this.executeCStatement(command);
        }
    }

    private handleSpecialCommand(command: string): void {
        const cmd = command.split(' ')[0];

        switch (cmd) {
            case ':help':
                this.writeEmitter.fire('\r\nAvailable Commands:\r\n');
                this.writeEmitter.fire('  printf("Hello!\\n");   - Print text to console/screen\r\n');
                this.writeEmitter.fire('  beep();              - Play alert beep\r\n');
                this.writeEmitter.fire('  fd(0); / bk(0);      - Run motor 0 forward/backward\r\n');
                this.writeEmitter.fire('  off(0); / ao();      - Stop motor 0 / all motors\r\n');
                this.writeEmitter.fire('  analog(2);           - Read analog sensor channel 2\r\n');
                this.writeEmitter.fire('  servo(0, 180);       - Move servo 0 to 180 deg\r\n');
                this.writeEmitter.fire('  :connect             - Connect to serial port\r\n');
                this.writeEmitter.fire('  :clear               - Clear terminal screen\r\n');
                this.writeEmitter.fire('  :history             - View history\r\n\r\n');
                break;
            case ':clear':
                this.writeEmitter.fire('\x1b[2J\x1b[3J\x1b[;H');
                break;
            case ':history':
                this.writeEmitter.fire('\r\nCommand History:\r\n');
                this.history.forEach((cmdItem, i) => {
                    this.writeEmitter.fire(`  ${i + 1}: ${cmdItem}\r\n`);
                });
                this.writeEmitter.fire('\r\n');
                break;
            case ':connect':
                vscode.commands.executeCommand('ic.connect');
                break;
            default:
                this.writeEmitter.fire(`\r\nUnknown special command: ${cmd}. Type :help for list.\r\n\r\n`);
                break;
        }
        this.prompt();
    }

    /**
     * Evaluates C statements interactively (Local Simulation or Serial Transmission)
     */
    private executeCStatement(statement: string): void {
        if (this.serialManager && this.serialManager.isPortConnected()) {
            this.serialManager.send(statement);
            this.writeEmitter.fire(`\x1b[32m[Sent to Board]: ${statement}\x1b[0m\r\n`);
            this.prompt();
            return;
        }

        // Local Interactive Shell Evaluation (Simulated IC Shell)
        const clean = statement.replace(/;$/, '').trim();

        if (/^printf\s*\(\s*"(.*?)"\s*(?:,\s*(.*))?\)$/i.test(clean)) {
            const match = /^printf\s*\(\s*"(.*?)"\s*(?:,\s*(.*))?\)$/i.exec(clean);
            let text = match ? match[1] : '';
            text = text.replace(/\\n/g, '\r\n');
            this.writeEmitter.fire(`\x1b[1;32m${text}\x1b[0m`);
            if (!text.endsWith('\r\n')) {
                this.writeEmitter.fire('\r\n');
            }
        } else if (/^beep\s*\(\s*\)$/i.test(clean)) {
            this.writeEmitter.fire('\x1b[1;35m🔊 BEEP! (500Hz, 0.1s)\x1b[0m\r\n');
        } else if (/^fd\s*\(\s*(\d+)\s*\)$/i.test(clean)) {
            const m = /^fd\s*\(\s*(\d+)\s*\)$/i.exec(clean)![1];
            this.writeEmitter.fire(`\x1b[1;36m⚙️ Motor ${m}: FORWARD (100% Speed)\x1b[0m\r\n`);
        } else if (/^bk\s*\(\s*(\d+)\s*\)$/i.test(clean)) {
            const m = /^bk\s*\(\s*(\d+)\s*\)$/i.exec(clean)![1];
            this.writeEmitter.fire(`\x1b[1;36m⚙️ Motor ${m}: BACKWARD (100% Speed)\x1b[0m\r\n`);
        } else if (/^off\s*\(\s*(\d+)\s*\)$/i.test(clean)) {
            const m = /^off\s*\(\s*(\d+)\s*\)$/i.exec(clean)![1];
            this.writeEmitter.fire(`\x1b[1;31m⏹️ Motor ${m}: OFF\x1b[0m\r\n`);
        } else if (/^(ao|alloff)\s*\(\s*\)$/i.test(clean)) {
            this.writeEmitter.fire('\x1b[1;31m⏹️ All Motors: OFF\x1b[0m\r\n');
        } else if (/^analog\s*\(\s*(\d+)\s*\)$/i.test(clean)) {
            const ch = /^analog\s*\(\s*(\d+)\s*\)$/i.exec(clean)![1];
            const val = Math.floor(Math.random() * 128) + 120;
            this.writeEmitter.fire(`\x1b[1;33m[Analog AI-${ch}]: ${val}\x1b[0m\r\n`);
        } else if (/^digital\s*\(\s*(\d+)\s*\)$/i.test(clean)) {
            const ch = /^digital\s*\(\s*(\d+)\s*\)$/i.exec(clean)![1];
            this.writeEmitter.fire(`\x1b[1;33m[Digital DI-${ch}]: 1 (HIGH)\x1b[0m\r\n`);
        } else if (/^servo\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)$/i.test(clean)) {
            const parts = /^servo\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)$/i.exec(clean)!;
            this.writeEmitter.fire(`\x1b[1;34m🔄 Servo Port ${parts[1]} -> Position ${parts[2]}\x1b[0m\r\n`);
        } else {
            this.writeEmitter.fire(`\x1b[36m[IC Shell Executed]: ${clean}\x1b[0m\r\n`);
        }

        this.prompt();
    }
}
