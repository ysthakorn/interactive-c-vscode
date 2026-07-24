import * as vscode from 'vscode';
import { BoardManager } from '../board/boardManager';
import { IC_FUNCTIONS } from '../language/icFunctions';

export class BoardInfoTreeProvider implements vscode.TreeDataProvider<TreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private boardManager: BoardManager) {
        this.boardManager.onBoardChanged(() => this._onDidChangeTreeData.fire());
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TreeItem): Thenable<TreeItem[]> {
        if (element) {
            return Promise.resolve([]);
        }

        const config = this.boardManager.getBoardConfig();
        const currentBoard = this.boardManager.getCurrentBoard() || 'ax11';

        const items: TreeItem[] = [
            new TreeItem('Target Board', config.hardware || currentBoard, vscode.TreeItemCollapsibleState.None, 'circuit-board'),
            new TreeItem('Communication', config.commtype || 'Handyboard (RS-232)', vscode.TreeItemCollapsibleState.None, 'plug'),
            new TreeItem('Motors Supported', `${config.nummotors || 4} DC Motors`, vscode.TreeItemCollapsibleState.None, 'gear'),
            new TreeItem('Servos Supported', `${config.numservos || 6} R/C Servos`, vscode.TreeItemCollapsibleState.None, 'run-all'),
            new TreeItem('Analog Inputs', `${config.analog?.length || 21} Channels`, vscode.TreeItemCollapsibleState.None, 'symbol-numeric'),
            new TreeItem('Digital Inputs', `${config.digital?.length || 9} Channels`, vscode.TreeItemCollapsibleState.None, 'symbol-boolean')
        ];

        return Promise.resolve(items);
    }
}

export class FunctionsTreeProvider implements vscode.TreeDataProvider<TreeItem> {
    getTreeItem(element: TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TreeItem): Thenable<TreeItem[]> {
        if (!element) {
            // Root categories
            const categories = Array.from(new Set(IC_FUNCTIONS.map(f => f.category)));
            return Promise.resolve(
                categories.map(cat => new TreeItem(cat, '', vscode.TreeItemCollapsibleState.Collapsed, 'symbol-function'))
            );
        } else {
            // Category children
            const categoryFunctions = IC_FUNCTIONS.filter(f => f.category === element.label);
            return Promise.resolve(
                categoryFunctions.map(f => {
                    const item = new TreeItem(f.name, f.signature, vscode.TreeItemCollapsibleState.None, 'symbol-method');
                    item.tooltip = `${f.signature}\n\n${f.description}`;
                    item.command = {
                        command: 'ic.insertText',
                        title: 'Insert Code',
                        arguments: [`${f.name}()`]
                    };
                    return item;
                })
            );
        }
    }
}

export class SensorsMotorsTreeProvider implements vscode.TreeDataProvider<TreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private boardManager: BoardManager) {
        this.boardManager.onBoardChanged(() => this._onDidChangeTreeData.fire());
    }

    getTreeItem(element: TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TreeItem): Thenable<TreeItem[]> {
        if (!element) {
            return Promise.resolve([
                new TreeItem('Motors (0-3)', 'DC Motor Drivers', vscode.TreeItemCollapsibleState.Collapsed, 'gear'),
                new TreeItem('Servos (0-5)', 'R/C Servo Ports', vscode.TreeItemCollapsibleState.Collapsed, 'run-all'),
                new TreeItem('Sensors & Modules', 'INEX & Standard Sensors', vscode.TreeItemCollapsibleState.Collapsed, 'radio-tower')
            ]);
        }

        if (element.label === 'Motors (0-3)') {
            return Promise.resolve([
                new TreeItem('Motor 0', 'fd(0), bk(0), motor(0, speed)', vscode.TreeItemCollapsibleState.None),
                new TreeItem('Motor 1', 'fd(1), bk(1), motor(1, speed)', vscode.TreeItemCollapsibleState.None),
                new TreeItem('Motor 2', 'fd(2), bk(2), motor(2, speed)', vscode.TreeItemCollapsibleState.None),
                new TreeItem('Motor 3', 'fd(3), bk(3), motor(3, speed)', vscode.TreeItemCollapsibleState.None)
            ]);
        }

        if (element.label === 'Servos (0-5)') {
            return Promise.resolve([
                new TreeItem('Servo 0-5 Ports', 'servo(channel, position 0-255)', vscode.TreeItemCollapsibleState.None)
            ]);
        }

        if (element.label === 'Sensors & Modules') {
            return Promise.resolve([
                new TreeItem('Analog Sensors', 'analog(channel 2-31)', vscode.TreeItemCollapsibleState.None),
                new TreeItem('Digital Sensors', 'digital(channel 10-15)', vscode.TreeItemCollapsibleState.None),
                new TreeItem('ZX-21 Encoder', 'zx21_encoder(channel)', vscode.TreeItemCollapsibleState.None),
                new TreeItem('Compass Module', 'compass()', vscode.TreeItemCollapsibleState.None),
                new TreeItem('Ultrasonic Sensor', 'ultrasonic(channel)', vscode.TreeItemCollapsibleState.None),
                new TreeItem('GP2D120 IR Distance', 'gp2d120(channel)', vscode.TreeItemCollapsibleState.None)
            ]);
        }

        return Promise.resolve([]);
    }
}

class TreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly description: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        iconName?: string
    ) {
        super(label, collapsibleState);
        this.description = description;
        if (iconName) {
            this.iconPath = new vscode.ThemeIcon(iconName);
        }
    }
}
