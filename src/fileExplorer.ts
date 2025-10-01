import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class JsonFileItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly filePath: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly isDirectory: boolean = false
    ) {
        super(label, collapsibleState);
        
        if (!isDirectory) {
            this.tooltip = `${this.label} - ${filePath}`;
            this.description = this.getFileSize(filePath);
            this.contextValue = 'jsonFile';
            this.iconPath = new vscode.ThemeIcon('json');
            
            // Add command to open timeline when clicked
            this.command = {
                command: 'claimsTimeline.viewTimelineFromExplorer',
                title: 'View Timeline',
                arguments: [filePath]
            };
        } else {
            this.tooltip = `Folder: ${this.label}`;
            this.contextValue = 'folder';
            this.iconPath = new vscode.ThemeIcon('folder');
        }
    }

    private getFileSize(filePath: string): string {
        try {
            const stats = fs.statSync(filePath);
            const bytes = stats.size;
            
            if (bytes === 0) return '0 B';
            
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            
            return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
        } catch (error) {
            return '';
        }
    }
}

export class JsonFileExplorer implements vscode.TreeDataProvider<JsonFileItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<JsonFileItem | undefined | null | void> = new vscode.EventEmitter<JsonFileItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<JsonFileItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private rootPath: string | undefined;
    private showSubfolders: boolean = true;

    constructor() {
        // Watch for file system changes
        const watcher = vscode.workspace.createFileSystemWatcher('**/*.json');
        watcher.onDidCreate(() => this.refresh());
        watcher.onDidDelete(() => this.refresh());
        watcher.onDidChange(() => this.refresh());
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    setRootPath(rootPath: string): void {
        this.rootPath = rootPath;
        this.refresh();
    }

    toggleSubfolders(): void {
        this.showSubfolders = !this.showSubfolders;
        this.refresh();
    }

    getTreeItem(element: JsonFileItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: JsonFileItem): Thenable<JsonFileItem[]> {
        if (!this.rootPath) {
            return Promise.resolve([]);
        }

        const targetPath = element ? element.filePath : this.rootPath;
        
        return Promise.resolve(this.getJsonFiles(targetPath));
    }

    private getJsonFiles(dirPath: string): JsonFileItem[] {
        try {
            if (!fs.existsSync(dirPath)) {
                return [];
            }

            const items: JsonFileItem[] = [];
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });

            // Sort entries: directories first, then files
            entries.sort((a, b) => {
                if (a.isDirectory() && !b.isDirectory()) return -1;
                if (!a.isDirectory() && b.isDirectory()) return 1;
                return a.name.localeCompare(b.name);
            });

            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);

                if (entry.isDirectory()) {
                    if (this.showSubfolders && this.hasJsonFiles(fullPath)) {
                        items.push(new JsonFileItem(
                            entry.name,
                            fullPath,
                            vscode.TreeItemCollapsibleState.Collapsed,
                            true
                        ));
                    }
                } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
                    // Validate if it's a potential medical claims file
                    const isValidClaimsFile = this.isValidClaimsFile(fullPath);
                    const item = new JsonFileItem(
                        entry.name,
                        fullPath,
                        vscode.TreeItemCollapsibleState.None,
                        false
                    );
                    
                    if (isValidClaimsFile) {
                        item.iconPath = new vscode.ThemeIcon('pulse', new vscode.ThemeColor('charts.green'));
                        item.tooltip += ' (Medical Claims Data)';
                    } else {
                        item.iconPath = new vscode.ThemeIcon('json', new vscode.ThemeColor('charts.yellow'));
                        item.tooltip += ' (JSON File)';
                    }
                    
                    items.push(item);
                }
            }

            return items;
        } catch (error) {
            console.error('Error reading directory:', error);
            return [];
        }
    }

    private hasJsonFiles(dirPath: string): boolean {
        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
                    return true;
                }
                
                if (entry.isDirectory() && this.showSubfolders) {
                    const subPath = path.join(dirPath, entry.name);
                    if (this.hasJsonFiles(subPath)) {
                        return true;
                    }
                }
            }
            
            return false;
        } catch (error) {
            return false;
        }
    }

    private isValidClaimsFile(filePath: string): boolean {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(content);
            
            // Check for medical claims structure
            return !!(
                data.rxTba || 
                data.rxHistory || 
                data.medHistory ||
                data.prescriptions ||
                data.claims ||
                (Array.isArray(data) && data.length > 0 && (
                    data[0].dos || 
                    data[0].medication || 
                    data[0].claimId ||
                    data[0].srvcStart
                ))
            );
        } catch (error) {
            return false;
        }
    }

    getParent(element: JsonFileItem): vscode.ProviderResult<JsonFileItem> {
        // For simplicity, we don't implement parent navigation
        return null;
    }
}

export class JsonFileExplorerProvider {
    private treeDataProvider: JsonFileExplorer;
    private treeView: vscode.TreeView<JsonFileItem>;

    constructor(context: vscode.ExtensionContext) {
        this.treeDataProvider = new JsonFileExplorer();
        
        this.treeView = vscode.window.createTreeView('claimsTimelineExplorer', {
            treeDataProvider: this.treeDataProvider,
            showCollapseAll: true,
            canSelectMany: false
        });

        this.treeView.onDidChangeSelection(e => {
            if (e.selection.length > 0) {
                const item = e.selection[0];
                if (!item.isDirectory) {
                    // File selected, could trigger preview or other actions
                    this.showFilePreview(item);
                }
            }
        });

        // Register commands
        context.subscriptions.push(
            vscode.commands.registerCommand('claimsTimeline.selectFolder', () => this.selectFolder()),
            vscode.commands.registerCommand('claimsTimeline.refreshExplorer', () => this.refresh()),
            vscode.commands.registerCommand('claimsTimeline.toggleSubfolders', () => this.toggleSubfolders()),
            vscode.commands.registerCommand('claimsTimeline.viewTimelineFromExplorer', (filePath: string) => this.viewTimeline(filePath)),
            vscode.commands.registerCommand('claimsTimeline.validateFileFromExplorer', (item: JsonFileItem) => this.validateFile(item)),
            vscode.commands.registerCommand('claimsTimeline.showFileInfo', (item: JsonFileItem) => this.showFileInfo(item))
        );

        context.subscriptions.push(this.treeView);
    }

    private async selectFolder(): Promise<void> {
        const options: vscode.OpenDialogOptions = {
            canSelectMany: false,
            canSelectFiles: false,
            canSelectFolders: true,
            openLabel: 'Select Folder with JSON Files'
        };

        const folderUri = await vscode.window.showOpenDialog(options);
        
        if (folderUri && folderUri[0]) {
            const folderPath = folderUri[0].fsPath;
            this.treeDataProvider.setRootPath(folderPath);
            
            // Update tree view title
            this.treeView.title = `JSON Files - ${path.basename(folderPath)}`;
            
            vscode.window.showInformationMessage(`Loaded JSON files from: ${folderPath}`);
        }
    }

    private refresh(): void {
        this.treeDataProvider.refresh();
    }

    private toggleSubfolders(): void {
        this.treeDataProvider.toggleSubfolders();
        vscode.window.showInformationMessage('Toggled subfolder visibility');
    }

    private async viewTimeline(filePath: string): Promise<void> {
        try {
            // Use the existing timeline viewing logic
            const uri = vscode.Uri.file(filePath);
            await vscode.commands.executeCommand('claimsTimeline.viewTimeline', uri);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to view timeline: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async validateFile(item: JsonFileItem): Promise<void> {
        try {
            const uri = vscode.Uri.file(item.filePath);
            await vscode.commands.executeCommand('claimsTimeline.diagnose', uri);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to validate file: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async showFileInfo(item: JsonFileItem): Promise<void> {
        try {
            const stats = fs.statSync(item.filePath);
            const content = fs.readFileSync(item.filePath, 'utf-8');
            const data = JSON.parse(content);
            
            let claimsInfo = '';
            let totalClaims = 0;
            
            if (data.rxTba && Array.isArray(data.rxTba)) {
                claimsInfo += `rxTba: ${data.rxTba.length} claims\n`;
                totalClaims += data.rxTba.length;
            }
            
            if (data.rxHistory && Array.isArray(data.rxHistory)) {
                claimsInfo += `rxHistory: ${data.rxHistory.length} claims\n`;
                totalClaims += data.rxHistory.length;
            }
            
            if (data.medHistory && data.medHistory.claims && Array.isArray(data.medHistory.claims)) {
                const medClaims = data.medHistory.claims.reduce((total: number, claim: any) => {
                    return total + (claim.lines ? claim.lines.length : 1);
                }, 0);
                claimsInfo += `medHistory: ${medClaims} claims\n`;
                totalClaims += medClaims;
            }

            const info = `File: ${path.basename(item.filePath)}
Path: ${item.filePath}
Size: ${this.formatBytes(stats.size)}
Modified: ${stats.mtime.toLocaleString()}
Total Claims: ${totalClaims}

${claimsInfo || 'No medical claims detected'}`;

            vscode.window.showInformationMessage(info, { modal: true });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to read file info: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private showFilePreview(item: JsonFileItem): void {
        // Show a quick preview in the status bar
        try {
            const stats = fs.statSync(item.filePath);
            const size = this.formatBytes(stats.size);
            vscode.window.setStatusBarMessage(`📄 ${item.label} (${size}) - Click to view timeline`, 3000);
        } catch (error) {
            // Ignore errors for preview
        }
    }

    private formatBytes(bytes: number): string {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
}