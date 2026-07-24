import * as vscode from 'vscode';
import { EventEmitter } from 'vscode';

/**
 * ICTerminal provides an interactive pseudo-terminal for the Interactive C environment.
 */
export class ICTerminal implements vscode.Pseudoterminal {
    private writeEmitter = new EventEmitter<string>();
    onDidWrite: vscode.Event<string> = this.writeEmitter.event;

    private closeEmitter = new EventEmitter<number | void>();
    onDidClose?: vscode.Event<number | void> = this.closeEmitter.event;

    private currentLine = '';
    private history: string[] = [];
    private historyIndex = -1;
    private isConnected = false;

    constructor() {}

    /**
     * Called when the terminal is opened.
     */
    open(initialDimensions: vscode.TerminalDimensions | undefined): void {
        this.writeEmitter.fire('Interactive C Terminal — Type C statements to execute on board\r\n');
        this.prompt();
    }

    /**
     * Called when the terminal is closed.
     */
    close(): void {
        // Cleanup if necessary
    }

    /**
     * Handles incoming keystrokes and data from the user.
     * @param data The input data string.
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
        if (data === '\x7f') {
            if (this.currentLine.length > 0) {
                this.currentLine = this.currentLine.slice(0, -1);
                // Move cursor back, clear to end of line
                this.writeEmitter.fire('\x1b[D\x1b[K');
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

        // Handle normal characters
        if (data >= ' ' && data <= '~') {
            this.currentLine += data;
            this.writeEmitter.fire(data);
        }
    }

    /**
     * Replaces the current line visually in the terminal and updates the buffer.
     * @param newLine The line content to set.
     */
    private replaceCurrentLine(newLine: string): void {
        // Clear current line using ANSI escape sequences
        const clearSequence = '\x1b[2K\x1b[G';
        this.writeEmitter.fire(clearSequence);
        this.prompt();
        this.currentLine = newLine;
        this.writeEmitter.fire(newLine);
    }

    /**
     * Prints the prompt.
     */
    private prompt(): void {
        this.writeEmitter.fire('IC> ');
    }

    /**
     * Processes a submitted command.
     * @param command The command text.
     */
    private processCommand(command: string): void {
        if (command.startsWith(':')) {
            this.handleSpecialCommand(command);
        } else {
            this.sendToBoard(command);
        }
    }

    /**
     * Handles special terminal commands prefixed with ':'.
     * @param command The full command.
     */
    private handleSpecialCommand(command: string): void {
        const parts = command.split(' ');
        const cmd = parts[0];

        switch (cmd) {
            case ':help':
                this.writeEmitter.fire('Available commands:\r\n');
                this.writeEmitter.fire('  :help       - Show this help\r\n');
                this.writeEmitter.fire('  :clear      - Clear the terminal screen\r\n');
                this.writeEmitter.fire('  :history    - Show command history\r\n');
                this.writeEmitter.fire('  :connect    - Connect to board\r\n');
                this.writeEmitter.fire('  :disconnect - Disconnect from board\r\n');
                break;
            case ':clear':
                // Clear screen sequence
                this.writeEmitter.fire('\x1b[2J\x1b[3J\x1b[;H');
                break;
            case ':history':
                this.history.forEach((cmdItem, i) => {
                    this.writeEmitter.fire(`  ${i + 1}: ${cmdItem}\r\n`);
                });
                break;
            case ':connect':
                this.isConnected = true;
                this.writeEmitter.fire('Connected to board.\r\n');
                break;
            case ':disconnect':
                this.isConnected = false;
                this.writeEmitter.fire('Disconnected from board.\r\n');
                break;
            default:
                this.writeEmitter.fire(`Unknown special command: ${cmd}\r\n`);
                break;
        }
        this.prompt();
    }

    /**
     * Sends the command to the Interactive C board via serial.
     * @param command The C statement to execute.
     */
    private sendToBoard(command: string): void {
        if (!this.isConnected) {
            this.writeEmitter.fire('Not connected to board. Use IC: Connect command or :connect.\r\n');
            this.prompt();
            return;
        }

        // Simulate sending to board
        this.writeEmitter.fire(`Sending: ${command}\r\n`);
        
        // Mocking received output delay
        setTimeout(() => {
            this.receiveOutput('Executed successfully\r\n');
            this.prompt();
        }, 500);
    }

    /**
     * Receives and displays output from the board.
     * @param output The text received from the board.
     */
    public receiveOutput(output: string): void {
        this.writeEmitter.fire(`[Board]: ${output}`);
    }

    /**
     * Registers the terminal profile provider with VS Code.
     * @param context The extension context.
     */
    public static register(context: vscode.ExtensionContext): void {
        context.subscriptions.push(
            vscode.window.registerTerminalProfileProvider('ic.terminal', {
                provideTerminalProfile(token: vscode.CancellationToken): vscode.ProviderResult<vscode.TerminalProfile> {
                    return new vscode.TerminalProfile({
                        name: 'Interactive C',
                        pty: new ICTerminal()
                    });
                }
            })
        );
    }
}
