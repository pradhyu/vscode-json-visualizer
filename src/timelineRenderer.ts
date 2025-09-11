import * as vscode from 'vscode';
import { TimelineData, ClaimItem } from './types';
import { invalid } from 'moment';
import { start } from 'repl';
import { before } from 'node:test';
import { format } from 'path';
import { invalid } from 'moment';
import { start } from 'repl';
import { before } from 'node:test';
import { format } from 'path';
import { invalid } from 'moment';

/**
 * Message types for communication between extension and webview
 */
export interface WebviewMessage {
    command: 'zoom' | 'pan' | 'select' | 'configure' | 'ready' | 'error';
    payload?: any;
}

/**
 * TimelineRenderer manages webview panels and coordinates timeline display
 */
export class TimelineRenderer {
    private static readonly viewType = 'medicalClaimsTimeline';
    private panel: vscode.WebviewPanel | undefined;
    private context: vscode.ExtensionContext;
    private currentData: TimelineData | undefined;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    /**
     * Create and show timeline webview panel
     */
    public createPanel(data: TimelineData): vscode.WebviewPanel {
        // If panel already exists, reveal it and update data
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.One);
            this.updateData(data);
            return this.panel;
        }

        // Create new webview panel
        this.panel = vscode.window.createWebviewPanel(
            TimelineRenderer.viewType,
            'Medical Claims Timeline',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(this.context.extensionUri, 'webview')
                ]
            }
        );

        // Set webview HTML content
        this.panel.webview.html = this.getWebviewContent();

        // Handle messages from webview
        this.panel.webview.onDidReceiveMessage(
            (message: WebviewMessage) => this.handleMessage(message),
            undefined,
            this.context.subscriptions
        );

        // Handle panel disposal
        this.panel.onDidDispose(
            () => {
                this.panel = undefined;
            },
            null,
            this.context.subscriptions
        );

        // Store current data and send to webview when ready
        this.currentData = data;

        return this.panel;
    }

    /**
     * Update timeline data in existing webview
     */
    public updateData(data: TimelineData): void {
        this.currentData = data;
        
        if (this.panel) {
            this.panel.webview.postMessage({
                command: 'updateData',
                payload: this.serializeTimelineData(data)
            });
        }
    }

    /**
     * Handle messages from webview
     */
    private handleMessage(message: WebviewMessage): void {
        switch (message.command) {
            case 'ready':
                // Webview is ready, send initial data
                if (this.currentData && this.panel) {
                    this.panel.webview.postMessage({
                        command: 'updateData',
                        payload: this.serializeTimelineData(this.currentData)
                    });
                }
                break;

            case 'select':
                // Handle claim selection
                this.handleClaimSelection(message.payload);
                break;

            case 'error':
                // Handle webview errors with detailed information
                this.handleWebviewError(message.payload);
                break;

            case 'zoom':
            case 'pan':
                // These are handled entirely in the webview
                break;

            default:
                console.warn(`Unknown webview message command: ${message.command}`);
        }
    }

    /**
     * Handle claim selection from timeline
     */
    private handleClaimSelection(claimId: string): void {
        if (!this.currentData) {
            return;
        }

        const selectedClaim = this.currentData.claims.find(claim => claim.id === claimId);
        if (selectedClaim) {
            // Show claim details in information message
            const details = this.formatClaimDetails(selectedClaim);
            vscode.window.showInformationMessage(
                `Selected ${selectedClaim.type} claim: ${selectedClaim.displayName}`,
                { modal: false, detail: details }
            );
        }
    }

    /**
     * Handle webview errors with user-friendly messages
     */
    private handleWebviewError(errorPayload: any): void {
        const errorMessage = errorPayload?.message || 'Unknown error occurred in timeline';
        const errorType = errorPayload?.type || 'UNKNOWN';
        const errorDetails = errorPayload?.details;

        console.error('Timeline webview error:', errorPayload);

        let userMessage = `Timeline Error: ${errorMessage}`;
        let actions: string[] = [];
        let detailedMessage = '';

        switch (errorType) {
            case 'RENDER_ERROR':
                userMessage = 'Failed to render timeline chart. This may be due to invalid data or browser compatibility issues.';
                detailedMessage = this.buildRenderErrorDetails(errorDetails);
                actions = ['Retry', 'Reset View', 'Report Issue'];
                break;
            
            case 'DATA_ERROR':
                userMessage = 'Timeline data is invalid or corrupted. Please check your JSON file format.';
                detailedMessage = this.buildDataErrorDetails(errorDetails);
                actions = ['Open Settings', 'View Documentation', 'Retry'];
                break;
            
            case 'ZOOM_ERROR':
                userMessage = 'Error occurred during zoom operation. Timeline may be in an invalid state.';
                detailedMessage = 'Try resetting the view or reloading the timeline to recover from this error.';
                actions = ['Reset View', 'Reload Timeline'];
                break;
            
            case 'SELECTION_ERROR':
                userMessage = 'Error occurred when selecting timeline item. Some claim details may be unavailable.';
                detailedMessage = 'The timeline is still functional, but some claim details may not display correctly.';
                actions = ['Continue'];
                break;
            
            case 'VALIDATION_ERROR':
                userMessage = 'Data validation failed. The JSON structure may not match expected format.';
                detailedMessage = this.buildValidationErrorDetails(errorDetails);
                actions = ['View Documentation', 'Open Settings', 'Retry'];
                break;
            
            case 'DATE_PARSE_ERROR':
                userMessage = 'Date parsing failed. Some dates in your data may be in an unsupported format.';
                detailedMessage = this.buildDateParseErrorDetails(errorDetails);
                actions = ['View Documentation', 'Open Settings', 'Retry'];
                break;
            
            default:
                detailedMessage = 'An unexpected error occurred. Please try again or report this issue if it persists.';
                actions = ['Retry', 'Report Issue'];
        }

        // Show error message with actions and detailed information
        const fullMessage = detailedMessage ? `${userMessage}\n\n${detailedMessage}` : userMessage;
        
        vscode.window.showErrorMessage(fullMessage, ...actions).then(action => {
            this.handleErrorAction(action, errorType, errorDetails);
        });

        // Also update webview to show error state
        if (this.panel) {
            this.panel.webview.postMessage({ 
                command: 'showError', 
                payload: { 
                    message: userMessage,
                    details: detailedMessage,
                    type: errorType,
                    recoveryActions: actions
                } 
            });
        }
    }

    /**
     * Build detailed error message for render errors
     */
    private buildRenderErrorDetails(errorDetails: any): string {
        const details = [];
        
        if (errorDetails?.containerDimensions) {
            details.push(`Container size: ${errorDetails.containerDimensions.width}x${errorDetails.containerDimensions.height}`);
        }
        
        if (errorDetails?.claimCount !== undefined) {
            details.push(`Claims to render: ${errorDetails.claimCount}`);
        }
        
        if (errorDetails?.d3Available === false) {
            details.push('D3.js library is not available - check internet connection');
        }
        
        if (details.length > 0) {
            return `Technical details:\n• ${details.join('\n• ')}`;
        }
        
        return 'Try refreshing the timeline or checking your data format.';
    }

    /**
     * Build detailed error message for data errors
     */
    private buildDataErrorDetails(errorDetails: any): string {
        const details = [];
        
        if (errorDetails?.missingFields?.length > 0) {
            details.push(`Missing required fields: ${errorDetails.missingFields.join(', ')}`);
        }
        
        if (errorDetails?.invalidClaims !== undefined) {
            details.push(`Invalid claims found: ${errorDetails.invalidClaims}`);
        }
        
        if (errorDetails?.totalClaims !== undefined) {
            details.push(`Total claims processed: ${errorDetails.totalClaims}`);
        }
        
        if (details.length > 0) {
            return `Data issues:\n• ${details.join('\n• ')}\n\nEnsure your JSON contains valid rxTba, rxHistory, or medHistory arrays.`;
        }
        
        return 'Verify your JSON file contains medical claims data in the expected format.';
    }

    /**
     * Build detailed error message for validation errors
     */
    private buildValidationErrorDetails(errorDetails: any): string {
        const details = [];
        
        if (errorDetails?.missingFields?.length > 0) {
            details.push(`Missing fields: ${errorDetails.missingFields.join(', ')}`);
        }
        
        if (errorDetails?.suggestions?.length > 0) {
            details.push(`Suggestions:\n  ${errorDetails.suggestions.join('\n  ')}`);
        }
        
        if (details.length > 0) {
            return details.join('\n\n');
        }
        
        return 'Check that your JSON structure matches the expected medical claims format.';
    }

    /**
     * Build detailed error message for date parsing errors
     */
    private buildDateParseErrorDetails(errorDetails: any): string {
        const details = [];
        
        if (errorDetails?.originalValue) {
            details.push(`Problematic date: "${errorDetails.originalValue}"`);
        }
        
        if (errorDetails?.suggestedFormats?.length > 0) {
            details.push(`Supported formats:\n  • ${errorDetails.suggestedFormats.join('\n  • ')}`);
        }
        
        if (errorDetails?.examples) {
            const examples = Object.entries(errorDetails.examples)
                .map(([format, example]) => `${format}: ${example}`)
                .join('\n  • ');
            details.push(`Format examples:\n  • ${examples}`);
        }
        
        if (details.length > 0) {
            return details.join('\n\n');
        }
        
        return 'Ensure all dates are in YYYY-MM-DD format or configure a different format in settings.';
    }

    /**
     * Handle error recovery actions
     */
    private handleErrorAction(action: string | undefined, errorType: string, errorDetails: any): void {
        switch (action) {
            case 'Retry':
                if (this.currentData) {
                    this.updateData(this.currentData);
                } else {
                    // Request fresh data from extension
                    vscode.commands.executeCommand('medicalClaimsTimeline.refresh');
                }
                break;
            
            case 'Reset View':
                if (this.panel) {
                    this.panel.webview.postMessage({ command: 'resetView' });
                }
                break;
                
            case 'Reload Timeline':
                if (this.panel) {
                    this.panel.webview.postMessage({ command: 'reloadTimeline' });
                }
                break;
            
            case 'Open Settings':
                vscode.commands.executeCommand('workbench.action.openSettings', 'medicalClaimsTimeline');
                break;
            
            case 'View Documentation':
                vscode.env.openExternal(vscode.Uri.parse('https://github.com/your-repo/medical-claims-timeline#readme'));
                break;
            
            case 'Report Issue':
                const issueUrl = this.buildIssueUrl(errorType, errorDetails);
                vscode.env.openExternal(vscode.Uri.parse(issueUrl));
                break;
                
            case 'Continue':
                // Just dismiss the error, user can continue working
                break;
        }
    }

    /**
     * Build GitHub issue URL with error details
     */
    private buildIssueUrl(errorType: string, errorDetails: any): string {
        const baseUrl = 'https://github.com/your-repo/medical-claims-timeline/issues/new';
        const title = encodeURIComponent(`Timeline Error: ${errorType}`);
        const body = encodeURIComponent(
            `**Error Type:** ${errorType}\n\n` +
            `**Error Details:**\n\`\`\`json\n${JSON.stringify(errorDetails, null, 2)}\n\`\`\`\n\n` +
            `**Environment:**\n` +
            `- VSCode Version: ${vscode.version}\n` +
            `- Extension Version: ${this.context.extension?.packageJSON?.version || 'unknown'}\n\n` +
            `**Steps to Reproduce:**\n1. \n2. \n3. \n\n` +
            `**Expected Behavior:**\n\n` +
            `**Actual Behavior:**\n`
        );
        
        return `${baseUrl}?title=${title}&body=${body}&labels=bug`;
    }

    /**
     * Format claim details for display
     */
    private formatClaimDetails(claim: ClaimItem): string {
        const lines = [
            `Type: ${claim.type}`,
            `Start Date: ${claim.startDate.toLocaleDateString()}`,
            `End Date: ${claim.endDate.toLocaleDateString()}`,
            `Duration: ${Math.ceil((claim.endDate.getTime() - claim.startDate.getTime()) / (1000 * 60 * 60 * 24))} days`
        ];

        // Add type-specific details
        if (claim.type === 'rxTba' || claim.type === 'rxHistory') {
            if (claim.details.medication) lines.push(`Medication: ${claim.details.medication}`);
            if (claim.details.dosage) lines.push(`Dosage: ${claim.details.dosage}`);
            if (claim.details.dayssupply) lines.push(`Days Supply: ${claim.details.dayssupply}`);
        } else if (claim.type === 'medHistory') {
            if (claim.details.serviceType) lines.push(`Service: ${claim.details.serviceType}`);
            if (claim.details.provider) lines.push(`Provider: ${claim.details.provider}`);
            if (claim.details.amount) lines.push(`Amount: $${claim.details.amount}`);
        }

        return lines.join('\n');
    }

    /**
     * Serialize timeline data for webview (convert dates to strings)
     */
    private serializeTimelineData(data: TimelineData): any {
        return {
            claims: data.claims.map(claim => ({
                ...claim,
                startDate: claim.startDate.toISOString(),
                endDate: claim.endDate.toISOString()
            })),
            dateRange: {
                start: data.dateRange.start.toISOString(),
                end: data.dateRange.end.toISOString()
            },
            metadata: data.metadata
        };
    }

    /**
     * Generate HTML content for webview
     */
    private getWebviewContent(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Medical Claims Timeline</title>
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <style>
        body {
            font-family: var(--vscode-font-family);
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            margin: 0;
            padding: 20px;
            overflow: hidden;
        }

        .timeline-container {
            width: 100%;
            height: calc(100vh - 100px);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            overflow: hidden;
        }

        .timeline-header {
            padding: 10px 15px;
            background-color: var(--vscode-panel-background);
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .timeline-title {
            font-size: 16px;
            font-weight: 600;
            margin: 0;
        }

        .timeline-stats {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }

        .timeline-content {
            height: calc(100% - 50px);
            position: relative;
        }

        .timeline-svg {
            width: 100%;
            height: 100%;
        }

        .legend {
            position: absolute;
            top: 10px;
            right: 10px;
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 12px;
            font-size: 12px;
            min-width: 200px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .legend-title {
            font-weight: 600;
            margin-bottom: 8px;
            color: var(--vscode-editor-foreground);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 4px;
        }

        .legend-item {
            display: flex;
            align-items: center;
            margin-bottom: 6px;
            padding: 2px 4px;
            border-radius: 3px;
            cursor: pointer;
            transition: background-color 0.2s;
        }

        .legend-item:hover {
            background-color: var(--vscode-list-hoverBackground);
        }

        .legend-color {
            width: 14px;
            height: 14px;
            margin-right: 8px;
            border-radius: 3px;
            border: 1px solid var(--vscode-panel-border);
        }

        .legend-label {
            flex: 1;
            font-weight: 500;
        }

        .legend-count {
            color: var(--vscode-descriptionForeground);
            font-size: 11px;
            margin-left: 4px;
        }

        .legend-controls {
            margin-top: 10px;
            padding-top: 8px;
            border-top: 1px solid var(--vscode-panel-border);
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .legend-button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 3px;
            padding: 4px 8px;
            font-size: 11px;
            cursor: pointer;
            transition: background-color 0.2s;
        }

        .legend-button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        .detail-panel {
            position: absolute;
            top: 10px;
            left: 10px;
            width: 300px;
            max-height: 80%;
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 1001;
            overflow: hidden;
        }

        .detail-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            background-color: var(--vscode-panel-background);
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .detail-title {
            margin: 0;
            font-size: 14px;
            font-weight: 600;
            color: var(--vscode-editor-foreground);
        }

        .detail-close {
            background: none;
            border: none;
            font-size: 18px;
            cursor: pointer;
            color: var(--vscode-icon-foreground);
            padding: 0;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 3px;
        }

        .detail-close:hover {
            background-color: var(--vscode-toolbar-hoverBackground);
        }

        .detail-content {
            padding: 16px;
            max-height: 400px;
            overflow-y: auto;
            font-size: 12px;
            line-height: 1.4;
        }

        .detail-section {
            margin-bottom: 16px;
        }

        .detail-section:last-child {
            margin-bottom: 0;
        }

        .detail-section-title {
            font-weight: 600;
            color: var(--vscode-editor-foreground);
            margin-bottom: 8px;
            padding-bottom: 4px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .detail-field {
            display: flex;
            justify-content: space-between;
            margin-bottom: 4px;
        }

        .detail-field-label {
            font-weight: 500;
            color: var(--vscode-editor-foreground);
        }

        .detail-field-value {
            color: var(--vscode-descriptionForeground);
            text-align: right;
            max-width: 60%;
            word-break: break-word;
        }

        .loading {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100%;
            font-size: 14px;
            color: var(--vscode-descriptionForeground);
        }

        .error {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100%;
            font-size: 14px;
            color: var(--vscode-errorForeground);
        }

        /* Timeline specific styles */
        .claim-bar {
            cursor: pointer;
            stroke-width: 1;
            stroke: var(--vscode-panel-border);
        }

        .claim-bar:hover {
            stroke-width: 2;
            stroke: var(--vscode-focusBorder);
        }

        .axis {
            font-size: 11px;
        }

        .axis text {
            fill: var(--vscode-editor-foreground);
        }

        .axis path,
        .axis line {
            stroke: var(--vscode-panel-border);
        }

        .tooltip {
            position: absolute;
            background-color: var(--vscode-hover-background);
            border: 1px solid var(--vscode-hover-border);
            border-radius: 4px;
            padding: 8px;
            font-size: 12px;
            pointer-events: none;
            z-index: 1000;
            max-width: 300px;
        }
    </style>
</head>
<body>
    <div class="timeline-container">
        <div class="timeline-header">
            <h2 class="timeline-title">Medical Claims Timeline</h2>
            <div class="timeline-stats" id="stats">Loading...</div>
        </div>
        <div class="timeline-content">
            <div class="loading" id="loading">Loading timeline data...</div>
            <svg class="timeline-svg" id="timeline" style="display: none;"></svg>
            <div class="legend" id="legend" style="display: none;"></div>
            <div class="detail-panel" id="detail-panel" style="display: none;">
                <div class="detail-header">
                    <h3 class="detail-title">Claim Details</h3>
                    <button class="detail-close" id="detail-close">×</button>
                </div>
                <div class="detail-content" id="detail-content">
                    <!-- Claim details will be populated here -->
                </div>
            </div>
        </div>
    </div>

    <script>
        // Global variables
        let timelineData = null;
        let svg = null;
        let xScale = null;
        let yScale = null;
        let zoom = null;

        // VSCode API
        const vscode = acquireVsCodeApi();

        // Initialize when DOM is loaded
        document.addEventListener('DOMContentLoaded', function() {
            initializeTimeline();
            // Notify extension that webview is ready
            vscode.postMessage({ command: 'ready' });
        });

        // Listen for messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.command) {
                case 'updateData':
                    updateTimelineData(message.payload);
                    break;
                case 'showError':
                    showErrorInWebview(message.payload);
                    break;
                case 'resetView':
                    resetZoom();
                    break;
                case 'reloadTimeline':
                    location.reload();
                    break;
                default:
                    console.warn('Unknown message command:', message.command);
            }
        });

        function initializeTimeline() {
            // Set up SVG and scales
            svg = d3.select('#timeline');
            
            // Initialize zoom behavior with improved settings
            zoom = d3.zoom()
                .scaleExtent([0.1, 20])
                .wheelDelta(function(event) {
                    // Improve zoom sensitivity
                    return -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002);
                })
                .on('zoom', handleZoom);
            
            svg.call(zoom);
            
            // Add keyboard shortcuts
            d3.select('body').on('keydown', function(event) {
                if (!timelineData) return;
                
                switch(event.key) {
                    case '0':
                        if (event.ctrlKey || event.metaKey) {
                            event.preventDefault();
                            resetZoom();
                        }
                        break;
                    case '=':
                    case '+':
                        if (event.ctrlKey || event.metaKey) {
                            event.preventDefault();
                            zoomIn();
                        }
                        break;
                    case '-':
                        if (event.ctrlKey || event.metaKey) {
                            event.preventDefault();
                            zoomOut();
                        }
                        break;
                    case 'f':
                        if (event.ctrlKey || event.metaKey) {
                            event.preventDefault();
                            fitToData();
                        }
                        break;
                }
            });
        }

        function zoomIn() {
            if (svg && zoom) {
                svg.transition()
                    .duration(300)
                    .call(zoom.scaleBy, 1.5);
            }
        }

        function zoomOut() {
            if (svg && zoom) {
                svg.transition()
                    .duration(300)
                    .call(zoom.scaleBy, 1 / 1.5);
            }
        }

        function updateTimelineData(data) {
            try {
                // Validate data structure
                if (!data) {
                    throw new Error('No data provided');
                }

                if (!data.claims || !Array.isArray(data.claims)) {
                    throw new Error('Invalid data structure: claims array is missing or invalid');
                }

                timelineData = data;
                
                // Convert date strings back to Date objects with validation
                timelineData.claims.forEach((claim, index) => {
                    try {
                        if (!claim.startDate || !claim.endDate) {
                            throw new Error(`Claim ${index} is missing date information`);
                        }
                        
                        claim.startDate = new Date(claim.startDate);
                        claim.endDate = new Date(claim.endDate);
                        
                        if (isNaN(claim.startDate.getTime()) || isNaN(claim.endDate.getTime())) {
                            throw new Error(`Claim ${index} has invalid date format`);
                        }
                        
                        if (claim.endDate < claim.startDate) {
                            console.warn(`Claim ${index} has end date before start date, adjusting`);
                            claim.endDate = new Date(claim.startDate.getTime() + 24 * 60 * 60 * 1000); // Add 1 day
                        }
                    } catch (claimError) {
                        console.error(`Error processing claim ${index}:`, claimError);
                        // Remove invalid claim
                        timelineData.claims.splice(index, 1);
                    }
                });

                if (!timelineData.dateRange) {
                    throw new Error('Invalid data structure: dateRange is missing');
                }

                timelineData.dateRange.start = new Date(timelineData.dateRange.start);
                timelineData.dateRange.end = new Date(timelineData.dateRange.end);
                
                if (isNaN(timelineData.dateRange.start.getTime()) || isNaN(timelineData.dateRange.end.getTime())) {
                    throw new Error('Invalid date range format');
                }

                // Check if we have any valid claims left
                if (timelineData.claims.length === 0) {
                    showError('No valid claims found in the data', 'DATA_ERROR');
                    return;
                }
                
                renderTimeline();
                updateStats();
                updateLegend();
                
                // Hide loading, show timeline
                document.getElementById('loading').style.display = 'none';
                document.getElementById('timeline').style.display = 'block';
                document.getElementById('legend').style.display = 'block';
                
            } catch (error) {
                console.error('Error updating timeline data:', error);
                showError('Failed to render timeline: ' + error.message, 'DATA_ERROR', error);
            }
        }

        function showError(message, type = 'UNKNOWN', details = null) {
            console.error('Timeline error:', message, details);
            
            // Hide loading and timeline, show error
            document.getElementById('loading').style.display = 'none';
            document.getElementById('timeline').style.display = 'none';
            document.getElementById('legend').style.display = 'none';
            
            // Create or update error display
            let errorDiv = document.getElementById('error-display');
            if (!errorDiv) {
                errorDiv = document.createElement('div');
                errorDiv.id = 'error-display';
                errorDiv.className = 'error';
                document.querySelector('.timeline-content').appendChild(errorDiv);
            }
            
            // Build error icon based on type
            const errorIcon = getErrorIcon(type);
            const errorColor = getErrorColor(type);
            
            errorDiv.innerHTML = \`
                <div style="text-align: center; padding: 40px; max-width: 600px; margin: 0 auto;">
                    <div style="font-size: 48px; margin-bottom: 20px; color: \${errorColor};">\${errorIcon}</div>
                    <h3 style="margin-bottom: 16px; color: var(--vscode-errorForeground);">Timeline Error</h3>
                    <p style="margin-bottom: 20px; line-height: 1.5;">\${message}</p>
                    \${details ? \`<div style="background: var(--vscode-textBlockQuote-background); border-left: 4px solid var(--vscode-textBlockQuote-border); padding: 12px; margin: 20px 0; text-align: left; font-size: 12px; white-space: pre-line;">\${details}</div>\` : ''}
                    <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 24px;">
                        <button onclick="retryRender()" style="padding: 8px 16px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">
                            🔄 Retry
                        </button>
                        <button onclick="resetView()" style="padding: 8px 16px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">
                            🏠 Reset View
                        </button>
                        <button onclick="reportError('\${type}', '\${message}')" style="padding: 8px 16px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">
                            🐛 Report Issue
                        </button>
                    </div>
                    \${getErrorTips(type)}
                </div>
            \`;
            errorDiv.style.display = 'flex';
            
            // Notify extension of error
            vscode.postMessage({ 
                command: 'error', 
                payload: { 
                    message: message,
                    type: type,
                    details: details
                } 
            });
        }

        function showErrorInWebview(errorPayload) {
            const { message, details, type, recoveryActions } = errorPayload;
            showError(message, type, details);
        }

        function getErrorIcon(type) {
            switch (type) {
                case 'DATA_ERROR':
                case 'VALIDATION_ERROR':
                    return '📋';
                case 'DATE_PARSE_ERROR':
                    return '📅';
                case 'RENDER_ERROR':
                    return '🎨';
                case 'ZOOM_ERROR':
                case 'SELECTION_ERROR':
                    return '🔍';
                default:
                    return '⚠️';
            }
        }

        function getErrorColor(type) {
            switch (type) {
                case 'DATA_ERROR':
                case 'VALIDATION_ERROR':
                    return 'var(--vscode-errorForeground)';
                case 'DATE_PARSE_ERROR':
                    return '#FF9500'; // Orange for date issues
                case 'RENDER_ERROR':
                    return '#FF6B6B'; // Red for render issues
                case 'ZOOM_ERROR':
                case 'SELECTION_ERROR':
                    return '#4ECDC4'; // Teal for interaction issues
                default:
                    return 'var(--vscode-errorForeground)';
            }
        }

        function getErrorTips(type) {
            const tips = {
                'DATA_ERROR': [
                    'Ensure your JSON contains rxTba, rxHistory, or medHistory arrays',
                    'Check that claim objects have required fields (dos, dayssupply, etc.)',
                    'Verify the JSON structure matches the expected format'
                ],
                'VALIDATION_ERROR': [
                    'Review the JSON structure requirements in documentation',
                    'Check for missing required fields in your data',
                    'Ensure arrays contain valid claim objects'
                ],
                'DATE_PARSE_ERROR': [
                    'Use YYYY-MM-DD format for dates (e.g., 2024-01-15)',
                    'Check extension settings to configure different date formats',
                    'Ensure all date fields contain valid date strings'
                ],
                'RENDER_ERROR': [
                    'Try refreshing the timeline view',
                    'Check if your data contains too many claims (>1000)',
                    'Ensure your browser supports modern JavaScript features'
                ],
                'ZOOM_ERROR': [
                    'Reset the view to recover from zoom issues',
                    'Try using keyboard shortcuts: Ctrl+0 to reset zoom'
                ],
                'SELECTION_ERROR': [
                    'Timeline functionality should still work normally',
                    'Try clicking on different claims to see details'
                ]
            };

            const tipList = tips[type] || ['Try refreshing the timeline or checking your data'];
            
            return \`
                <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--vscode-panel-border);">
                    <h4 style="margin: 0 0 12px 0; font-size: 13px; color: var(--vscode-editor-foreground);">💡 Troubleshooting Tips:</h4>
                    <ul style="text-align: left; margin: 0; padding-left: 20px; font-size: 12px; line-height: 1.4; color: var(--vscode-descriptionForeground);">
                        \${tipList.map(tip => \`<li style="margin-bottom: 4px;">\${tip}</li>\`).join('')}
                    </ul>
                </div>
            \`;
        }

        function resetView() {
            vscode.postMessage({ command: 'resetView' });
        }

        function retryRender() {
            const errorDiv = document.getElementById('error-display');
            if (errorDiv) {
                errorDiv.style.display = 'none';
            }
            
            document.getElementById('loading').style.display = 'flex';
            
            // Request fresh data from extension
            vscode.postMessage({ command: 'retry' });
        }

        function reportError(type, message) {
            vscode.postMessage({ 
                command: 'error', 
                payload: { 
                    message: message,
                    type: type,
                    action: 'report'
                } 
            });
        }

        function renderTimeline() {
            try {
                if (!timelineData || !timelineData.claims.length) {
                    showError('No claims data to display', 'DATA_ERROR');
                    return;
                }

                // Validate D3 is available
                if (typeof d3 === 'undefined') {
                    showError('D3.js library failed to load. Please check your internet connection.', 'RENDER_ERROR');
                    return;
                }

                // Validate container dimensions
                const container = document.querySelector('.timeline-content');
                if (!container) {
                    showError('Timeline container not found', 'RENDER_ERROR');
                    return;
                }

                const containerRect = container.getBoundingClientRect();
                if (containerRect.width === 0 || containerRect.height === 0) {
                    showError('Timeline container has invalid dimensions', 'RENDER_ERROR');
                    return;
                }

            // Clear existing content
            svg.selectAll('*').remove();

            // Set up dimensions
            const container = document.querySelector('.timeline-content');
            const width = container.clientWidth;
            const height = container.clientHeight;
            const margin = { top: 20, right: 20, bottom: 40, left: 80 };
            const innerWidth = width - margin.left - margin.right;
            const innerHeight = height - margin.top - margin.bottom;

            // Create main group for zoomable content
            const g = svg.append('g')
                .attr('transform', \`translate(\${margin.left},\${margin.top})\`);

            // Create clipping path for timeline content
            svg.append('defs')
                .append('clipPath')
                .attr('id', 'timeline-clip')
                .append('rect')
                .attr('width', innerWidth)
                .attr('height', innerHeight);

            // Set up scales
            xScale = d3.scaleTime()
                .domain([timelineData.dateRange.start, timelineData.dateRange.end])
                .range([0, innerWidth]);

            // Organize claims into lanes to prevent overlaps
            const claimsByType = organizeClaimsIntoLanes(timelineData.claims);
            const totalLanes = Object.values(claimsByType).reduce((sum, lanes) => sum + lanes.length, 0);
            const laneHeight = Math.max(20, innerHeight / totalLanes);
            
            // Create y-scale for lanes
            const lanePositions = createLanePositions(claimsByType, laneHeight);
            
            // Create axes
            const xAxis = d3.axisBottom(xScale)
                .tickFormat(d3.timeFormat('%Y-%m-%d'))
                .ticks(d3.timeWeek.every(1));
            
            // Create y-axis with claim type labels
            const yAxisScale = d3.scaleBand()
                .domain(['rxTba', 'rxHistory', 'medHistory'])
                .range([0, innerHeight])
                .padding(0.1);
            
            const yAxis = d3.axisLeft(yAxisScale);

            // Add axes
            g.append('g')
                .attr('class', 'axis x-axis')
                .attr('transform', \`translate(0,\${innerHeight})\`)
                .call(xAxis);

            g.append('g')
                .attr('class', 'axis y-axis')
                .call(yAxis);

            // Create zoomable content group
            const zoomGroup = g.append('g')
                .attr('class', 'zoom-group')
                .attr('clip-path', 'url(#timeline-clip)');

            // Render claim bars with lane positioning
            const claimBars = zoomGroup.selectAll('.claim-bar')
                .data(timelineData.claims)
                .enter()
                .append('rect')
                .attr('class', 'claim-bar')
                .attr('x', d => xScale(d.startDate))
                .attr('y', d => lanePositions[d.id] || yAxisScale(d.type))
                .attr('width', d => Math.max(2, xScale(d.endDate) - xScale(d.startDate)))
                .attr('height', laneHeight - 2)
                .attr('fill', d => d.color)
                .attr('rx', 2)
                .attr('ry', 2)
                .style('opacity', 0.8)
                .on('click', handleClaimClick)
                .on('mouseover', handleClaimMouseOver)
                .on('mouseout', handleClaimMouseOut);

            // Add claim labels for wider bars
            zoomGroup.selectAll('.claim-label')
                .data(timelineData.claims.filter(d => xScale(d.endDate) - xScale(d.startDate) > 50))
                .enter()
                .append('text')
                .attr('class', 'claim-label')
                .attr('x', d => xScale(d.startDate) + 4)
                .attr('y', d => (lanePositions[d.id] || yAxisScale(d.type)) + laneHeight / 2)
                .attr('dy', '0.35em')
                .style('font-size', '10px')
                .style('fill', 'white')
                .style('pointer-events', 'none')
                .text(d => d.displayName.length > 15 ? d.displayName.substring(0, 15) + '...' : d.displayName);

            // Update zoom behavior to work with new structure
            zoom.on('zoom', function(event) {
                const { transform } = event;
                
                // Update x-scale with zoom transform
                const newXScale = transform.rescaleX(xScale);
                
                // Update x-axis
                g.select('.x-axis').call(d3.axisBottom(newXScale).tickFormat(d3.timeFormat('%Y-%m-%d')));
                
                // Update claim bars and labels
                zoomGroup.selectAll('.claim-bar')
                    .attr('x', d => newXScale(d.startDate))
                    .attr('width', d => Math.max(2, newXScale(d.endDate) - newXScale(d.startDate)));
                
                zoomGroup.selectAll('.claim-label')
                    .attr('x', d => newXScale(d.startDate) + 4)
                    .style('display', d => newXScale(d.endDate) - newXScale(d.startDate) > 50 ? 'block' : 'none');
            });

            // Apply initial zoom
            svg.call(zoom.transform, d3.zoomIdentity);
        }

        // Helper function to organize claims into non-overlapping lanes
        function organizeClaimsIntoLanes(claims) {
            const claimsByType = {
                rxTba: [],
                rxHistory: [],
                medHistory: []
            };

            // Group claims by type and sort chronologically (most recent first for display)
            claims.forEach(claim => {
                claimsByType[claim.type].push(claim);
            });

            // For each type, organize into lanes to prevent overlaps
            const organizedClaims = {};
            
            Object.keys(claimsByType).forEach(type => {
                // Sort by start date for lane assignment (earliest first for proper lane allocation)
                const typeClaims = claimsByType[type].sort((a, b) => a.startDate - b.startDate);
                const lanes = [];
                
                typeClaims.forEach(claim => {
                    // Find the first lane where this claim fits without overlap
                    let laneIndex = 0;
                    let placed = false;
                    
                    while (laneIndex < lanes.length && !placed) {
                        const lane = lanes[laneIndex];
                        
                        // Check if claim overlaps with any claim in this lane
                        const hasOverlap = lane.some(existingClaim => {
                            return !(claim.endDate <= existingClaim.startDate || 
                                   claim.startDate >= existingClaim.endDate);
                        });
                        
                        if (!hasOverlap) {
                            lane.push(claim);
                            placed = true;
                        } else {
                            laneIndex++;
                        }
                    }
                    
                    // If no suitable lane found, create a new one
                    if (!placed) {
                        lanes.push([claim]);
                    }
                });
                
                // Sort claims within each lane chronologically (most recent first for display)
                lanes.forEach(lane => {
                    lane.sort((a, b) => b.startDate - a.startDate);
                });
                
                organizedClaims[type] = lanes;
            });

            return organizedClaims;
        }

        // Helper function to create lane positions
        function createLanePositions(claimsByType, laneHeight) {
            const positions = {};
            let currentY = 0;
            
            // Position lanes for each claim type
            ['rxTba', 'rxHistory', 'medHistory'].forEach(type => {
                const lanes = claimsByType[type] || [];
                
                lanes.forEach((lane, laneIndex) => {
                    const laneY = currentY + (laneIndex * laneHeight);
                    
                    lane.forEach(claim => {
                        positions[claim.id] = laneY;
                    });
                });
                
                currentY += lanes.length * laneHeight;
                currentY += 10; // Add spacing between claim types
            });
            
            return positions;
        }

        function handleZoom(event) {
            const { transform } = event;
            
            // Update x-scale with zoom transform
            const newXScale = transform.rescaleX(xScale);
            
            // Update x-axis
            svg.select('.x-axis').call(d3.axisBottom(newXScale).tickFormat(d3.timeFormat('%Y-%m-%d')));
            
            // Update claim bars
            svg.selectAll('.claim-bar')
                .attr('x', d => newXScale(d.startDate))
                .attr('width', d => Math.max(2, newXScale(d.endDate) - newXScale(d.startDate)));
        }

        function handleClaimClick(event, d) {
            // Show detail panel
            showDetailPanel(d);
            
            // Also notify extension
            vscode.postMessage({ 
                command: 'select', 
                payload: d.id 
            });
        }

        function showDetailPanel(claim) {
            const panel = document.getElementById('detail-panel');
            const content = document.getElementById('detail-content');
            
            // Calculate duration
            const durationDays = Math.ceil((claim.endDate - claim.startDate) / (1000 * 60 * 60 * 24));
            
            // Build comprehensive detailed content
            let html = \`
                <div class="detail-section">
                    <div class="detail-section-title">Basic Information</div>
                    <div class="detail-field">
                        <span class="detail-field-label">Name:</span>
                        <span class="detail-field-value">\${claim.displayName}</span>
                    </div>
                    <div class="detail-field">
                        <span class="detail-field-label">Type:</span>
                        <span class="detail-field-value" style="color: \${claim.color}; font-weight: bold;">● \${claim.type.toUpperCase()}</span>
                    </div>
                    <div class="detail-field">
                        <span class="detail-field-label">ID:</span>
                        <span class="detail-field-value">\${claim.id}</span>
                    </div>
                    <div class="detail-field">
                        <span class="detail-field-label">Start Date:</span>
                        <span class="detail-field-value">\${claim.startDate.toLocaleDateString()} (\${claim.startDate.toLocaleDateString('en-US', { weekday: 'short' })})</span>
                    </div>
                    <div class="detail-field">
                        <span class="detail-field-label">End Date:</span>
                        <span class="detail-field-value">\${claim.endDate.toLocaleDateString()} (\${claim.endDate.toLocaleDateString('en-US', { weekday: 'short' })})</span>
                    </div>
                    <div class="detail-field">
                        <span class="detail-field-label">Duration:</span>
                        <span class="detail-field-value">\${durationDays} day\${durationDays !== 1 ? 's' : ''}</span>
                    </div>
                </div>
            \`;

            // Add type-specific details
            if (claim.type === 'rxTba' || claim.type === 'rxHistory') {
                html += \`<div class="detail-section">
                    <div class="detail-section-title">Prescription Details</div>\`;
                
                if (claim.details.medication) html += \`<div class="detail-field"><span class="detail-field-label">Medication:</span><span class="detail-field-value">\${claim.details.medication}</span></div>\`;
                if (claim.details.dosage) html += \`<div class="detail-field"><span class="detail-field-label">Dosage:</span><span class="detail-field-value">\${claim.details.dosage}</span></div>\`;
                if (claim.details.quantity) html += \`<div class="detail-field"><span class="detail-field-label">Quantity:</span><span class="detail-field-value">\${claim.details.quantity}</span></div>\`;
                if (claim.details.dayssupply) html += \`<div class="detail-field"><span class="detail-field-label">Days Supply:</span><span class="detail-field-value">\${claim.details.dayssupply}</span></div>\`;
                if (claim.details.prescriber) html += \`<div class="detail-field"><span class="detail-field-label">Prescriber:</span><span class="detail-field-value">\${claim.details.prescriber}</span></div>\`;
                if (claim.details.pharmacy) html += \`<div class="detail-field"><span class="detail-field-label">Pharmacy:</span><span class="detail-field-value">\${claim.details.pharmacy}</span></div>\`;
                if (claim.details.ndc) html += \`<div class="detail-field"><span class="detail-field-label">NDC:</span><span class="detail-field-value">\${claim.details.ndc}</span></div>\`;
                if (claim.details.copay) html += \`<div class="detail-field"><span class="detail-field-label">Copay:</span><span class="detail-field-value">$\${claim.details.copay}</span></div>\`;
                if (claim.details.refillsRemaining) html += \`<div class="detail-field"><span class="detail-field-label">Refills Remaining:</span><span class="detail-field-value">\${claim.details.refillsRemaining}</span></div>\`;
                
                html += \`</div>\`;
            } else if (claim.type === 'medHistory') {
                html += \`<div class="detail-section">
                    <div class="detail-section-title">Medical Service Details</div>\`;
                
                if (claim.details.serviceType) html += \`<div class="detail-field"><span class="detail-field-label">Service Type:</span><span class="detail-field-value">\${claim.details.serviceType}</span></div>\`;
                if (claim.details.procedureCode) html += \`<div class="detail-field"><span class="detail-field-label">Procedure Code:</span><span class="detail-field-value">\${claim.details.procedureCode}</span></div>\`;
                if (claim.details.description) html += \`<div class="detail-field"><span class="detail-field-label">Description:</span><span class="detail-field-value">\${claim.details.description}</span></div>\`;
                if (claim.details.provider) html += \`<div class="detail-field"><span class="detail-field-label">Provider:</span><span class="detail-field-value">\${claim.details.provider}</span></div>\`;
                
                html += \`</div>\`;
                
                // Financial details
                if (claim.details.chargedAmount || claim.details.allowedAmount || claim.details.paidAmount) {
                    html += \`<div class="detail-section">
                        <div class="detail-section-title">Financial Details</div>\`;
                    
                    if (claim.details.chargedAmount) html += \`<div class="detail-field"><span class="detail-field-label">Charged Amount:</span><span class="detail-field-value">$\${claim.details.chargedAmount}</span></div>\`;
                    if (claim.details.allowedAmount) html += \`<div class="detail-field"><span class="detail-field-label">Allowed Amount:</span><span class="detail-field-value">$\${claim.details.allowedAmount}</span></div>\`;
                    if (claim.details.paidAmount) html += \`<div class="detail-field"><span class="detail-field-label">Paid Amount:</span><span class="detail-field-value">$\${claim.details.paidAmount}</span></div>\`;
                    
                    html += \`</div>\`;
                }
                
                // Claim details
                if (claim.details.claimId || claim.details.claimDate) {
                    html += \`<div class="detail-section">
                        <div class="detail-section-title">Claim Information</div>\`;
                    
                    if (claim.details.claimId) html += \`<div class="detail-field"><span class="detail-field-label">Claim ID:</span><span class="detail-field-value">\${claim.details.claimId}</span></div>\`;
                    if (claim.details.claimDate) html += \`<div class="detail-field"><span class="detail-field-label">Claim Date:</span><span class="detail-field-value">\${claim.details.claimDate}</span></div>\`;
                    
                    html += \`</div>\`;
                }
            }

            content.innerHTML = html;
            panel.style.display = 'block';
            
            // Focus the panel for accessibility
            panel.setAttribute('tabindex', '-1');
            panel.focus();
            
            // Enhanced close functionality
            function closeDetailPanel() {
                panel.style.display = 'none';
                panel.removeAttribute('tabindex');
                
                // Remove event listeners
                document.removeEventListener('keydown', handleDetailPanelKeydown);
                document.removeEventListener('click', handleOutsideClick);
            }
            
            // Close button handler
            document.getElementById('detail-close').onclick = closeDetailPanel;
            
            // Keyboard support for detail panel
            function handleDetailPanelKeydown(e) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    closeDetailPanel();
                }
            }
            
            // Close panel when clicking outside
            function handleOutsideClick(e) {
                if (!panel.contains(e.target) && !e.target.closest('.claim-bar')) {
                    closeDetailPanel();
                }
            }
            
            // Add event listeners with a small delay to prevent immediate closure
            setTimeout(() => {
                document.addEventListener('keydown', handleDetailPanelKeydown);
                document.addEventListener('click', handleOutsideClick);
            }, 100);
        }

        function handleClaimMouseOver(event, d) {
            // Remove any existing tooltips first
            d3.selectAll('.tooltip').remove();
            
            // Create tooltip
            const tooltip = d3.select('body')
                .append('div')
                .attr('class', 'tooltip')
                .style('opacity', 0);

            // Build comprehensive tooltip content based on claim type
            let tooltipContent = \`<strong>\${d.displayName}</strong><br/>\`;
            tooltipContent += \`<span style="color: \${d.color}; font-weight: bold;">● \${d.type.toUpperCase()}</span><br/>\`;
            tooltipContent += \`<strong>Duration:</strong> \${d.startDate.toLocaleDateString()} - \${d.endDate.toLocaleDateString()}<br/>\`;
            
            const durationDays = Math.ceil((d.endDate - d.startDate) / (1000 * 60 * 60 * 24));
            tooltipContent += \`<strong>Days:</strong> \${durationDays} day\${durationDays !== 1 ? 's' : ''}<br/>\`;

            // Add type-specific details with better formatting
            if (d.type === 'rxTba' || d.type === 'rxHistory') {
                tooltipContent += \`<hr style="margin: 8px 0; border: 1px solid var(--vscode-panel-border);">\`;
                if (d.details.medication) tooltipContent += \`<strong>Medication:</strong> \${d.details.medication}<br/>\`;
                if (d.details.dosage) tooltipContent += \`<strong>Dosage:</strong> \${d.details.dosage}<br/>\`;
                if (d.details.dayssupply) tooltipContent += \`<strong>Days Supply:</strong> \${d.details.dayssupply}<br/>\`;
                if (d.details.quantity) tooltipContent += \`<strong>Quantity:</strong> \${d.details.quantity}<br/>\`;
                if (d.details.prescriber) tooltipContent += \`<strong>Prescriber:</strong> \${d.details.prescriber}<br/>\`;
                if (d.details.pharmacy) tooltipContent += \`<strong>Pharmacy:</strong> \${d.details.pharmacy}<br/>\`;
                if (d.details.ndc) tooltipContent += \`<strong>NDC:</strong> \${d.details.ndc}<br/>\`;
                if (d.details.copay !== undefined) tooltipContent += \`<strong>Copay:</strong> $\${d.details.copay}<br/>\`;
                if (d.details.refillsRemaining !== undefined) tooltipContent += \`<strong>Refills:</strong> \${d.details.refillsRemaining}<br/>\`;
            } else if (d.type === 'medHistory') {
                tooltipContent += \`<hr style="margin: 8px 0; border: 1px solid var(--vscode-panel-border);">\`;
                if (d.details.serviceType) tooltipContent += \`<strong>Service:</strong> \${d.details.serviceType}<br/>\`;
                if (d.details.procedureCode) tooltipContent += \`<strong>Procedure:</strong> \${d.details.procedureCode}<br/>\`;
                if (d.details.description) tooltipContent += \`<strong>Description:</strong> \${d.details.description}<br/>\`;
                if (d.details.provider) tooltipContent += \`<strong>Provider:</strong> \${d.details.provider}<br/>\`;
                if (d.details.chargedAmount !== undefined) tooltipContent += \`<strong>Charged:</strong> $\${d.details.chargedAmount}<br/>\`;
                if (d.details.allowedAmount !== undefined) tooltipContent += \`<strong>Allowed:</strong> $\${d.details.allowedAmount}<br/>\`;
                if (d.details.paidAmount !== undefined) tooltipContent += \`<strong>Paid:</strong> $\${d.details.paidAmount}<br/>\`;
                if (d.details.claimId) tooltipContent += \`<strong>Claim ID:</strong> \${d.details.claimId}<br/>\`;
            }

            tooltipContent += \`<hr style="margin: 8px 0; border: 1px solid var(--vscode-panel-border);">\`;
            tooltipContent += \`<em style="color: var(--vscode-descriptionForeground);">Click for detailed view</em>\`;

            // Position tooltip intelligently to avoid going off-screen
            const tooltipNode = tooltip.node();
            tooltip.html(tooltipContent);
            
            // Get tooltip dimensions after content is set
            const tooltipRect = tooltipNode.getBoundingClientRect();
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            
            let left = event.pageX + 15;
            let top = event.pageY - 10;
            
            // Adjust horizontal position if tooltip would go off-screen
            if (left + tooltipRect.width > windowWidth) {
                left = event.pageX - tooltipRect.width - 15;
            }
            
            // Adjust vertical position if tooltip would go off-screen
            if (top + tooltipRect.height > windowHeight) {
                top = event.pageY - tooltipRect.height - 10;
            }
            
            // Ensure tooltip doesn't go above the top of the screen
            if (top < 0) {
                top = 10;
            }

            tooltip
                .style('left', left + 'px')
                .style('top', top + 'px')
                .transition()
                .duration(200)
                .style('opacity', 1);

            // Highlight the hovered claim with enhanced visual feedback
            d3.select(event.target)
                .style('stroke-width', 3)
                .style('stroke', 'var(--vscode-focusBorder)')
                .style('opacity', 1)
                .style('filter', 'brightness(1.1)');
        }

        function handleClaimMouseOut(event) {
            // Remove tooltip with a slight delay to prevent flickering
            setTimeout(() => {
                d3.selectAll('.tooltip').remove();
            }, 100);
            
            // Reset claim highlighting and visual effects
            d3.select(event.target)
                .style('stroke-width', 1)
                .style('stroke', 'var(--vscode-panel-border)')
                .style('opacity', 0.8)
                .style('filter', null);
        }

        function updateStats() {
            if (!timelineData) return;
            
            const stats = document.getElementById('stats');
            
            // Calculate date range for display
            const dateRange = \`\${timelineData.dateRange.start.toLocaleDateString()} - \${timelineData.dateRange.end.toLocaleDateString()}\`;
            
            // Show comprehensive stats
            stats.innerHTML = \`
                <strong>\${timelineData.metadata.totalClaims}</strong> claims | 
                <strong>\${timelineData.metadata.claimTypes.length}</strong> types | 
                <span style="color: var(--vscode-descriptionForeground);">\${dateRange}</span> |
                <em>Sorted chronologically (most recent first)</em>
            \`;
        }

        function updateLegend() {
            if (!timelineData) return;
            
            const legend = document.getElementById('legend');
            
            // Count claims by type
            const claimCounts = timelineData.claims.reduce((counts, claim) => {
                counts[claim.type] = (counts[claim.type] || 0) + 1;
                return counts;
            }, {});
            
            // Get colors from first claim of each type (since colors come from data)
            const colors = {};
            timelineData.claims.forEach(claim => {
                if (!colors[claim.type]) {
                    colors[claim.type] = claim.color;
                }
            });
            
            // Create legend with type names, colors, and counts
            const typeLabels = {
                'rxTba': 'Prescription Claims (TBA)',
                'rxHistory': 'Prescription History',
                'medHistory': 'Medical Claims'
            };
            
            const legendItems = timelineData.metadata.claimTypes.map(type => \`
                <div class="legend-item" data-type="\${type}">
                    <div class="legend-color" style="background-color: \${colors[type] || '#999'}"></div>
                    <span class="legend-label">\${typeLabels[type] || type}</span>
                    <span class="legend-count">(\${claimCounts[type] || 0})</span>
                </div>
            \`).join('');
            
            legend.innerHTML = \`
                <div class="legend-title">Claim Types</div>
                \${legendItems}
                <div class="legend-controls">
                    <button id="reset-zoom" class="legend-button">Reset Zoom</button>
                    <button id="fit-to-data" class="legend-button">Fit to Data</button>
                </div>
            \`;
            
            // Add event listeners for legend controls
            document.getElementById('reset-zoom')?.addEventListener('click', resetZoom);
            document.getElementById('fit-to-data')?.addEventListener('click', fitToData);
            
            // Add click handlers for legend items to highlight claim types
            legend.querySelectorAll('.legend-item').forEach(item => {
                item.addEventListener('click', function() {
                    const type = this.getAttribute('data-type');
                    highlightClaimType(type);
                });
            });
        }

        function resetZoom() {
            if (svg && zoom) {
                svg.transition()
                    .duration(750)
                    .call(zoom.transform, d3.zoomIdentity);
            }
        }

        function fitToData() {
            if (!timelineData || !svg || !xScale) return;
            
            const container = document.querySelector('.timeline-content');
            const width = container.clientWidth;
            const margin = { left: 80, right: 20 };
            const innerWidth = width - margin.left - margin.right;
            
            // Calculate scale to fit all data with some padding
            const dataWidth = xScale(timelineData.dateRange.end) - xScale(timelineData.dateRange.start);
            const scale = Math.min(1, innerWidth * 0.9 / dataWidth);
            
            svg.transition()
                .duration(750)
                .call(zoom.transform, d3.zoomIdentity.scale(scale));
        }

        function highlightClaimType(type) {
            // Reset all claims to normal opacity
            svg.selectAll('.claim-bar')
                .style('opacity', 0.3);
            
            // Highlight selected type
            svg.selectAll('.claim-bar')
                .filter(d => d.type === type)
                .style('opacity', 1);
            
            // Reset after 2 seconds
            setTimeout(() => {
                svg.selectAll('.claim-bar')
                    .style('opacity', 0.8);
            }, 2000);
        }

        function showError(message) {
            document.getElementById('loading').style.display = 'none';
            document.getElementById('timeline').style.display = 'none';
            document.getElementById('legend').style.display = 'none';
            
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error';
            errorDiv.textContent = message;
            
            const content = document.querySelector('.timeline-content');
            content.appendChild(errorDiv);
        }
    </script>
</body>
</html>`;
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        if (this.panel) {
            this.panel.dispose();
        }
    }
}