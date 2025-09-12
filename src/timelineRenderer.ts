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
     * Generate HTML content for webview with improved JavaScript
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
            line-height: 1.4;
        }
    </style>
</head>
<body>
    <div class="timeline-container">
        <div class="timeline-header">
            <h2 class="timeline-title">Medical Claims Timeline</h2>
            <div id="stats" class="timeline-stats">Loading...</div>
        </div>
        <div class="timeline-content">
            <div id="loading" class="loading">Loading timeline data...</div>
            <svg id="timeline" class="timeline-svg" style="display: none;"></svg>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let timelineData = null;
        let svg = null;
        let xScale = null;
        let yScale = null;
        let zoom = null;

        // Initialize when DOM is ready
        document.addEventListener('DOMContentLoaded', function() {
            console.log('WEBVIEW DIAGNOSTIC: DOM loaded, initializing timeline');
            initializeTimeline();
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

                console.log('WEBVIEW DIAGNOSTIC: SVG element found');

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

                const loadingElement = document.getElementById('loading');
                const timelineElement = document.getElementById('timeline');

                if (loadingElement) loadingElement.style.display = 'none';
                if (timelineElement) timelineElement.style.display = 'block';

                renderTimeline();
                updateStats();
                
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
                    .tickFormat(d3.timeFormat('%m/%d/%y'))
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
            
            stats.innerHTML = '<strong>' + timelineData.metadata.totalClaims + '</strong> claims | ' +
                '<strong>' + timelineData.metadata.claimTypes.length + '</strong> types | ' +
                '<span style="color: var(--vscode-descriptionForeground);">' + dateRange + '</span>';
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