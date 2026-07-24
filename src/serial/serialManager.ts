import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface BoardCheckResult {
    status: 'BOARD_FOUND' | 'PORT_OPEN_NO_BOARD' | 'ERROR';
    message: string;
    details?: string;
}

export class SerialManager {
    private currentPort: string | undefined;
    private baudRate: number = 9600;
    private isConnected: boolean = false;
    private boardDetected: boolean = false;
    
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
        if (this.isConnected && this.boardDetected && this.currentPort) {
            this.statusBarItem.text = `$(circuit-board) ${this.currentPort} ⚡ Board Found`;
            this.statusBarItem.tooltip = `Connected and Board Detected on ${this.currentPort} at ${this.baudRate} baud. Click to change.`;
        } else if (this.isConnected && this.currentPort) {
            this.statusBarItem.text = `$(plug) ${this.currentPort} ⚠️ No Board`;
            this.statusBarItem.tooltip = `Port ${this.currentPort} is open, but robot board is OFF or not responding. Click to test again.`;
        } else if (this.currentPort) {
            this.statusBarItem.text = `$(plug) ${this.currentPort}`;
            this.statusBarItem.tooltip = `Port selected: ${this.currentPort} (Disconnected). Click to test and connect.`;
        } else {
            this.statusBarItem.text = `$(plug) Select Port`;
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
                '❌ ไม่พบพอร์ต COM บนเครื่อง (No COM ports found). กรุณาเสียบสาย USB-to-Serial หรือบอร์ดหุ่นยนต์',
                'ลองค้นหาใหม่', 'ระบุพอร์ตเอง'
            );
            if (action === 'ลองค้นหาใหม่') {
                return this.selectPort();
            } else if (action === 'ระบุพอร์ตเอง') {
                const manualPort = await vscode.window.showInputBox({
                    prompt: 'ระบุชื่อพอร์ต (เช่น COM1, COM3, COM4)',
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
            description: p === this.currentPort ? '(พอร์ตปัจจุบัน)' : ''
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'เลือกพอร์ต COM สำหรับเชื่อมต่อบอร์ดหุ่นยนต์',
        });

        if (selected) {
            this.currentPort = selected.label;
            
            const config = vscode.workspace.getConfiguration('ic');
            await config.update('serialPort', this.currentPort, vscode.ConfigurationTarget.Global);
            
            await this.connect();
        }
    }

    /**
     * Performs a 3-way check: Tests COM port open + sends IC ping signal to detect if physical board is ON
     */
    public async checkBoardHardware(port: string, baud: number): Promise<BoardCheckResult> {
        const psScript = `
$p = '${port}';
$b = ${baud};
try {
    $sp = New-Object System.IO.Ports.SerialPort $p, $b;
    $sp.ReadTimeout = 1200;
    $sp.WriteTimeout = 1200;
    $sp.Open();
    if ($sp.IsOpen) {
        # Send carriage return & ESC ping to Interactive C board
        $bytes = [byte[]](0x0D, 0x1B);
        $sp.Write($bytes, 0, 2);
        Start-Sleep -Milliseconds 300;
        if ($sp.BytesToRead -gt 0) {
            $data = $sp.ReadExisting();
            Write-Output ("BOARD_FOUND:" + $data);
        } else {
            Write-Output "PORT_OPEN_NO_BOARD";
        }
        $sp.Close();
    }
} catch {
    Write-Output ("ERROR:" + $_.Exception.Message);
}
`;
        const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
        const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}`;

        try {
            const { stdout } = await execAsync(cmd);
            const output = stdout.trim();

            if (output.includes('BOARD_FOUND')) {
                const details = output.replace('BOARD_FOUND:', '').trim();
                return { status: 'BOARD_FOUND', message: 'พบบอร์ดหุ่นยนต์และตอบรับสัญญาณเรียบร้อย!', details };
            } else if (output.includes('PORT_OPEN_NO_BOARD')) {
                return { status: 'PORT_OPEN_NO_BOARD', message: `เปิดพอร์ต ${port} ได้ แต่ไม่พบสัญญาณตอบรับจากบอร์ด (บอร์ดไม่ได้เปิดสวิตช์ หรือยังไม่เข้า Bootstrap mode)` };
            } else {
                const errMsg = output.replace('ERROR:', '').trim() || 'Port not found or in use.';
                return { status: 'ERROR', message: `ไม่สามารถเปิดพอร์ต ${port} ได้: ${errMsg}` };
            }
        } catch (err: any) {
            return { status: 'ERROR', message: err.message || String(err) };
        }
    }

    /**
     * Connects to port and clearly notifies the user whether the board is found or not
     */
    public async connect(): Promise<void> {
        if (!this.currentPort) {
            await this.selectPort();
            if (!this.currentPort) { return; }
        }

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `กำลังตรวจสอบการเชื่อมต่อบอร์ดที่พอร์ต ${this.currentPort}...`,
                cancellable: false
            },
            async () => {
                const result = await this.checkBoardHardware(this.currentPort!, this.baudRate);

                if (result.status === 'BOARD_FOUND') {
                    this.isConnected = true;
                    this.boardDetected = true;
                    this.updateStatusBar();
                    this._onConnectionChanged.fire(true);

                    vscode.window.showInformationMessage(
                        `✅ พบบอร์ดหุ่นยนต์เรียบร้อย! (Found Robot Board on ${this.currentPort} at ${this.baudRate} baud)`,
                        'เปิด Terminal', 'ทดสอบคอมไพล์'
                    ).then(action => {
                        if (action === 'เปิด Terminal') {
                            vscode.commands.executeCommand('ic.openTerminal');
                        } else if (action === 'ทดสอบคอมไพล์') {
                            vscode.commands.executeCommand('ic.compile');
                        }
                    });

                } else if (result.status === 'PORT_OPEN_NO_BOARD') {
                    this.isConnected = true;
                    this.boardDetected = false;
                    this.updateStatusBar();
                    this._onConnectionChanged.fire(true);

                    const choice = await vscode.window.showWarningMessage(
                        `⚠️ เปิดพอร์ต ${this.currentPort} ได้แล้ว แต่ไม่พบสัญญาณตอบรับจากบอร์ดหุ่นยนต์!\n\n👉 กรุณาเปิดสวิตช์บอร์ด หรือกดปุ่ม STOP ค้างไว้แล้วเปิดสวิตช์เพื่อเข้า Bootstrap mode`,
                        'ลองเช็คอีกครั้ง', 'เปิดคู่มือ Firmware Wizard', 'เลือกพอร์ตอื่น'
                    );

                    if (choice === 'ลองเช็คอีกครั้ง') {
                        this.connect();
                    } else if (choice === 'เปิดคู่มือ Firmware Wizard') {
                        vscode.commands.executeCommand('ic.firmwareWizard');
                    } else if (choice === 'เลือกพอร์ตอื่น') {
                        this.selectPort();
                    }

                } else {
                    this.isConnected = false;
                    this.boardDetected = false;
                    this.updateStatusBar();
                    this._onConnectionChanged.fire(false);

                    const choice = await vscode.window.showErrorMessage(
                        `❌ ไม่พบบอร์ด / เชื่อมต่อล้มเหลว (${this.currentPort}): ${result.message}`,
                        'ลองเชื่อมต่อใหม่', 'เลือกพอร์ตอื่น', 'ค้นหาพอร์ตอัตโนมัติ'
                    );

                    if (choice === 'ลองเชื่อมต่อใหม่') {
                        this.connect();
                    } else if (choice === 'เลือกพอร์ตอื่น' || choice === 'ค้นหาพอร์ตอัตโนมัติ') {
                        this.selectPort();
                    }
                }
            }
        );
    }

    public async disconnect(): Promise<void> {
        if (!this.isConnected) {
            vscode.window.showInformationMessage(`พอร์ต ${this.currentPort || ''} ไม่ได้เชื่อมต่ออยู่แล้ว`);
            return;
        }

        this.isConnected = false;
        this.boardDetected = false;
        this.updateStatusBar();
        this._onConnectionChanged.fire(false);
        vscode.window.showInformationMessage(`ตัดการเชื่อมต่อจากพอร์ต ${this.currentPort} เรียบร้อยแล้ว`);
    }

    public send(data: string): void {
        if (!this.isConnected) {
            vscode.window.showErrorMessage('ไม่สามารถส่งข้อมูลได้: ยังไม่ได้เชื่อมต่อพอร์ต Serial');
            return;
        }
        console.log(`Sending data to ${this.currentPort}: ${data}`);
        this._onDataReceived.fire(`Sent: ${data}\n`);
    }

    public isPortConnected(): boolean {
        return this.isConnected;
    }

    public isBoardDetected(): boolean {
        return this.boardDetected;
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
