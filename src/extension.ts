import * as vscode from 'vscode';
import { DiagnosticTest } from './diagnosticTest';
import { HybridParser } from './hybridParser';
import { TimelineRenderer } from './timelineRenderer';

export function activate(context: vscode.ExtensionContext) {
    console.log('Simple Medical Claims Timeline extension activated');

    // Register comprehensive diagnostic command
    const diagnosticDisposable = vscode.commands.registerCommand('claimsTimeline.diagnose', async (uri?: vscode.Uri) => {
        console.log('=== DIAGNOSTIC COMMAND: Starting comprehensive diagnostic ===');

        const fileUri = uri || vscode.window.activeTextEditor?.document.uri;

        if (!fileUri) {
            vscode.window.showErrorMessage('No JSON file selected for diagnosis');
            return;
        }

        try {
            console.log('DIAGNOSTIC: Running comprehensive diagnostic test on:', fileUri.fsPath);

            // Run the comprehensive diagnostic test
            const result = await DiagnosticTest.runDiagnostic(fileUri.fsPath);

            console.log('DIAGNOSTIC: Comprehensive test completed');
            console.log('DIAGNOSTIC: Results:', result);

            // Format results for display
            const summary = [
                `File: ${result.filePath}`,
                `File Exists: ${result.fileExists}`,
                '',
                'Parser Results:',
                `• Simple Parser: ${result.simpleParserResult?.success ? '✓ SUCCESS' : '✗ FAILED'}`,
                `• Complex Parser: ${result.complexParserResult?.success ? '✓ SUCCESS' : '✗ FAILED'}`,
                `• Flexible Parser: ${result.flexibleParserResult?.success ? '✓ SUCCESS' : '✗ FAILED'}`,
                '',
                'Data Structure Differences:',
                ...result.dataStructureDifferences.map(diff =>
                    `• ${diff.field}: ${diff.parser1}≠${diff.parser2} (${diff.impact})`
                ),
                '',
                'Recommendations:',
                ...result.recommendations.map(rec => `• ${rec}`)
            ].join('\n');

            // Show results in a new document
            const doc = await vscode.workspace.openTextDocument({
                content: summary,
                language: 'plaintext'
            });

            await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);

            vscode.window.showInformationMessage(
                `Diagnostic complete. ${result.dataStructureDifferences.length} differences found.`,
                'View Details'
            ).then(selection => {
                if (selection === 'View Details') {
                    vscode.commands.executeCommand('workbench.action.output.toggleOutput');
                }
            });

        } catch (error) {
            console.error('DIAGNOSTIC: Error during comprehensive diagnosis:', error);
            vscode.window.showErrorMessage(`Diagnostic Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    });

    const disposable = vscode.commands.registerCommand('claimsTimeline.viewTimeline', async (uri?: vscode.Uri) => {
        console.log('=== HYBRID PARSER: claimsTimeline.viewTimeline command started ===');
        console.log('Command triggered with URI:', uri?.fsPath || 'no URI provided');

        const fileUri = uri || vscode.window.activeTextEditor?.document.uri;
        console.log('Resolved file URI:', fileUri?.fsPath || 'no file URI available');

        if (!fileUri) {
            console.log('HYBRID PARSER: No JSON file selected - showing error message');
            vscode.window.showErrorMessage('No JSON file selected');
            return;
        }

        try {
            console.log('HYBRID PARSER: Starting hybrid parsing approach for:', fileUri.fsPath);

            // Use hybrid parser for robust parsing with fallback
            const hybridParser = new HybridParser();
            const timelineData = await hybridParser.parseFile(fileUri.fsPath);

            console.log(`HYBRID PARSER: Parsing successful with ${timelineData.claims.length} claims`);
            console.log('HYBRID PARSER: Date range:', {
                start: timelineData.dateRange.start.toISOString(),
                end: timelineData.dateRange.end.toISOString()
            });

            // Determine which parsing strategy was used
            const strategy = await hybridParser.getParsingStrategy(fileUri.fsPath);
            console.log(`HYBRID PARSER: Used parsing strategy: ${strategy}`);

            if (strategy === 'simple') {
                vscode.window.showInformationMessage(
                    'Timeline created using fallback parsing. Some advanced features may be limited.',
                    'OK'
                );
            }

            if (timelineData.claims.length === 0) {
                console.log('HYBRID PARSER: No claims found - showing warning message');
                vscode.window.showWarningMessage('No claims found in the JSON file');
                return;
            }

            console.log('HYBRID PARSER: Creating timeline renderer');

            // Use TimelineRenderer for advanced webview management
            const renderer = new TimelineRenderer(context);
            await renderer.createTimeline(timelineData);

            console.log('HYBRID PARSER: Timeline renderer created successfully');

        } catch (error) {
            console.error('HYBRID PARSER: Error occurred in claimsTimeline.viewTimeline command:', error);
            console.error('HYBRID PARSER: Error details:', {
                message: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : 'No stack trace',
                type: typeof error,
                fileUri: fileUri?.fsPath
            });

            // Show user-friendly error message
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Timeline Error: ${errorMessage}`, 'Show Details').then(selection => {
                if (selection === 'Show Details') {
                    vscode.commands.executeCommand('workbench.action.output.toggleOutput');
                }
            });
        }

        console.log('=== HYBRID PARSER: claimsTimeline.viewTimeline command completed ===');
    });

    // Register test parsing command
    const testParsingDisposable = vscode.commands.registerCommand('claimsTimeline.testParsing', async (uri?: vscode.Uri) => {
        console.log('=== TEST PARSING COMMAND: Starting parsing test ===');

        const fileUri = uri || vscode.window.activeTextEditor?.document.uri;

        if (!fileUri) {
            vscode.window.showErrorMessage('No JSON file selected for parsing test');
            return;
        }

        try {
            console.log('TEST PARSING: Testing parsing capabilities on:', fileUri.fsPath);

            // Test hybrid parser parsing strategies
            const hybridParser = new HybridParser();

            // Get which strategy would be used
            const strategy = await hybridParser.getParsingStrategy(fileUri.fsPath);
            console.log(`TEST PARSING: Optimal parsing strategy: ${strategy}`);

            // Attempt to parse with hybrid parser
            const timelineData = await hybridParser.parseFile(fileUri.fsPath);

            console.log('TEST PARSING: Parsing successful');
            console.log(`TEST PARSING: Claims found: ${timelineData.claims.length}`);
            console.log('TEST PARSING: Date range:', {
                start: timelineData.dateRange.start.toISOString(),
                end: timelineData.dateRange.end.toISOString()
            });

            // Format results for display
            const summary = [
                `Parsing Test Results for: ${fileUri.fsPath}`,
                '',
                `✓ Parsing Strategy: ${strategy.toUpperCase()}`,
                `✓ Claims Found: ${timelineData.claims.length}`,
                `✓ Date Range: ${timelineData.dateRange.start.toLocaleDateString()} - ${timelineData.dateRange.end.toLocaleDateString()}`,
                `✓ Claim Types: ${timelineData.metadata.claimTypes.join(', ')}`,
                '',
                'Sample Claims:',
                ...timelineData.claims.slice(0, 3).map((claim, index) =>
                    `${index + 1}. ${claim.displayName} (${claim.startDate.toLocaleDateString()} - ${claim.endDate.toLocaleDateString()})`
                ),
                timelineData.claims.length > 3 ? `... and ${timelineData.claims.length - 3} more claims` : '',
                '',
                'Status: ✅ PARSING SUCCESSFUL'
            ].filter(line => line !== '').join('\n');

            // Show results in a new document
            const doc = await vscode.workspace.openTextDocument({
                content: summary,
                language: 'plaintext'
            });

            await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);

            vscode.window.showInformationMessage(
                `Parsing test successful! Found ${timelineData.claims.length} claims using ${strategy} strategy.`,
                'View Timeline'
            ).then(selection => {
                if (selection === 'View Timeline') {
                    vscode.commands.executeCommand('claimsTimeline.viewTimeline', fileUri);
                }
            });

        } catch (error) {
            console.error('TEST PARSING: Error during parsing test:', error);

            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const summary = [
                `Parsing Test Results for: ${fileUri.fsPath}`,
                '',
                '❌ PARSING FAILED',
                '',
                `Error: ${errorMessage}`,
                '',
                'Troubleshooting:',
                '• Check that the file contains valid JSON',
                '• Ensure the file has an "rxTba" array with medication data',
                '• Verify date fields are in a valid format',
                '• Run full diagnostic for detailed analysis',
                '',
                'Status: ❌ PARSING FAILED'
            ].join('\n');

            // Show error results in a new document
            const doc = await vscode.workspace.openTextDocument({
                content: summary,
                language: 'plaintext'
            });

            await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);

            vscode.window.showErrorMessage(
                `Parsing test failed: ${errorMessage}`,
                'Run Full Diagnostic'
            ).then(selection => {
                if (selection === 'Run Full Diagnostic') {
                    vscode.commands.executeCommand('claimsTimeline.diagnose', fileUri);
                }
            });
        }

        console.log('=== TEST PARSING COMMAND: Completed ===');
    });

    // Register debug info command
    const debugInfoDisposable = vscode.commands.registerCommand('claimsTimeline.showDebugInfo', async (uri?: vscode.Uri) => {
        console.log('=== DEBUG INFO COMMAND: Starting debug info collection ===');

        const fileUri = uri || vscode.window.activeTextEditor?.document.uri;

        try {
            // Collect system information
            const systemInfo = {
                platform: process.platform,
                nodeVersion: process.version,
                vsCodeVersion: vscode.version,
                extensionVersion: vscode.extensions.getExtension('your-extension-id')?.packageJSON?.version || 'unknown',
                workspaceFolder: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || 'none',
                activeFile: fileUri?.fsPath || 'none'
            };

            console.log('DEBUG INFO: System information collected:', systemInfo);

            // Collect file information if available
            let fileInfo = {};
            if (fileUri) {
                try {
                    const stat = await vscode.workspace.fs.stat(fileUri);
                    const content = await vscode.workspace.fs.readFile(fileUri);
                    const contentStr = Buffer.from(content).toString('utf8');

                    let jsonData = null;
                    let jsonValid = false;
                    try {
                        jsonData = JSON.parse(contentStr);
                        jsonValid = true;
                    } catch {
                        jsonValid = false;
                    }

                    fileInfo = {
                        path: fileUri.fsPath,
                        size: stat.size,
                        modified: new Date(stat.mtime).toISOString(),
                        jsonValid,
                        topLevelKeys: jsonValid && jsonData ? Object.keys(jsonData) : [],
                        rxTbaCount: jsonValid && jsonData?.rxTba ? jsonData.rxTba.length : 'N/A',
                        rxHistoryCount: jsonValid && jsonData?.rxHistory ? jsonData.rxHistory.length : 'N/A',
                        medHistoryCount: jsonValid && jsonData?.medHistory ? jsonData.medHistory.length : 'N/A'
                    };

                    console.log('DEBUG INFO: File information collected:', fileInfo);
                } catch (error) {
                    fileInfo = {
                        path: fileUri.fsPath,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    };
                }
            }

            // Collect extension configuration
            const config = vscode.workspace.getConfiguration('claimsTimeline');
            const configInfo = {
                enableDiagnosticLogging: config.get('enableDiagnosticLogging', false),
                defaultDateFormat: config.get('defaultDateFormat', 'YYYY-MM-DD'),
                customColors: config.get('customColors', {}),
                parserTimeout: config.get('parserTimeout', 30000)
            };

            console.log('DEBUG INFO: Configuration collected:', configInfo);

            // Format debug information
            const debugInfo = [
                'Medical Claims Timeline Extension - Debug Information',
                '='.repeat(60),
                '',
                'System Information:',
                `• Platform: ${systemInfo.platform}`,
                `• Node.js Version: ${systemInfo.nodeVersion}`,
                `• VS Code Version: ${systemInfo.vsCodeVersion}`,
                `• Extension Version: ${systemInfo.extensionVersion}`,
                `• Workspace: ${systemInfo.workspaceFolder}`,
                `• Active File: ${systemInfo.activeFile}`,
                '',
                'File Information:',
                ...(fileUri ? [
                    `• Path: ${(fileInfo as any).path || 'N/A'}`,
                    `• Size: ${(fileInfo as any).size || 'N/A'} bytes`,
                    `• Modified: ${(fileInfo as any).modified || 'N/A'}`,
                    `• Valid JSON: ${(fileInfo as any).jsonValid ? '✓' : '✗'}`,
                    `• Top-level Keys: ${(fileInfo as any).topLevelKeys?.join(', ') || 'N/A'}`,
                    `• rxTba Items: ${(fileInfo as any).rxTbaCount}`,
                    `• rxHistory Items: ${(fileInfo as any).rxHistoryCount}`,
                    `• medHistory Items: ${(fileInfo as any).medHistoryCount}`,
                    ...(((fileInfo as any).error) ? [`• Error: ${(fileInfo as any).error}`] : [])
                ] : ['• No file selected']),
                '',
                'Extension Configuration:',
                `• Diagnostic Logging: ${configInfo.enableDiagnosticLogging ? 'Enabled' : 'Disabled'}`,
                `• Default Date Format: ${configInfo.defaultDateFormat}`,
                `• Custom Colors: ${Object.keys(configInfo.customColors).length > 0 ? 'Configured' : 'None'}`,
                `• Parser Timeout: ${configInfo.parserTimeout}ms`,
                '',
                'Available Commands:',
                '• claimsTimeline.viewTimeline - Create timeline visualization',
                '• claimsTimeline.diagnose - Run comprehensive diagnostic',
                '• claimsTimeline.testParsing - Test parsing capabilities only',
                '• claimsTimeline.showDebugInfo - Show this debug information',
                '',
                'Troubleshooting Tips:',
                '• Enable diagnostic logging in settings for detailed console output',
                '• Use "Test Parsing" command to verify file compatibility',
                '• Use "Diagnose" command for comprehensive analysis',
                '• Check VS Code Developer Console (Help > Toggle Developer Tools)',
                '',
                `Generated: ${new Date().toISOString()}`
            ].join('\n');

            // Show debug info in a new document
            const doc = await vscode.workspace.openTextDocument({
                content: debugInfo,
                language: 'plaintext'
            });

            await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);

            vscode.window.showInformationMessage(
                'Debug information collected and displayed.',
                'Copy to Clipboard'
            ).then(selection => {
                if (selection === 'Copy to Clipboard') {
                    vscode.env.clipboard.writeText(debugInfo);
                    vscode.window.showInformationMessage('Debug information copied to clipboard');
                }
            });

        } catch (error) {
            console.error('DEBUG INFO: Error collecting debug information:', error);
            vscode.window.showErrorMessage(`Debug info error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        console.log('=== DEBUG INFO COMMAND: Completed ===');
    });

    context.subscriptions.push(disposable);
    context.subscriptions.push(diagnosticDisposable);
    context.subscriptions.push(testParsingDisposable);
    context.subscriptions.push(debugInfoDisposable);
}



export function deactivate() { }