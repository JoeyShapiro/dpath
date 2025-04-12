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

  constructor(public readonly filename: string) {
	this._filename = filename;
  }

  refresh(filename: string): void {
    this._filename = filename;
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
      const stack = dpath.XmlTag(this._filename || '', 70000);
	  console.log('stack', stack);
      return Promise.resolve([
        ...stack.map(([label, line]) => new TreeItem(String(label), vscode.TreeItemCollapsibleState.None)),
      ]);
    }
  }
}