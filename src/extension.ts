import * as vscode from 'vscode';
import { TimelineRenderer } from './timelineRenderer';
import { ClaimsParser } from './claimsParser';
import { ConfigManager } from './configManager';
import { ParseError, ValidationError, FileReadError, DateParseError, StructureValidationError, ErrorHandler } from './types';

export function activate(context: vscode.ExtensionContext) {
    console.log('Medical Claims Timeline Viewer extension is now active');

    // Create instances
    const configManager = new ConfigManager();
    const timelineRenderer = new TimelineRenderer(context);

    // Register the view timeline command
    const disposable = vscode.commands.registerCommand('medicalClaimsTimeline.viewTimeline', async (uri?: vscode.Uri) => {
        try {
            // Get the file URI - either from parameter or active editor
            const fileUri = uri || vscode.window.activeTextEditor?.document.uri;
            
            if (!fileUri) {
                vscode.window.showErrorMessage('No JSON file selected. Please open a JSON file or right-click on one in the explorer.');
                return;
            }

            if (!fileUri.fsPath.endsWith('.json')) {
                vscode.window.showErrorMessage('Please select a JSON file. The Medical Claims Timeline Viewer only supports JSON files.');
                return;
            }

            // Show progress while processing
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Loading Medical Claims Timeline',
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: 'Reading JSON file...' });

                // Get current configuration
                const config = configManager.getParserConfig();
                const claimsParser = new ClaimsParser(config);

                try {
                    // First, validate that the file contains medical claims data
                    progress.report({ increment: 20, message: 'Detecting file format...' });
                    
                    const isValidMedicalClaimsFile = await detectMedicalClaimsFormat(fileUri.fsPath, claimsParser);
                    
                    if (!isValidMedicalClaimsFile) {
                        const message = 'This JSON file does not appear to contain medical claims data. ' +
                                      'Expected structure: rxTba, rxHistory, or medHistory arrays with claim data.';
                        
                        const action = await vscode.window.showWarningMessage(
                            message,
                            'View Sample Files',
                            'Learn More'
                        );
                        
                        if (action === 'View Sample Files') {
                            await vscode.commands.executeCommand('vscode.openFolder', 
                                vscode.Uri.file(context.extensionPath + '/samples'));
                        } else if (action === 'Learn More') {
                            await vscode.env.openExternal(vscode.Uri.parse('https://github.com/your-repo/medical-claims-timeline-viewer#supported-formats'));
                        }
                        return;
                    }

                    progress.report({ increment: 40, message: 'Parsing claims data...' });
                    
                    // Parse the file
                    const timelineData = await claimsParser.parseFile(fileUri.fsPath);
                    
                    if (timelineData.claims.length === 0) {
                        vscode.window.showWarningMessage(
                            'No medical claims found in this file. Please check that the JSON structure matches the expected format.'
                        );
                        return;
                    }
                    
                    progress.report({ increment: 80, message: 'Creating timeline...' });
                    
                    // Create and show timeline
                    timelineRenderer.createPanel(timelineData);
                    
                    progress.report({ increment: 100, message: 'Timeline ready!' });
                    
                    // Show success message with claim count
                    const claimCount = timelineData.metadata.totalClaims;
                    const claimTypes = timelineData.metadata.claimTypes.join(', ');
                    vscode.window.showInformationMessage(
                        `Timeline created successfully! Found ${claimCount} claims (${claimTypes}).`
                    );

                } catch (error) {
                    handleParsingError(error);
                }
            });

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            vscode.window.showErrorMessage(`Failed to open timeline: ${errorMessage}`);
        }
    });

    context.subscriptions.push(disposable);
    context.subscriptions.push(timelineRenderer);
}

/**
 * Detect if a JSON file contains medical claims data
 * @param filePath Path to the JSON file
 * @param parser ClaimsParser instance to use for validation
 * @returns Promise<boolean> indicating if file contains medical claims
 */
async function detectMedicalClaimsFormat(filePath: string, parser: ClaimsParser): Promise<boolean> {
    try {
        // Read and parse the JSON file
        const fs = require('fs');
        const fileContent = await fs.promises.readFile(filePath, 'utf-8');
        const jsonData = JSON.parse(fileContent);

        // Use the parser's validation method
        return parser.validateStructure(jsonData);

    } catch (error) {
        // If we can't read or parse the file, it's not a valid medical claims file
        return false;
    }
}

/**
 * Handle parsing errors with comprehensive user-friendly messages and recovery options
 * @param error The error that occurred during parsing
 */
function handleParsingError(error: any): void {
    console.error('Parsing error occurred:', error);

    // Get user-friendly message and recovery suggestions
    const userMessage = ErrorHandler.getUserFriendlyMessage(error);
    const suggestions = ErrorHandler.getRecoverySuggestions(error);

    if (error instanceof StructureValidationError) {
        // Show detailed structure validation error with suggestions
        const actions = ['View Sample Files', 'Open Settings', 'Show Details'];
        
        vscode.window.showErrorMessage(
            'Invalid JSON Structure',
            ...actions
        ).then(selection => {
            switch (selection) {
                case 'Show Details':
                    showDetailedErrorMessage(userMessage, suggestions);
                    break;
                case 'View Sample Files':
                    vscode.commands.executeCommand('vscode.openFolder', 
                        vscode.Uri.joinPath(vscode.extensions.getExtension('your-publisher.medical-claims-timeline')?.extensionUri || vscode.Uri.file(''), 'samples'));
                    break;
                case 'Open Settings':
                    vscode.commands.executeCommand('workbench.action.openSettings', 'medicalClaimsTimeline');
                    break;
            }
        });
        
    } else if (error instanceof DateParseError) {
        // Show date parsing error with format suggestions
        const actions = ['Open Settings', 'Show Examples', 'Show Details'];
        
        vscode.window.showErrorMessage(
            'Date Format Error',
            ...actions
        ).then(selection => {
            switch (selection) {
                case 'Show Details':
                    showDetailedErrorMessage(userMessage, suggestions);
                    break;
                case 'Show Examples':
                    showDateFormatExamples(error.details?.examples);
                    break;
                case 'Open Settings':
                    vscode.commands.executeCommand('workbench.action.openSettings', 'medicalClaimsTimeline.dateFormat');
                    break;
            }
        });
        
    } else if (error instanceof FileReadError) {
        // Show file access error
        const actions = ['Retry', 'Show Details'];
        
        vscode.window.showErrorMessage(
            'File Access Error',
            ...actions
        ).then(selection => {
            switch (selection) {
                case 'Show Details':
                    showDetailedErrorMessage(userMessage, suggestions);
                    break;
                case 'Retry':
                    vscode.commands.executeCommand('medicalClaimsTimeline.viewTimeline');
                    break;
            }
        });
        
    } else if (error instanceof ValidationError) {
        // Show general validation error
        const actions = ['Show Details', 'View Documentation'];
        
        vscode.window.showErrorMessage(
            'Validation Error',
            ...actions
        ).then(selection => {
            switch (selection) {
                case 'Show Details':
                    showDetailedErrorMessage(userMessage, suggestions);
                    break;
                case 'View Documentation':
                    vscode.env.openExternal(vscode.Uri.parse('https://github.com/your-repo/medical-claims-timeline#supported-formats'));
                    break;
            }
        });
        
    } else if (error instanceof ParseError) {
        // Show general parsing error
        const actions = ['Show Details', 'Report Issue'];
        
        vscode.window.showErrorMessage(
            'Parsing Error',
            ...actions
        ).then(selection => {
            switch (selection) {
                case 'Show Details':
                    showDetailedErrorMessage(userMessage, suggestions);
                    break;
                case 'Report Issue':
                    vscode.env.openExternal(vscode.Uri.parse('https://github.com/your-repo/medical-claims-timeline/issues'));
                    break;
            }
        });
        
    } else {
        // Generic error handling with fallback
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        const actions = ['Retry', 'Report Issue'];
        
        vscode.window.showErrorMessage(
            `Unexpected Error: ${errorMessage}`,
            ...actions
        ).then(selection => {
            switch (selection) {
                case 'Retry':
                    vscode.commands.executeCommand('medicalClaimsTimeline.viewTimeline');
                    break;
                case 'Report Issue':
                    vscode.env.openExternal(vscode.Uri.parse('https://github.com/your-repo/medical-claims-timeline/issues'));
                    break;
            }
        });
    }
}

/**
 * Show detailed error message with recovery suggestions
 */
function showDetailedErrorMessage(message: string, suggestions: string[]): void {
    const fullMessage = suggestions.length > 0 
        ? `${message}\n\nSuggestions:\n${suggestions.map(s => `• ${s}`).join('\n')}`
        : message;
    
    vscode.window.showInformationMessage(fullMessage, { modal: true });
}

/**
 * Show date format examples to help users
 */
function showDateFormatExamples(examples?: Record<string, string>): void {
    const defaultExamples = {
        'YYYY-MM-DD': '2024-03-15',
        'MM/DD/YYYY': '03/15/2024',
        'DD-MM-YYYY': '15-03-2024',
        'YYYY/MM/DD': '2024/03/15',
        'DD/MM/YYYY': '15/03/2024',
        'MM-DD-YYYY': '03-15-2024'
    };
    
    const exampleList = examples || defaultExamples;
    const exampleText = Object.entries(exampleList)
        .map(([format, example]) => `${format}: ${example}`)
        .join('\n');
    
    const message = `Supported date formats:\n\n${exampleText}\n\nYou can configure your preferred format in the extension settings.`;
    
    vscode.window.showInformationMessage(message, { modal: true }, 'Open Settings').then(selection => {
        if (selection === 'Open Settings') {
            vscode.commands.executeCommand('workbench.action.openSettings', 'medicalClaimsTimeline.dateFormat');
        }
    });
}

export function deactivate() {
    // Cleanup when extension is deactivated
}