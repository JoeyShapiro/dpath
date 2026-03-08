import * as vscode from 'vscode';
import * as dpath from './dpath';

export class TreeItem extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly children?: TreeItem[]
	) {
		super(label, collapsibleState);

		const line = parseInt(label.split(':')[0].trim());
		this.command = {
			command: 'dpath.jump',
			title: 'Jump to Line',
			arguments: [line],
		};
	}
}

export class TreeDataProvider implements vscode.TreeDataProvider<TreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | null | void> = new vscode.EventEmitter<TreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
	private _filename: string | undefined;
	private _filetype: string | undefined;
	private _line: number | undefined;
	private _column: number | undefined;
	private _tab_size: number = 4;
	public bufferSize: number = 1024;

	constructor(public readonly filename: string | undefined,
				public readonly filetype: string | undefined,
				public readonly line: number | undefined, 
				public readonly column: number | undefined,
				public readonly tab_size: number = 4) {
		this._filename = filename;
		this._filetype = filetype;
		this._line = line;
		this._column = column;
		this._tab_size = tab_size;
	}

	refresh(filename: string | undefined, filetype: string | undefined, line: number | undefined, column: number | undefined, tab_size: number = 4): void {
		if (this._filename === filename && this._line === line) return;

		this._filename = filename;
		this._filetype = filetype;
		this._line = line;
		this._column = column;
		this._tab_size = tab_size;
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: TreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: TreeItem): Thenable<TreeItem[]> {
		if (element) {
			return Promise.resolve(element.children || []);
		} else {
			// Root elements
			try {
				const stack = dpath.DeepPath(this._filename || '', this._filetype || '', this._line || 0, this._column || 0, this._tab_size, this.bufferSize*1024);
				return Promise.resolve([
					...stack.map(([label, line]) => new TreeItem(`${line}: ${label}`, vscode.TreeItemCollapsibleState.None)),
				]);
			} catch (error) {
				return Promise.resolve([
					new TreeItem(`Error: ${error}`, vscode.TreeItemCollapsibleState.None),
				]);
			}

		}
	}
}