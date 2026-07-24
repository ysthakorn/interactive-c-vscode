import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface BoardConfig {
    hardware?: string;
    commtype?: string;
    analog?: number[];
    digital?: number[];
    nummotors?: number;
    numservos?: number;
    maxvalue?: number;
    buttons?: { [name: string]: { port: string; value: number } };
    firmwarePath?: string; // added to help FirmwareDownloader
}

export class BoardManager {
    private readonly context: vscode.ExtensionContext;
    private currentBoard: string | undefined;
    private boardConfig: BoardConfig = {};
    
    private statusBarItem: vscode.StatusBarItem;
    private _onBoardChanged = new vscode.EventEmitter<string>();
    public readonly onBoardChanged = this._onBoardChanged.event;

    private readonly availableBoards = ['handyboard', 'sumo11', 'rcx', 'ax11'];

    constructor(context: vscode.ExtensionContext) {
        this.context = context;

        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.statusBarItem.command = 'ic.selectBoard';
        this.context.subscriptions.push(this.statusBarItem);

        this.loadConfiguration();
    }

    private loadConfiguration() {
        const config = vscode.workspace.getConfiguration('ic');
        this.currentBoard = config.get<string>('targetBoard');

        if (!this.currentBoard || !this.availableBoards.includes(this.currentBoard)) {
            this.currentBoard = 'ax11'; // Default fallback to AX-11
        }

        this.updateBoardConfig(this.currentBoard);
        this.updateStatusBar();
    }

    public async selectBoard(): Promise<void> {
        const selected = await vscode.window.showQuickPick(
            [
                { label: 'ax11', description: 'AX-11 Activity Board — INEX Thailand (68HC11)' },
                { label: 'handyboard', description: 'Handy Board v1.2 (68HC11)' },
                { label: 'sumo11', description: 'Sumo11 Board (68HC11)' },
                { label: 'rcx', description: 'LEGO Mindstorms RCX (H8/300)' }
            ],
            { placeHolder: 'Select a target board for Interactive C' }
        );

        if (selected && selected.label !== this.currentBoard) {
            this.currentBoard = selected.label;
            
            // Update VS Code Configuration
            const config = vscode.workspace.getConfiguration('ic');
            await config.update('targetBoard', this.currentBoard, vscode.ConfigurationTarget.Global);

            this.updateBoardConfig(this.currentBoard);
            this.updateStatusBar();
            this._onBoardChanged.fire(this.currentBoard);
        }
    }

    private updateBoardConfig(boardName: string) {
        const extensionPath = this.context.extensionPath;
        const configPath = path.join(extensionPath, 'resources', 'lib', boardName, 'iclib.txt');

        this.boardConfig = {};

        if (fs.existsSync(configPath)) {
            const content = fs.readFileSync(configPath, 'utf8');
            this.parseConfig(content);
        } else {
            vscode.window.showWarningMessage(`Board configuration for ${boardName} not found at ${configPath}.`);
        }
        
        // Assume firmware path based on board name
        this.boardConfig.firmwarePath = path.join(extensionPath, 'resources', 'lib', boardName, `${boardName}.frm`);
    }

    private parseConfig(content: string) {
        const lines = content.split(/\r?\n/);
        this.boardConfig.buttons = {};

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) {
                continue;
            }

            const [key, ...valueParts] = trimmed.split('=');
            if (!key || valueParts.length === 0) continue;

            const value = valueParts.join('=').trim();
            const lowerKey = key.trim().toLowerCase();

            switch (lowerKey) {
                case 'hardware':
                    this.boardConfig.hardware = value;
                    break;
                case 'commtype':
                    this.boardConfig.commtype = value;
                    break;
                case 'analog':
                    this.boardConfig.analog = value.split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
                    break;
                case 'digital':
                    this.boardConfig.digital = value.split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
                    break;
                case 'nummotors':
                    this.boardConfig.nummotors = parseInt(value, 10);
                    break;
                case 'numservos':
                    this.boardConfig.numservos = parseInt(value, 10);
                    break;
                case 'maxvalue':
                    this.boardConfig.maxvalue = parseInt(value, 10);
                    break;
                case 'button':
                    // button=start,d,28726
                    const btnParts = value.split(',');
                    if (btnParts.length >= 3) {
                        const name = btnParts[0].trim();
                        const port = btnParts[1].trim();
                        const val = parseInt(btnParts[2].trim(), 10);
                        if (this.boardConfig.buttons) {
                            this.boardConfig.buttons[name] = { port, value: val };
                        }
                    }
                    break;
            }
        }
    }

    private updateStatusBar() {
        const boardName = this.boardConfig.hardware || this.currentBoard || 'Unknown Board';
        this.statusBarItem.text = `$(circuit-board) ${boardName}`;
        this.statusBarItem.tooltip = 'Change Interactive C Board';
        this.statusBarItem.show();
    }

    public getBoardConfig(): BoardConfig {
        return this.boardConfig;
    }

    public getCurrentBoard(): string | undefined {
        return this.currentBoard;
    }

    public dispose() {
        this.statusBarItem.dispose();
        this._onBoardChanged.dispose();
    }
}
