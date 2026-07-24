import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class SerialManager {
    private currentPort: string | undefined;
    private baudRate: number = 9600;
    private isConnected: boolean = false;
    
    private statusBarItem: vscode.StatusBarItem;
    
    private _onConnectionChanged = new vscode.EventEmitter<boolean>();
    public readonly onConnectionChanged = this._onConnectionChanged.event;

    private _onDataReceived = new vscode.EventEmitter<string>();
    public readonly onDataReceived = this._onDataReceived.event;

    constructor(private context: vscode.ExtensionContext) {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
        this.statusBarItem.command = 'ic.selectPort';
        this.context.subscriptions.push(this.statusBarItem);

        this.loadConfiguration();
    }

    private loadConfiguration() {
        const config = vscode.workspace.getConfiguration('ic');
        this.currentPort = config.get<string>('serialPort');
        this.baudRate = config.get<number>('baudRate') || 9600;
        
        this.updateStatusBar();
    }

    private updateStatusBar() {
        if (this.isConnected && this.currentPort) {
            this.statusBarItem.text = `$(plug) ${this.currentPort} ⚡`;
            this.statusBarItem.tooltip = `Connected to ${this.currentPort} at ${this.baudRate} baud. Click to change.`;
        } else if (this.currentPort) {
            this.statusBarItem.text = `$(plug) ${this.currentPort}`;
            this.statusBarItem.tooltip = `Port selected: ${this.currentPort} (Disconnected). Click to connect or change.`;
        } else {
            this.statusBarItem.text = `$(plug) No Port`;
            this.statusBarItem.tooltip = `No serial port selected. Click to select COM port.`;
        }
        this.statusBarItem.show();
    }

    public async getAvailablePorts(): Promise<string[]> {
        try {
            const { stdout } = await execAsync('powershell -NoProfile -Command "[System.IO.Ports.SerialPort]::GetPortNames()"');
            const ports = stdout.split(/\r?\n/).map(p => p.trim()).filter(p => p.length > 0);
            return ports.length > 0 ? Array.from(new Set(ports)) : [];
        } catch (error) {
            console.error('Error fetching COM ports:', error);
            return [];
        }
    }

    public async selectPort(): Promise<void> {
        const ports = await this.getAvailablePorts();
        
        if (ports.length === 0) {
            const action = await vscode.window.showWarningMessage(
                'No physical COM ports found on this system. Make sure your USB-to-Serial adapter or robot board is connected.',
                'Refresh Ports', 'Enter Port Manually'
            );
            if (action === 'Refresh Ports') {
                return this.selectPort();
            } else if (action === 'Enter Port Manually') {
                const manualPort = await vscode.window.showInputBox({
                    prompt: 'Enter COM Port name (e.g. COM1, COM3, COM4)',
                    value: 'COM1'
                });
                if (manualPort) {
                    this.currentPort = manualPort.trim().toUpperCase();
                    const config = vscode.workspace.getConfiguration('ic');
                    await config.update('serialPort', this.currentPort, vscode.ConfigurationTarget.Global);
                    await this.connect();
                }
            }
            return;
        }

        const items = ports.map(p => ({
            label: p,
            description: p === this.currentPort ? '(Current)' : ''
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a COM Port for Interactive C',
        });

        if (selected) {
            this.currentPort = selected.label;
            
            const config = vscode.workspace.getConfiguration('ic');
            await config.update('serialPort', this.currentPort, vscode.ConfigurationTarget.Global);
            
            await this.connect();
        }
    }

    /**
     * Tests and connects to the selected COM port via Windows System.IO.Ports.SerialPort
     */
    public async connect(): Promise<void> {
        if (!this.currentPort) {
            await this.selectPort();
            if (!this.currentPort) { return; }
        }

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Connecting to ${this.currentPort} (${this.baudRate} baud)...`,
                cancellable: false
            },
            async () => {
                const psScript = `$p = '${this.currentPort}'; $b = ${this.baudRate}; try { $sp = New-Object System.IO.Ports.SerialPort $p, $b; $sp.Open(); if ($sp.IsOpen) { Write-Output "CONNECTED"; $sp.Close() } } catch { Write-Output ("ERROR: " + $_.Exception.Message) }`;
                const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
                const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}`;

                try {
                    const { stdout } = await execAsync(cmd);
                    const output = stdout.trim();

                    if (output.includes('CONNECTED')) {
                        this.isConnected = true;
                        this.updateStatusBar();
                        this._onConnectionChanged.fire(true);
                        vscode.window.showInformationMessage(
                            `⚡ Successfully connected to ${this.currentPort} at ${this.baudRate} baud!`,
                            'Open Terminal'
                        ).then(action => {
                            if (action === 'Open Terminal') {
                                vscode.commands.executeCommand('ic.openTerminal');
                            }
                        });
                    } else {
                        this.isConnected = false;
                        this.updateStatusBar();
                        this._onConnectionChanged.fire(false);

                        const errMsg = output.replace('ERROR:', '').trim() || 'Device not responding or port closed.';
                        const choice = await vscode.window.showErrorMessage(
                            `❌ Connection Failed (${this.currentPort}): ${errMsg}`,
                            'Try Again', 'Select Different Port', 'Firmware Wizard'
                        );

                        if (choice === 'Try Again') {
                            this.connect();
                        } else if (choice === 'Select Different Port') {
                            this.selectPort();
                        } else if (choice === 'Firmware Wizard') {
                            vscode.commands.executeCommand('ic.firmwareWizard');
                        }
                    }
                } catch (err: any) {
                    this.isConnected = false;
                    this.updateStatusBar();
                    this._onConnectionChanged.fire(false);
                    vscode.window.showErrorMessage(`❌ Connection Error (${this.currentPort}): ${err.message || err}`);
                }
            }
        );
    }

    public async disconnect(): Promise<void> {
        if (!this.isConnected) {
            vscode.window.showInformationMessage(`Serial port ${this.currentPort || ''} is already disconnected.`);
            return;
        }

        this.isConnected = false;
        this.updateStatusBar();
        this._onConnectionChanged.fire(false);
        vscode.window.showInformationMessage(`Disconnected from ${this.currentPort}.`);
    }

    public send(data: string): void {
        if (!this.isConnected) {
            vscode.window.showErrorMessage('Cannot send data: Serial port is not connected.');
            return;
        }
        console.log(`Sending data to ${this.currentPort}: ${data}`);
        this._onDataReceived.fire(`Sent: ${data}\n`);
    }

    public isPortConnected(): boolean {
        return this.isConnected;
    }

    public getSelectedPort(): string | undefined {
        return this.currentPort;
    }

    public dispose() {
        this.statusBarItem.dispose();
        this._onConnectionChanged.dispose();
        this._onDataReceived.dispose();
    }
}
