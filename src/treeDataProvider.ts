import * as vscode from 'vscode';
import * as dpath from './dpath';

export class TreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly children?: TreeItem[]
  ) {
    super(label, collapsibleState);
  }
}

export class TreeDataProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | null | void> = new vscode.EventEmitter<TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
  private _filename: string | undefined;
  private _line: number | undefined;

  constructor(public readonly filename: string | undefined, public readonly line: number | undefined) {
	this._filename = filename;
	this._line = line;
  }

  refresh(filename: string | undefined, line: number | undefined): void {
	if (this._filename === filename && this._line === line) return;

    this._filename = filename;
    this._line = line;
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
      const stack = dpath.XmlTag(this._filename || '', this._line || 0);
      return Promise.resolve([
        ...stack.map(([label, line]) => new TreeItem(`${label} (${line})`, vscode.TreeItemCollapsibleState.None)),
      ]);
    }
  }
}