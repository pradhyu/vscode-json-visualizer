import * as vscode from 'vscode';
import { TimelineData, ClaimItem } from './types';

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
     * Create timeline with data (main entry point)
     */
    public async createTimeline(data: TimelineData): Promise<void> {
        console.log('=== HYBRID PARSER: TimelineRenderer.createTimeline started ===');
        this.createPanel(data);
    }

    /**
     * Create and show timeline webview panel
     */
    public createPanel(data: TimelineData): vscode.WebviewPanel | null {
        console.log('=== DIAGNOSTIC: TimelineRenderer.createPanel started ===');
        
        // If panel already exists, reveal it and update data
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.One);
            this.updateData(data);
            return this.panel;
        }
        
        try {
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

            // Handle null panel creation
            if (!this.panel) {
                console.error('Failed to create webview panel');
                return null;
            }
            
            // Set webview HTML content
            this.panel.webview.html = this.getWebviewContent();
            
            // Handle messages from webview
            this.panel.webview.onDidReceiveMessage(
                (message: WebviewMessage) => {
                    this.handleMessage(message);
                },
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
            
            // Store current data and send to webview
            this.currentData = data;
            
            // Send data immediately without waiting for ready message
            setTimeout(() => {
                if (this.panel && this.currentData) {
                    try {
                        const serializedData = this.serializeTimelineData(this.currentData);
                        this.panel.webview.postMessage({
                            command: 'updateData',
                            payload: serializedData
                        });
                    } catch (error) {
                        console.error('Error sending data to webview:', error);
                    }
                }
            }, 50);

            return this.panel;
        } catch (error) {
            console.error('Error creating webview panel:', error);
            return null;
        }
    }

    /**
     * Update timeline data in existing webview
     */
    public updateData(data: TimelineData): void {
        this.currentData = data;

        if (this.panel) {
            try {
                const serializedData = this.serializeTimelineData(data);
                this.panel.webview.postMessage({
                    command: 'updateData',
                    payload: serializedData
                });
            } catch (error) {
                console.error('Error updating webview data:', error);
            }
        } else if (data) {
            this.createPanel(data);
        }
    }

    /**
     * Handle messages from webview
     */
    private handleMessage(message: WebviewMessage): void {
        try {
            // Handle null or malformed messages
            if (!message || typeof message !== 'object') {
                console.warn('Received invalid message:', message);
                return;
            }

            switch (message.command) {
                case 'ready':
                    if (this.currentData && this.panel) {
                        const serializedData = this.serializeTimelineData(this.currentData);
                        this.panel.webview.postMessage({
                            command: 'updateData',
                            payload: serializedData
                        });
                    }
                    break;

                case 'select':
                    this.handleClaimSelection(message.payload);
                    break;

                case 'error':
                    this.handleWebviewError(message.payload);
                    break;

                default:
                    console.warn('Unknown message command:', message.command);
                    break;
            }
        } catch (error) {
            console.error('Error handling webview message:', error);
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
            const details = this.formatClaimDetails(selectedClaim);
            vscode.window.showInformationMessage(
                'Selected ' + selectedClaim.type + ' claim: ' + selectedClaim.displayName,
                { modal: false, detail: details }
            );
        } else {
            vscode.window.showWarningMessage(
                'Selected claim not found: ' + claimId
            );
        }
    }

    /**
     * Handle error messages from webview
     */
    private handleWebviewError(errorPayload: any): void {
        console.error('Webview error:', errorPayload);
        
        const message = errorPayload?.message || 'Unknown webview error';
        vscode.window.showErrorMessage(
            'Timeline Error: ' + message,
            'Retry',
            'Report Issue'
        );
    }

    /**
     * Format claim details for display
     */
    private formatClaimDetails(claim: ClaimItem): string {
        const startDate = claim.startDate;
        const endDate = claim.endDate;
        
        const lines = [
            'Type: ' + claim.type,
            'Start Date: ' + startDate.toLocaleDateString(),
            'End Date: ' + endDate.toLocaleDateString(),
            'Duration: ' + Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + ' days'
        ];

        // Add type-specific details
        if (claim.type === 'rxTba' || claim.type === 'rxHistory') {
            if (claim.details.medication) lines.push('Medication: ' + claim.details.medication);
            if (claim.details.dosage) lines.push('Dosage: ' + claim.details.dosage);
            if (claim.details.dayssupply) lines.push('Days Supply: ' + claim.details.dayssupply);
        } else if (claim.type === 'medHistory') {
            if (claim.details.serviceType) lines.push('Service: ' + claim.details.serviceType);
            if (claim.details.provider) lines.push('Provider: ' + claim.details.provider);
            if (claim.details.amount) lines.push('Amount: $' + claim.details.amount);
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
     * Generate HTML content for webview with interactive features
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
            display: flex;
            flex-direction: column;
        }
        .timeline-header {
            padding: 10px 15px;
            background-color: var(--vscode-panel-background);
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-shrink: 0;
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
        .timeline-controls {
            padding: 10px 15px;
            background-color: var(--vscode-sideBar-background);
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-shrink: 0;
        }
        .control-group {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .control-button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 3px;
            padding: 6px 12px;
            font-size: 12px;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        .control-button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .control-button:disabled {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            cursor: not-allowed;
        }
        
        .zoom-info {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            padding: 6px 8px;
            background-color: var(--vscode-badge-background);
            border-radius: 3px;
            min-width: 40px;
            text-align: center;
            user-select: none;
        }
        .legend-container {
            display: flex;
            gap: 15px;
            align-items: center;
        }
        .legend-item {
            display: flex;
            align-items: center;
            gap: 6px;
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 3px;
            transition: background-color 0.2s;
        }
        .legend-item:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .legend-item.hidden {
            opacity: 0.5;
        }
        .legend-item.hidden .legend-text {
            text-decoration: line-through;
        }
        .legend-color {
            width: 12px;
            height: 12px;
            border-radius: 2px;
            border: 1px solid var(--vscode-panel-border);
        }
        .legend-text {
            font-size: 12px;
            user-select: none;
        }
        .legend-count {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            margin-left: 4px;
        }
        .timeline-content {
            flex: 1;
            position: relative;
            overflow: hidden;
        }
        .timeline-svg {
            width: 100%;
            height: 100%;
            cursor: grab;
        }
        
        .timeline-svg:active {
            cursor: grabbing;
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
        .empty-state {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 100%;
            font-size: 14px;
            color: var(--vscode-descriptionForeground);
        }
        .empty-state-icon {
            font-size: 48px;
            margin-bottom: 16px;
            opacity: 0.5;
        }
        .claim-bar {
            cursor: pointer;
            stroke-width: 1;
            stroke: var(--vscode-panel-border);
            transition: all 0.2s ease;
        }
        .claim-bar:hover {
            stroke-width: 2;
            stroke: var(--vscode-focusBorder);
        }
        .claim-bar.hidden {
            opacity: 0;
            pointer-events: none;
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
            line-height: 1.4;
        }
        
        /* Table View Styles */
        .view-toggle {
            display: flex;
            gap: 5px;
            margin-left: 15px;
        }
        .view-toggle-button {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            border-radius: 3px;
            padding: 6px 12px;
            font-size: 12px;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        .view-toggle-button.active {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .view-toggle-button:hover:not(.active) {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .table-view {
            display: none;
            flex-direction: column;
            height: 100%;
            overflow: hidden;
        }
        .table-view.active {
            display: flex;
        }
        
        .table-controls {
            padding: 10px;
            background-color: var(--vscode-sideBar-background);
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            gap: 10px;
            align-items: center;
            flex-wrap: wrap;
        }
        
        .search-box {
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 3px;
            padding: 6px 10px;
            font-size: 12px;
            min-width: 200px;
            flex: 1;
            max-width: 300px;
        }
        .search-box:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }
        
        .export-button {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            border-radius: 3px;
            padding: 6px 12px;
            font-size: 12px;
            cursor: pointer;
        }
        .export-button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .table-container {
            flex: 1;
            overflow: auto;
            background-color: var(--vscode-editor-background);
        }
        
        .claims-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
        }
        
        .claims-table th {
            background-color: var(--vscode-panel-background);
            color: var(--vscode-editor-foreground);
            padding: 8px 12px;
            text-align: left;
            border-bottom: 2px solid var(--vscode-panel-border);
            position: sticky;
            top: 0;
            cursor: pointer;
            user-select: none;
            white-space: nowrap;
        }
        
        .claims-table th:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        
        .claims-table th.sortable::after {
            content: ' ↕';
            opacity: 0.5;
            margin-left: 4px;
        }
        
        .claims-table th.sorted-asc::after {
            content: ' ↑';
            opacity: 1;
        }
        
        .claims-table th.sorted-desc::after {
            content: ' ↓';
            opacity: 1;
        }
        
        .claims-table td {
            padding: 8px 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
            vertical-align: top;
        }
        
        .claims-table tr:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        
        .claims-table tr.selected {
            background-color: var(--vscode-list-activeSelectionBackground);
            color: var(--vscode-list-activeSelectionForeground);
        }
        
        .claim-type-badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 10px;
            font-weight: 500;
            color: white;
            text-transform: uppercase;
        }
        
        .pagination {
            padding: 10px;
            background-color: var(--vscode-panel-background);
            border-top: 1px solid var(--vscode-panel-border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 12px;
        }
        
        .pagination-controls {
            display: flex;
            gap: 5px;
            align-items: center;
        }
        
        .pagination-button {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            border-radius: 3px;
            padding: 4px 8px;
            font-size: 11px;
            cursor: pointer;
        }
        
        .pagination-button:hover:not(:disabled) {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .pagination-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .zoom-hint {
            position: absolute;
            bottom: 10px;
            left: 50%;
            transform: translateX(-50%);
            background-color: var(--vscode-notifications-background);
            border: 1px solid var(--vscode-notifications-border);
            border-radius: 4px;
            padding: 8px 12px;
            z-index: 100;
            opacity: 0.9;
            animation: fadeInOut 4s ease-in-out;
        }
        
        @keyframes fadeInOut {
            0%, 100% { opacity: 0; }
            20%, 80% { opacity: 0.9; }
        }
    </style>
</head>
<body>
    <div class="timeline-container">
        <div class="timeline-header">
            <h2 class="timeline-title">Medical Claims Timeline</h2>
            <div id="stats" class="timeline-stats">Loading...</div>
        </div>
        <div class="timeline-controls">
            <div class="control-group">
                <div class="view-toggle">
                    <button id="timelineViewBtn" class="view-toggle-button active" title="Timeline View">📊 Timeline</button>
                    <button id="tableViewBtn" class="view-toggle-button" title="Table View">📋 Table</button>
                </div>
                <button id="zoomIn" class="control-button" title="Zoom In (+)">🔍+</button>
                <button id="zoomOut" class="control-button" title="Zoom Out (-)">🔍-</button>
                <button id="resetZoom" class="control-button" title="Reset View (0)">⌂</button>
                <button id="panLeft" class="control-button" title="Pan Left (Shift+←)">←</button>
                <button id="panRight" class="control-button" title="Pan Right (Shift+→)">→</button>
                <div class="zoom-info" id="zoomInfo" title="Current zoom level">100%</div>
            </div>
            <div id="legend" class="legend-container">
                <!-- Legend items will be populated dynamically -->
            </div>
        </div>
        <div class="timeline-content">
            <div id="loading" class="loading">Loading timeline data...</div>
            <div id="emptyState" class="empty-state" style="display: none;">
                <div class="empty-state-icon">📊</div>
                <div>No claims visible</div>
                <div style="font-size: 12px; margin-top: 8px;">Enable claim types in the legend above</div>
            </div>
            <div id="zoomHint" class="zoom-hint" style="display: none;">
                <div style="font-size: 11px; color: var(--vscode-descriptionForeground); text-align: center; padding: 5px;">
                    💡 <strong>Mouse:</strong> Scroll to zoom, drag to pan, double-click to fit | <strong>Keys:</strong> +/- to zoom, 0 to reset, Shift+arrows to pan
                </div>
            </div>
            <svg id="timeline" class="timeline-svg" style="display: none;"></svg>
            
            <!-- Table View -->
            <div id="tableView" class="table-view">
                <div class="table-controls">
                    <input type="text" id="searchBox" class="search-box" placeholder="Search claims..." />
                    <button id="exportCsv" class="export-button" title="Export as CSV">📄 CSV</button>
                    <button id="exportJson" class="export-button" title="Export as JSON">📄 JSON</button>
                    <span id="tableStats" style="margin-left: auto; color: var(--vscode-descriptionForeground);"></span>
                </div>
                <div class="table-container">
                    <table id="claimsTable" class="claims-table">
                        <thead>
                            <tr>
                                <th data-column="id" class="sortable">ID</th>
                                <th data-column="type" class="sortable">Type</th>
                                <th data-column="displayName" class="sortable">Name</th>
                                <th data-column="startDate" class="sortable">Start Date</th>
                                <th data-column="endDate" class="sortable">End Date</th>
                                <th data-column="duration" class="sortable">Duration</th>
                                <th data-column="details" class="">Details</th>
                            </tr>
                        </thead>
                        <tbody id="claimsTableBody">
                            <!-- Table rows will be populated dynamically -->
                        </tbody>
                    </table>
                </div>
                <div id="pagination" class="pagination" style="display: none;">
                    <div id="paginationInfo"></div>
                    <div class="pagination-controls">
                        <button id="firstPage" class="pagination-button">⏮</button>
                        <button id="prevPage" class="pagination-button">◀</button>
                        <span id="pageInfo"></span>
                        <button id="nextPage" class="pagination-button">▶</button>
                        <button id="lastPage" class="pagination-button">⏭</button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let timelineData = null;
        let svg = null;
        let xScale = null;
        let yScale = null;
        let zoom = null;
        let currentTransform = d3.zoomIdentity;
        
        // Interactive state
        let visibleClaimTypes = new Set();
        let claimTypeConfigs = new Map();
        
        // Table view state
        let currentView = 'timeline';
        let tableState = {
            sortColumn: 'startDate',
            sortDirection: 'desc',
            searchQuery: '',
            currentPage: 1,
            pageSize: 50
        };
        let filteredClaims = [];
        
        // Initialize when DOM is ready
        document.addEventListener('DOMContentLoaded', function() {
            console.log('WEBVIEW DIAGNOSTIC: DOM loaded, initializing timeline');
            initializeTimeline();
            initializeControls();
        });

        // Listen for messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            console.log('WEBVIEW DIAGNOSTIC: Received message:', message);
            
            switch (message.command) {
                case 'updateData':
                    updateTimelineData(message.payload);
                    break;
                case 'showError':
                    showErrorInWebview(message.payload);
                    break;
                default:
                    console.warn('WEBVIEW DIAGNOSTIC: Unknown message command:', message.command);
            }
        });

        function initializeTimeline() {
            console.log('WEBVIEW DIAGNOSTIC: Initializing timeline');
            
            try {
                svg = d3.select('#timeline');
                
                if (svg.empty()) {
                    throw new Error('Timeline SVG element not found');
                }

                // Initialize enhanced zoom behavior with mouse controls
                zoom = d3.zoom()
                    .scaleExtent([0.1, 10])
                    .wheelDelta(function(event) {
                        // Custom wheel delta for smoother zooming
                        return -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002);
                    })
                    .on('zoom', handleZoom)
                    .on('start', handleZoomStart)
                    .on('end', handleZoomEnd);

                svg.call(zoom)
                    .on('dblclick.zoom', handleDoubleClick); // Custom double-click behavior

                console.log('WEBVIEW DIAGNOSTIC: SVG element found and zoom initialized');

                vscode.postMessage({
                    command: 'ready',
                    payload: { status: 'initialized' }
                });

                console.log('WEBVIEW DIAGNOSTIC: Ready message sent to extension');

            } catch (error) {
                console.error('WEBVIEW DIAGNOSTIC: Error initializing timeline:', error);
                vscode.postMessage({
                    command: 'error',
                    payload: {
                        type: 'INITIALIZATION_ERROR',
                        message: 'Failed to initialize timeline',
                        details: { error: error.message }
                    }
                });
            }
        }

        function initializeControls() {
            // View toggle controls
            document.getElementById('timelineViewBtn').addEventListener('click', () => switchView('timeline'));
            document.getElementById('tableViewBtn').addEventListener('click', () => switchView('table'));
            
            // Zoom controls
            document.getElementById('zoomIn').addEventListener('click', () => {
                svg.transition().duration(300).call(zoom.scaleBy, 1.5);
            });

            document.getElementById('zoomOut').addEventListener('click', () => {
                svg.transition().duration(300).call(zoom.scaleBy, 1 / 1.5);
            });

            document.getElementById('resetZoom').addEventListener('click', () => {
                svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
            });

            // Pan controls
            document.getElementById('panLeft').addEventListener('click', () => {
                const width = svg.node().clientWidth;
                svg.transition().duration(300).call(zoom.translateBy, width * 0.2, 0);
            });

            document.getElementById('panRight').addEventListener('click', () => {
                const width = svg.node().clientWidth;
                svg.transition().duration(300).call(zoom.translateBy, -width * 0.2, 0);
            });
            
            // Table controls
            document.getElementById('searchBox').addEventListener('input', (e) => {
                tableState.searchQuery = e.target.value;
                tableState.currentPage = 1;
                renderTable();
            });
            
            document.getElementById('exportCsv').addEventListener('click', () => exportData('csv'));
            document.getElementById('exportJson').addEventListener('click', () => exportData('json'));
            
            // Table sorting
            document.querySelectorAll('.claims-table th.sortable').forEach(th => {
                th.addEventListener('click', () => {
                    const column = th.getAttribute('data-column');
                    handleSort(column);
                });
            });
            
            // Pagination controls
            document.getElementById('firstPage').addEventListener('click', () => goToPage(1));
            document.getElementById('prevPage').addEventListener('click', () => goToPage(tableState.currentPage - 1));
            document.getElementById('nextPage').addEventListener('click', () => goToPage(tableState.currentPage + 1));
            document.getElementById('lastPage').addEventListener('click', () => {
                const totalPages = Math.ceil(filteredClaims.length / tableState.pageSize);
                goToPage(totalPages);
            });
            
            // Keyboard shortcuts for zoom and pan
            document.addEventListener('keydown', handleKeyboardShortcuts);
        }

        function handleKeyboardShortcuts(event) {
            // Only handle shortcuts when timeline is visible and not typing in inputs
            if (currentView !== 'timeline' || event.target.tagName === 'INPUT') return;
            
            switch(event.key) {
                case '+':
                case '=':
                    event.preventDefault();
                    svg.transition().duration(200).call(zoom.scaleBy, 1.2);
                    break;
                case '-':
                    event.preventDefault();
                    svg.transition().duration(200).call(zoom.scaleBy, 1 / 1.2);
                    break;
                case '0':
                    event.preventDefault();
                    svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity);
                    break;
                case 'ArrowLeft':
                    if (event.shiftKey) {
                        event.preventDefault();
                        const width = svg.node().clientWidth;
                        svg.transition().duration(200).call(zoom.translateBy, width * 0.1, 0);
                    }
                    break;
                case 'ArrowRight':
                    if (event.shiftKey) {
                        event.preventDefault();
                        const width = svg.node().clientWidth;
                        svg.transition().duration(200).call(zoom.translateBy, -width * 0.1, 0);
                    }
                    break;
            }
        }

        function handleZoom(event) {
            currentTransform = event.transform;
            
            if (xScale) {
                const newXScale = currentTransform.rescaleX(xScale);
                
                // Update timeline elements with smooth transitions
                svg.selectAll('.claim-bar')
                    .attr('x', d => newXScale(new Date(d.startDate)))
                    .attr('width', d => Math.max(1, newXScale(new Date(d.endDate)) - newXScale(new Date(d.startDate))));
                
                // Update x-axis with YYYY-MM-DD format
                const tickCount = Math.max(3, Math.min(15, Math.floor(currentTransform.k * 8)));
                const xAxis = d3.axisBottom(newXScale)
                    .ticks(tickCount)
                    .tickFormat(d3.timeFormat('%Y-%m-%d'));
                
                svg.select('.x-axis')
                    .call(xAxis);
                
                // Update zoom level indicator
                updateZoomIndicator(currentTransform.k);
            }
        }

        function handleZoomStart(event) {
            // Add visual feedback when zooming starts
            svg.style('cursor', event.sourceEvent?.type === 'wheel' ? 'zoom-in' : 'grabbing');
        }

        function handleZoomEnd(event) {
            // Reset cursor when zooming ends
            svg.style('cursor', 'grab');
            
            // Snap to reasonable zoom levels if close
            const k = event.transform.k;
            if (Math.abs(k - 1) < 0.1) {
                svg.transition().duration(200).call(zoom.scaleTo, 1);
            }
        }

        function handleDoubleClick(event) {
            // Double-click to zoom to fit or reset
            event.preventDefault();
            
            if (currentTransform.k === 1) {
                // If at default zoom, zoom in to 2x
                svg.transition().duration(300).call(zoom.scaleTo, 2);
            } else {
                // If zoomed, reset to fit
                svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity);
            }
        }

        function updateZoomIndicator(zoomLevel) {
            // Update zoom level display in controls
            let zoomText = '';
            if (zoomLevel < 0.5) {
                zoomText = 'Zoomed Out';
            } else if (zoomLevel > 2) {
                zoomText = 'Zoomed In';
            } else {
                zoomText = 'Normal';
            }
            
            // Update zoom percentage display
            const zoomInfo = document.getElementById('zoomInfo');
            if (zoomInfo) {
                zoomInfo.textContent = \`\${Math.round(zoomLevel * 100)}%\`;
                zoomInfo.title = \`Current zoom level: \${Math.round(zoomLevel * 100)}% (\${zoomText})\`;
            }
            
            // Update button titles with current zoom level
            const zoomInBtn = document.getElementById('zoomIn');
            const zoomOutBtn = document.getElementById('zoomOut');
            const resetBtn = document.getElementById('resetZoom');
            
            if (zoomInBtn) zoomInBtn.title = \`Zoom In (+) - Current: \${Math.round(zoomLevel * 100)}%\`;
            if (zoomOutBtn) zoomOutBtn.title = \`Zoom Out (-) - Current: \${Math.round(zoomLevel * 100)}%\`;
            if (resetBtn) resetBtn.title = \`Reset View (0) - \${zoomText}\`;
        }

        function updateTimelineData(data) {
            console.log('=== WEBVIEW DIAGNOSTIC: updateTimelineData started ===');
            console.log('WEBVIEW DIAGNOSTIC: Data received:', data);
            
            try {
                if (!data) {
                    throw new Error('No timeline data provided');
                }

                if (!data.claims || !Array.isArray(data.claims)) {
                    throw new Error('Invalid data structure: claims array is missing or invalid');
                }

                if (!data.dateRange || !data.dateRange.start || !data.dateRange.end) {
                    throw new Error('Invalid data structure: dateRange is missing or incomplete');
                }

                console.log('WEBVIEW DIAGNOSTIC: Data structure validation passed');

                timelineData = JSON.parse(JSON.stringify(data));
                
                // Convert date strings back to Date objects with enhanced validation
                const validClaims = [];
                timelineData.claims.forEach((claim, index) => {
                    try {
                        if (!claim.id) {
                            claim.id = 'claim_' + index + '_' + Date.now();
                        }

                        if (!claim.type) {
                            claim.type = 'unknown';
                        }

                        if (!claim.displayName) {
                            claim.displayName = claim.type + ' ' + claim.id;
                        }

                        if (!claim.startDate || !claim.endDate) {
                            throw new Error('Claim ' + index + ' is missing date information');
                        }
                        
                        const startDate = new Date(claim.startDate);
                        const endDate = new Date(claim.endDate);
                        
                        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                            throw new Error('Claim ' + index + ' has invalid date format');
                        }
                        
                        if (endDate < startDate) {
                            claim.endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
                        } else {
                            claim.endDate = endDate;
                        }
                        
                        claim.startDate = startDate;

                        if (!claim.color) {
                            const defaultColors = {
                                'rxTba': '#FF6B6B',
                                'rxHistory': '#4ECDC4', 
                                'medHistory': '#45B7D1',
                                'unknown': '#95A5A6'
                            };
                            claim.color = defaultColors[claim.type] || defaultColors.unknown;
                        }

                        if (!claim.details || typeof claim.details !== 'object') {
                            claim.details = {};
                        }

                        validClaims.push(claim);
                        
                    } catch (claimError) {
                        console.error('WEBVIEW DIAGNOSTIC: Error processing claim ' + index + ':', claimError);
                    }
                });

                timelineData.claims = validClaims;

                timelineData.dateRange.start = new Date(timelineData.dateRange.start);
                timelineData.dateRange.end = new Date(timelineData.dateRange.end);

                if (timelineData.claims.length === 0) {
                    showError('No valid claims found in the data');
                    return;
                }

                // Initialize claim type configurations and visibility
                initializeClaimTypes();
                
                const loadingElement = document.getElementById('loading');
                const timelineElement = document.getElementById('timeline');

                if (loadingElement) loadingElement.style.display = 'none';
                if (timelineElement) timelineElement.style.display = 'block';

                renderLegend();
                renderTimeline();
                updateStats();
                
                // Show zoom hint for first-time users
                setTimeout(() => {
                    const hint = document.getElementById('zoomHint');
                    if (hint && currentView === 'timeline') {
                        hint.style.display = 'block';
                        setTimeout(() => {
                            hint.style.display = 'none';
                        }, 4000);
                    }
                }, 1000);
                
                console.log('=== WEBVIEW DIAGNOSTIC: updateTimelineData completed successfully ===');

            } catch (error) {
                console.error('WEBVIEW DIAGNOSTIC: Error updating timeline data:', error);
                showError('Failed to load timeline: ' + error.message);
                
                vscode.postMessage({
                    command: 'error',
                    payload: {
                        type: 'DATA_ERROR',
                        message: error.message
                    }
                });
            }
        }

        function initializeClaimTypes() {
            // Group claims by type and count them
            const typeCounts = {};
            timelineData.claims.forEach(claim => {
                typeCounts[claim.type] = (typeCounts[claim.type] || 0) + 1;
            });

            // Initialize claim type configurations
            claimTypeConfigs.clear();
            visibleClaimTypes.clear();

            const typeDisplayNames = {
                'rxTba': 'Current Prescriptions',
                'rxHistory': 'Prescription History',
                'medHistory': 'Medical Services',
                'unknown': 'Other Claims'
            };

            Object.keys(typeCounts).forEach(type => {
                const config = {
                    type: type,
                    displayName: typeDisplayNames[type] || type,
                    count: typeCounts[type],
                    color: timelineData.claims.find(c => c.type === type)?.color || '#95A5A6',
                    visible: true
                };
                
                claimTypeConfigs.set(type, config);
                visibleClaimTypes.add(type);
            });
        }

        function renderLegend() {
            const legendContainer = document.getElementById('legend');
            legendContainer.innerHTML = '';

            claimTypeConfigs.forEach((config, type) => {
                const legendItem = document.createElement('div');
                legendItem.className = 'legend-item';
                legendItem.setAttribute('data-type', type);
                
                if (!config.visible) {
                    legendItem.classList.add('hidden');
                }

                legendItem.innerHTML = \`
                    <div class="legend-color" style="background-color: \${config.color}"></div>
                    <span class="legend-text">\${config.displayName}</span>
                    <span class="legend-count">(\${config.count})</span>
                \`;

                legendItem.addEventListener('click', () => toggleClaimType(type));
                
                legendItem.title = \`Click to \${config.visible ? 'hide' : 'show'} \${config.displayName}\`;

                legendContainer.appendChild(legendItem);
            });
        }

        function toggleClaimType(type) {
            const config = claimTypeConfigs.get(type);
            if (!config) return;

            config.visible = !config.visible;
            
            if (config.visible) {
                visibleClaimTypes.add(type);
            } else {
                visibleClaimTypes.delete(type);
            }

            // Update legend visual state
            const legendItem = document.querySelector(\`[data-type="\${type}"]\`);
            if (legendItem) {
                legendItem.classList.toggle('hidden', !config.visible);
                legendItem.title = \`Click to \${config.visible ? 'hide' : 'show'} \${config.displayName}\`;
            }

            // Update timeline
            updateTimelineVisibility();
            updateStats();
        }

        function updateTimelineVisibility() {
            if (visibleClaimTypes.size === 0) {
                // Show empty state
                if (currentView === 'timeline') {
                    document.getElementById('timeline').style.display = 'none';
                    document.getElementById('emptyState').style.display = 'flex';
                }
                return;
            }

            if (currentView === 'timeline') {
                document.getElementById('timeline').style.display = 'block';
                document.getElementById('emptyState').style.display = 'none';

                // Update claim bar visibility with animation
                svg.selectAll('.claim-bar')
                    .transition()
                    .duration(300)
                    .style('opacity', d => visibleClaimTypes.has(d.type) ? 1 : 0)
                    .style('pointer-events', d => visibleClaimTypes.has(d.type) ? 'all' : 'none');
            } else if (currentView === 'table') {
                // Update table view
                renderTable();
            }
        }

        function renderTimeline() {
            console.log('WEBVIEW DIAGNOSTIC: Starting timeline render');
            
            try {
                if (!timelineData || !svg) {
                    throw new Error('Timeline data or SVG not available');
                }

                svg.selectAll('*').remove();

                const container = document.querySelector('.timeline-content');
                const containerRect = container.getBoundingClientRect();
                const width = Math.max(400, containerRect.width);
                const height = Math.max(300, containerRect.height);
                
                const margin = { 
                    top: 20, 
                    right: 20, 
                    bottom: 50,
                    left: Math.max(80, Math.min(200, width * 0.2))
                };
                
                const innerWidth = Math.max(200, width - margin.left - margin.right);
                const innerHeight = Math.max(150, height - margin.top - margin.bottom);

                const dateExtent = [timelineData.dateRange.start, timelineData.dateRange.end];

                xScale = d3.scaleTime()
                    .domain(dateExtent)
                    .range([0, innerWidth])
                    .clamp(true);

                const claimIndices = timelineData.claims.map((d, i) => i);
                yScale = d3.scaleBand()
                    .domain(claimIndices)
                    .range([0, innerHeight])
                    .padding(0.1);

                const mainGroup = svg.append('g')
                    .attr('class', 'main-content')
                    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

                const xAxis = d3.axisBottom(xScale)
                    .tickFormat(d3.timeFormat('%Y-%m-%d'))
                    .ticks(Math.min(10, Math.floor(innerWidth / 80)));

                const yAxis = d3.axisLeft(yScale)
                    .tickFormat((d, i) => {
                        const claim = timelineData.claims[i];
                        if (!claim) return 'Claim ' + (i + 1);
                        
                        const maxLength = Math.floor(margin.left / 8);
                        const displayName = claim.displayName || (claim.type + ' ' + claim.id);
                        return displayName.length > maxLength ? 
                            displayName.substring(0, maxLength - 3) + '...' : 
                            displayName;
                    });

                mainGroup.append('g')
                    .attr('class', 'x-axis axis')
                    .attr('transform', 'translate(0,' + innerHeight + ')')
                    .call(xAxis)
                    .selectAll('text')
                    .style('text-anchor', 'end')
                    .attr('dx', '-.8em')
                    .attr('dy', '.15em')
                    .attr('transform', 'rotate(-45)');

                mainGroup.append('g')
                    .attr('class', 'y-axis axis')
                    .call(yAxis);

                const claimBars = mainGroup.selectAll('.claim-bar')
                    .data(timelineData.claims)
                    .enter()
                    .append('rect')
                    .attr('class', 'claim-bar')
                    .attr('x', d => Math.max(0, xScale(d.startDate)))
                    .attr('y', (d, i) => yScale(i))
                    .attr('width', d => Math.max(2, xScale(d.endDate) - xScale(d.startDate)))
                    .attr('height', yScale.bandwidth())
                    .attr('fill', d => d.color || '#FF6B6B')
                    .attr('stroke', 'var(--vscode-panel-border)')
                    .attr('stroke-width', 1)
                    .style('opacity', 0.8)
                    .style('cursor', 'pointer')
                    .on('mouseover', handleClaimMouseOver)
                    .on('mouseout', handleClaimMouseOut)
                    .on('click', handleClaimClick);

                console.log('WEBVIEW DIAGNOSTIC: Timeline render completed successfully');

            } catch (error) {
                console.error('WEBVIEW DIAGNOSTIC: Error rendering timeline:', error);
                showError('Failed to render timeline: ' + error.message);
            }
        }

        function handleClaimClick(event, d) {
            console.log('WEBVIEW DIAGNOSTIC: Claim clicked:', d);
            
            vscode.postMessage({
                command: 'select',
                payload: d.id
            });
        }

        function handleClaimMouseOver(event, d) {
            d3.selectAll('.tooltip').remove();
            
            const tooltip = d3.select('body')
                .append('div')
                .attr('class', 'tooltip')
                .style('opacity', 0);

            const tooltipContent = '<strong>' + d.displayName + '</strong><br/>' +
                '<em>' + d.type + '</em><br/>' +
                d.startDate.toLocaleDateString() + ' - ' + d.endDate.toLocaleDateString() + '<br/>' +
                'Duration: ' + Math.ceil((d.endDate.getTime() - d.startDate.getTime()) / (1000 * 60 * 60 * 24)) + ' days';

            tooltip.html(tooltipContent)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px')
                .transition()
                .duration(200)
                .style('opacity', 1);

            d3.select(event.target)
                .style('stroke-width', 3)
                .style('stroke', 'var(--vscode-focusBorder)')
                .style('opacity', 1);
        }

        function handleClaimMouseOut(event) {
            setTimeout(() => {
                d3.selectAll('.tooltip').remove();
            }, 100);
            
            d3.select(event.target)
                .style('stroke-width', 1)
                .style('stroke', 'var(--vscode-panel-border)')
                .style('opacity', 0.8);
        }

        function updateStats() {
            if (!timelineData) return;
            
            const stats = document.getElementById('stats');
            const dateRange = timelineData.dateRange.start.toLocaleDateString() + ' - ' + timelineData.dateRange.end.toLocaleDateString();
            
            // Count visible claims
            const visibleClaims = timelineData.claims.filter(claim => visibleClaimTypes.has(claim.type));
            const visibleCount = visibleClaims.length;
            const totalCount = timelineData.metadata.totalClaims;
            
            let statsText = '';
            if (visibleCount === totalCount) {
                statsText = '<strong>' + totalCount + '</strong> claims';
            } else {
                statsText = '<strong>' + visibleCount + '</strong> of <strong>' + totalCount + '</strong> claims';
            }
            
            statsText += ' | <strong>' + visibleClaimTypes.size + '</strong> of <strong>' + timelineData.metadata.claimTypes.length + '</strong> types visible';
            statsText += ' | <span style="color: var(--vscode-descriptionForeground);">' + dateRange + '</span>';
            
            stats.innerHTML = statsText;
        }

        function showError(message) {
            console.error('WEBVIEW DIAGNOSTIC: Timeline error:', message);
            
            const loadingElement = document.getElementById('loading');
            const timelineElement = document.getElementById('timeline');
            
            if (loadingElement) loadingElement.style.display = 'none';
            if (timelineElement) timelineElement.style.display = 'none';
            
            let errorDiv = document.getElementById('error-display');
            if (!errorDiv) {
                errorDiv = document.createElement('div');
                errorDiv.id = 'error-display';
                errorDiv.className = 'error';
                document.querySelector('.timeline-content').appendChild(errorDiv);
            }
            
            errorDiv.innerHTML = '<div style="text-align: center; padding: 40px;">' +
                '<div style="font-size: 48px; margin-bottom: 20px; color: var(--vscode-errorForeground);">⚠️</div>' +
                '<h3 style="margin-bottom: 16px; color: var(--vscode-errorForeground);">Timeline Error</h3>' +
                '<p style="margin-bottom: 20px;">' + message + '</p>' +
                '<button onclick="location.reload()" style="padding: 8px 16px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 4px; cursor: pointer;">🔄 Retry</button>' +
            '</div>';
            
            errorDiv.style.display = 'flex';
            errorDiv.style.alignItems = 'center';
            errorDiv.style.justifyContent = 'center';
            errorDiv.style.height = '100%';
            errorDiv.style.width = '100%';
        }

        function showErrorInWebview(errorPayload) {
            const message = errorPayload.message || 'Unknown error occurred';
            showError(message);
        }

        // Table View Functions
        function switchView(view) {
            currentView = view;
            
            // Update button states
            document.getElementById('timelineViewBtn').classList.toggle('active', view === 'timeline');
            document.getElementById('tableViewBtn').classList.toggle('active', view === 'table');
            
            // Show/hide views
            if (view === 'timeline') {
                document.getElementById('timeline').style.display = 'block';
                document.getElementById('tableView').classList.remove('active');
                document.getElementById('emptyState').style.display = visibleClaimTypes.size === 0 ? 'flex' : 'none';
            } else {
                document.getElementById('timeline').style.display = 'none';
                document.getElementById('emptyState').style.display = 'none';
                document.getElementById('tableView').classList.add('active');
                renderTable();
            }
        }

        function renderTable() {
            if (!timelineData || !timelineData.claims) return;
            
            // Filter claims based on visibility and search
            filteredClaims = timelineData.claims.filter(claim => {
                // Check visibility
                if (!visibleClaimTypes.has(claim.type)) return false;
                
                // Check search query
                if (tableState.searchQuery) {
                    const query = tableState.searchQuery.toLowerCase();
                    const searchableText = [
                        claim.id,
                        claim.type,
                        claim.displayName,
                        claim.startDate.toLocaleDateString(),
                        claim.endDate.toLocaleDateString(),
                        JSON.stringify(claim.details)
                    ].join(' ').toLowerCase();
                    
                    if (!searchableText.includes(query)) return false;
                }
                
                return true;
            });
            
            // Sort claims
            filteredClaims.sort((a, b) => {
                let aVal, bVal;
                
                switch (tableState.sortColumn) {
                    case 'startDate':
                    case 'endDate':
                        aVal = new Date(a[tableState.sortColumn]).getTime();
                        bVal = new Date(b[tableState.sortColumn]).getTime();
                        break;
                    case 'duration':
                        aVal = new Date(a.endDate).getTime() - new Date(a.startDate).getTime();
                        bVal = new Date(b.endDate).getTime() - new Date(b.startDate).getTime();
                        break;
                    default:
                        aVal = String(a[tableState.sortColumn] || '').toLowerCase();
                        bVal = String(b[tableState.sortColumn] || '').toLowerCase();
                }
                
                if (aVal < bVal) return tableState.sortDirection === 'asc' ? -1 : 1;
                if (aVal > bVal) return tableState.sortDirection === 'asc' ? 1 : -1;
                return 0;
            });
            
            // Update sort indicators
            document.querySelectorAll('.claims-table th').forEach(th => {
                th.classList.remove('sorted-asc', 'sorted-desc');
                if (th.getAttribute('data-column') === tableState.sortColumn) {
                    th.classList.add('sorted-' + tableState.sortDirection);
                }
            });
            
            // Render table rows
            renderTableRows();
            updateTableStats();
            renderPagination();
        }

        function renderTableRows() {
            const tbody = document.getElementById('claimsTableBody');
            tbody.innerHTML = '';
            
            const startIndex = (tableState.currentPage - 1) * tableState.pageSize;
            const endIndex = Math.min(startIndex + tableState.pageSize, filteredClaims.length);
            const pageData = filteredClaims.slice(startIndex, endIndex);
            
            pageData.forEach(claim => {
                const row = document.createElement('tr');
                row.setAttribute('data-claim-id', claim.id);
                row.addEventListener('click', () => selectTableRow(claim.id));
                
                const duration = Math.ceil((new Date(claim.endDate).getTime() - new Date(claim.startDate).getTime()) / (1000 * 60 * 60 * 24));
                
                // Format details for display
                const detailsText = Object.entries(claim.details || {})
                    .filter(([key, value]) => value !== null && value !== undefined && value !== '')
                    .map(([key, value]) => \`\${key}: \${value}\`)
                    .join(', ');
                
                row.innerHTML = \`
                    <td>\${claim.id}</td>
                    <td><span class="claim-type-badge" style="background-color: \${claim.color}">\${claim.type}</span></td>
                    <td>\${claim.displayName}</td>
                    <td>\${new Date(claim.startDate).toLocaleDateString()}</td>
                    <td>\${new Date(claim.endDate).toLocaleDateString()}</td>
                    <td>\${duration} day\${duration !== 1 ? 's' : ''}</td>
                    <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis;" title="\${detailsText}">\${detailsText}</td>
                \`;
                
                tbody.appendChild(row);
            });
        }

        function selectTableRow(claimId) {
            // Remove previous selection
            document.querySelectorAll('.claims-table tr.selected').forEach(row => {
                row.classList.remove('selected');
            });
            
            // Add selection to clicked row
            const row = document.querySelector(\`[data-claim-id="\${claimId}"]\`);
            if (row) {
                row.classList.add('selected');
            }
            
            // Send selection message to extension
            vscode.postMessage({
                command: 'select',
                payload: claimId
            });
        }

        function handleSort(column) {
            if (tableState.sortColumn === column) {
                tableState.sortDirection = tableState.sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                tableState.sortColumn = column;
                tableState.sortDirection = 'asc';
            }
            
            tableState.currentPage = 1;
            renderTable();
        }

        function goToPage(page) {
            const totalPages = Math.ceil(filteredClaims.length / tableState.pageSize);
            if (page < 1 || page > totalPages) return;
            
            tableState.currentPage = page;
            renderTable();
        }

        function renderPagination() {
            const totalPages = Math.ceil(filteredClaims.length / tableState.pageSize);
            const pagination = document.getElementById('pagination');
            
            if (totalPages <= 1) {
                pagination.style.display = 'none';
                return;
            }
            
            pagination.style.display = 'flex';
            
            // Update pagination info
            const startItem = (tableState.currentPage - 1) * tableState.pageSize + 1;
            const endItem = Math.min(tableState.currentPage * tableState.pageSize, filteredClaims.length);
            
            document.getElementById('paginationInfo').textContent = 
                \`Showing \${startItem}-\${endItem} of \${filteredClaims.length} claims\`;
            
            document.getElementById('pageInfo').textContent = 
                \`Page \${tableState.currentPage} of \${totalPages}\`;
            
            // Update button states
            document.getElementById('firstPage').disabled = tableState.currentPage === 1;
            document.getElementById('prevPage').disabled = tableState.currentPage === 1;
            document.getElementById('nextPage').disabled = tableState.currentPage === totalPages;
            document.getElementById('lastPage').disabled = tableState.currentPage === totalPages;
        }

        function updateTableStats() {
            const stats = document.getElementById('tableStats');
            if (filteredClaims.length === timelineData.claims.length) {
                stats.textContent = \`\${filteredClaims.length} claims\`;
            } else {
                stats.textContent = \`\${filteredClaims.length} of \${timelineData.claims.length} claims\`;
            }
        }

        function exportData(format) {
            if (!filteredClaims.length) {
                alert('No data to export');
                return;
            }
            
            let content, filename, mimeType;
            
            if (format === 'csv') {
                const headers = ['ID', 'Type', 'Name', 'Start Date', 'End Date', 'Duration (days)', 'Details'];
                const rows = filteredClaims.map(claim => {
                    const duration = Math.ceil((new Date(claim.endDate).getTime() - new Date(claim.startDate).getTime()) / (1000 * 60 * 60 * 24));
                    const details = Object.entries(claim.details || {})
                        .filter(([key, value]) => value !== null && value !== undefined && value !== '')
                        .map(([key, value]) => \`\${key}: \${value}\`)
                        .join('; ');
                    
                    return [
                        claim.id,
                        claim.type,
                        claim.displayName,
                        new Date(claim.startDate).toLocaleDateString(),
                        new Date(claim.endDate).toLocaleDateString(),
                        duration,
                        details
                    ].map(field => \`"\${String(field).replace(/"/g, '""')}"\`).join(',');
                });
                
                content = [headers.join(','), ...rows].join('\\n');
                filename = 'claims-export.csv';
                mimeType = 'text/csv';
            } else {
                content = JSON.stringify(filteredClaims, null, 2);
                filename = 'claims-export.json';
                mimeType = 'application/json';
            }
            
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
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