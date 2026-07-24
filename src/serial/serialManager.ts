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
        } else {
            this.statusBarItem.text = `$(plug) Disconnected`;
            this.statusBarItem.tooltip = `Serial port disconnected. Click to connect.`;
        }
        this.statusBarItem.show();
    }

    private async getAvailablePorts(): Promise<string[]> {
        try {
            const { stdout } = await execAsync('powershell -Command "[System.IO.Ports.SerialPort]::GetPortNames()"');
            const ports = stdout.split(/\r?\n/).map(p => p.trim()).filter(p => p.length > 0);
            return ports.length > 0 ? Array.from(new Set(ports)) : [];
        } catch (error) {
            console.error('Error fetching COM ports:', error);
            vscode.window.showErrorMessage('Failed to list available COM ports.');
            return [];
        }
    }

    public async selectPort(): Promise<void> {
        const ports = await this.getAvailablePorts();
        
        if (ports.length === 0) {
            vscode.window.showInformationMessage('No COM ports found on this system.');
            return;
        }

        const selected = await vscode.window.showQuickPick(ports, {
            placeHolder: 'Select a COM port',
        });

        if (selected) {
            this.currentPort = selected;
            
            const config = vscode.workspace.getConfiguration('ic');
            await config.update('serialPort', this.currentPort, vscode.ConfigurationTarget.Global);
            
            await this.connect();
        }
    }

    public async connect(): Promise<void> {
        if (!this.currentPort) {
            vscode.window.showErrorMessage('No COM port selected.');
            return;
        }

        if (this.isConnected) {
            await this.disconnect();
        }

        try {
            // TODO: Initialize real serial connection here using serialport module
            // e.g. this.serialPort = new SerialPort({ path: this.currentPort, baudRate: this.baudRate });
            
            this.isConnected = true;
            this.updateStatusBar();
            this._onConnectionChanged.fire(this.isConnected);
            vscode.window.showInformationMessage(`Connected to ${this.currentPort} at ${this.baudRate} baud.`);
            
            // Placeholder: simulate receiving some data
            // setTimeout(() => this._onDataReceived.fire("Simulated data from board\n"), 2000);
        } catch (error) {
            this.isConnected = false;
            this.updateStatusBar();
            vscode.window.showErrorMessage(`Failed to connect to ${this.currentPort}.`);
        }
    }

    public async disconnect(): Promise<void> {
        if (!this.isConnected) {
            return;
        }

        // TODO: Close real serial connection here
        // if (this.serialPort && this.serialPort.isOpen) { this.serialPort.close(); }

        this.isConnected = false;
        this.updateStatusBar();
        this._onConnectionChanged.fire(this.isConnected);
        vscode.window.showInformationMessage(`Disconnected from ${this.currentPort}.`);
    }

    public send(data: string): void {
        if (!this.isConnected) {
            vscode.window.showErrorMessage('Cannot send data: not connected to a serial port.');
            return;
        }
        // TODO: Send data through actual serial connection
        console.log(`Sending to serial: ${data}`);
    }

    public dispose() {
        this.disconnect();
        this.statusBarItem.dispose();
        this._onConnectionChanged.dispose();
        this._onDataReceived.dispose();
    }
}
