import * as vscode from "vscode";
import { TimelineData, ClaimItem } from "./types";

/**
 * Message types for communication between extension and webview
 */
export interface WebviewMessage {
  command: "zoom" | "pan" | "select" | "configure" | "ready" | "error";
  payload?: any;
}

/**
 * TimelineRenderer manages webview panels and coordinates timeline display
 */
export class TimelineRenderer {
  private static readonly viewType = "medicalClaimsTimeline";
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
    console.log(
      "=== HYBRID PARSER: TimelineRenderer.createTimeline started ==="
    );
    this.createPanel(data);
  }

  /**
   * Create and show timeline webview panel
   */
  public createPanel(data: TimelineData): vscode.WebviewPanel | null {
    console.log("=== DIAGNOSTIC: TimelineRenderer.createPanel started ===");

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
        "Medical Claims Timeline",
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [
            vscode.Uri.joinPath(this.context.extensionUri, "webview"),
          ],
        }
      );

      // Handle null panel creation
      if (!this.panel) {
        console.error("Failed to create webview panel");
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
              command: "updateData",
              payload: serializedData,
            });
          } catch (error) {
            console.error("Error sending data to webview:", error);
          }
        }
      }, 50);

      return this.panel;
    } catch (error) {
      console.error("Error creating webview panel:", error);
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
          command: "updateData",
          payload: serializedData,
        });
      } catch (error) {
        console.error("Error updating webview data:", error);
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
      if (!message || typeof message !== "object") {
        console.warn("Received invalid message:", message);
        return;
      }

      switch (message.command) {
        case "ready":
          if (this.currentData && this.panel) {
            const serializedData = this.serializeTimelineData(this.currentData);
            this.panel.webview.postMessage({
              command: "updateData",
              payload: serializedData,
            });
          }
          break;

        case "select":
          this.handleClaimSelection(message.payload);
          break;

        case "error":
          this.handleWebviewError(message.payload);
          break;

        default:
          console.warn("Unknown message command:", message.command);
          break;
      }
    } catch (error) {
      console.error("Error handling webview message:", error);
    }
  }

  /**
   * Handle claim selection from timeline
   */
  private handleClaimSelection(claimId: string): void {
    if (!this.currentData) {
      return;
    }

    const selectedClaim = this.currentData.claims.find(
      (claim) => claim.id === claimId
    );
    if (selectedClaim) {
      const details = this.formatClaimDetails(selectedClaim);
      vscode.window.showInformationMessage(
        "Selected " +
          selectedClaim.type +
          " claim: " +
          selectedClaim.displayName,
        { modal: false, detail: details }
      );
    } else {
      vscode.window.showWarningMessage("Selected claim not found: " + claimId);
    }
  }

  /**
   * Handle error messages from webview
   */
  private handleWebviewError(errorPayload: any): void {
    console.error("Webview error:", errorPayload);

    const message = errorPayload?.message || "Unknown webview error";
    vscode.window.showErrorMessage(
      "Timeline Error: " + message,
      "Retry",
      "Report Issue"
    );
  }

  /**
   * Format claim details for display
   */
  private formatClaimDetails(claim: ClaimItem): string {
    const startDate = claim.startDate;
    const endDate = claim.endDate;

    const lines = [
      "Type: " + claim.type,
      "Start Date: " + startDate.toLocaleDateString(),
      "End Date: " + endDate.toLocaleDateString(),
      "Duration: " +
        Math.ceil(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        ) +
        " days",
    ];

    // Add type-specific details
    if (claim.type === "rxTba" || claim.type === "rxHistory") {
      if (claim.details.medication)
        lines.push("Medication: " + claim.details.medication);
      if (claim.details.dosage) lines.push("Dosage: " + claim.details.dosage);
      if (claim.details.dayssupply)
        lines.push("Days Supply: " + claim.details.dayssupply);
    } else if (claim.type === "medHistory") {
      if (claim.details.serviceType)
        lines.push("Service: " + claim.details.serviceType);
      if (claim.details.provider)
        lines.push("Provider: " + claim.details.provider);
      if (claim.details.amount) lines.push("Amount: $" + claim.details.amount);
    }

    return lines.join("\n");
  }

  /**
   * Serialize timeline data for webview (convert dates to strings)
   */
  private serializeTimelineData(data: TimelineData): any {
    return {
      claims: data.claims.map((claim) => ({
        ...claim,
        startDate: claim.startDate.toISOString(),
        endDate: claim.endDate.toISOString(),
      })),
      dateRange: {
        start: data.dateRange.start.toISOString(),
        end: data.dateRange.end.toISOString(),
      },
      metadata: data.metadata,
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
    <script>
        // Debug D3 loading
        console.log('D3 loading check:', typeof d3);
        if (typeof d3 === 'undefined') {
            console.error('D3.js failed to load!');
            document.addEventListener('DOMContentLoaded', () => {
                document.body.innerHTML = '<div style="color: red; padding: 20px; text-align: center;"><h2>Error: D3.js Library Not Loaded</h2><p>The D3.js library failed to load. This might be due to network issues or Content Security Policy restrictions.</p></div>';
            });
        } else {
            console.log('D3.js loaded successfully, version:', d3.version);
        }
    </script>
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
            height: calc(100vh - 60px);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }
        
        .timeline-main {
            display: flex;
            flex: 1;
            overflow: hidden;
        }
        
        .timeline-sidebar {
            width: 220px;
            min-width: 200px;
            max-width: 280px;
            background-color: var(--vscode-sideBar-background);
            border-right: 1px solid var(--vscode-panel-border);
            display: flex;
            flex-direction: column;
            overflow-y: auto;
            flex-shrink: 0;
            position: relative;
        }
        
        .sidebar-resize-handle {
            position: absolute;
            top: 0;
            right: 0;
            width: 4px;
            height: 100%;
            cursor: col-resize;
            background-color: transparent;
            transition: background-color 0.2s;
        }
        
        .sidebar-resize-handle:hover {
            background-color: var(--vscode-focusBorder);
        }
        
        @media (max-width: 1200px) {
            .timeline-sidebar {
                width: 180px;
                min-width: 160px;
            }
        }
        
        @media (max-width: 900px) {
            .timeline-sidebar {
                width: 160px;
                min-width: 140px;
            }
            
            .legend-text {
                font-size: 11px;
            }
            
            .legend-count {
                font-size: 9px;
            }
        }
        
        .sidebar-header {
            padding: 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
            background-color: var(--vscode-panel-background);
            font-weight: 600;
            font-size: 12px;
            color: var(--vscode-editor-foreground);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .timeline-chart-area {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
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
            justify-content: flex-start;
            align-items: center;
            flex-shrink: 0;
            gap: 15px;
        }
        .control-group {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .zoom-controls {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 4px;
            background-color: var(--vscode-sideBar-background);
            border-radius: 4px;
            border: 1px solid var(--vscode-panel-border);
        }
        
        .pan-controls {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 4px;
            background-color: var(--vscode-sideBar-background);
            border-radius: 4px;
            border: 1px solid var(--vscode-panel-border);
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
            padding: 8px 0;
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        
        .legend-item {
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            padding: 8px 12px;
            border-radius: 4px;
            transition: all 0.2s;
            margin: 0 8px;
            border: 1px solid transparent;
        }
        
        .legend-item:hover {
            background-color: var(--vscode-list-hoverBackground);
            border-color: var(--vscode-list-hoverBackground);
        }
        
        .legend-item.hidden {
            opacity: 0.6;
            background-color: var(--vscode-input-background);
        }
        
        .legend-item.hidden .legend-text {
            text-decoration: line-through;
            color: var(--vscode-descriptionForeground);
        }
        
        .legend-item.active {
            background-color: var(--vscode-list-activeSelectionBackground);
            color: var(--vscode-list-activeSelectionForeground);
            border-color: var(--vscode-focusBorder);
        }
        
        .legend-color {
            width: 16px;
            height: 16px;
            border-radius: 3px;
            border: 1px solid var(--vscode-panel-border);
            flex-shrink: 0;
            box-shadow: inset 0 1px 2px rgba(0,0,0,0.1);
        }
        
        .legend-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        
        .legend-text {
            font-size: 12px;
            font-weight: 500;
            user-select: none;
            line-height: 1.2;
        }
        
        .legend-count {
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
            font-weight: normal;
        }
        
        .legend-toggle-all {
            margin: 8px;
            padding: 6px 12px;
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            border-radius: 3px;
            font-size: 11px;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        
        .legend-toggle-all:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .timeline-content {
            flex: 1;
            position: relative;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }
        
        .timeline-graph-section {
            flex: 1;
            position: relative;
            overflow: hidden;
            min-height: 300px;
        }
        
        .timeline-table-section {
            flex: 1;
            position: relative;
            overflow: hidden;
            min-height: 200px;
            border-top: 2px solid var(--vscode-panel-border);
        }
        
        .both-view .timeline-graph-section {
            flex: 0 0 60%;
            max-height: 60%;
        }
        
        .both-view .timeline-table-section {
            flex: 0 0 40%;
            max-height: 40%;
        }
        
        .view-splitter {
            height: 4px;
            background-color: var(--vscode-panel-border);
            cursor: row-resize;
            position: relative;
            transition: background-color 0.2s;
        }
        
        .view-splitter:hover {
            background-color: var(--vscode-focusBorder);
        }
        
        .view-splitter::after {
            content: '';
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            width: 30px;
            height: 2px;
            background-color: var(--vscode-descriptionForeground);
            border-radius: 1px;
        }
        .timeline-svg {
            width: 100%;
            height: 100%;
            cursor: grab;
            min-height: 400px;
        }
        
        .timeline-svg:active {
            cursor: grabbing;
        }
        
        .timeline-svg.zooming {
            cursor: zoom-in;
        }
        
        .timeline-svg.panning {
            cursor: move;
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
        
        .context-menu {
            position: absolute;
            background: var(--vscode-menu-background);
            border: 1px solid var(--vscode-menu-border);
            border-radius: 4px;
            padding: 4px 0;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            z-index: 1000;
            font-size: 12px;
            min-width: 150px;
            user-select: none;
        }
        
        .context-menu-item {
            padding: 6px 12px;
            cursor: pointer;
            color: var(--vscode-menu-foreground);
            transition: background-color 0.1s;
        }
        
        .context-menu-item:hover {
            background: var(--vscode-menu-selectionBackground);
            color: var(--vscode-menu-selectionForeground);
        }
        
        .context-menu-separator {
            height: 1px;
            background: var(--vscode-menu-separatorBackground);
            margin: 4px 0;
        }
    </style>
</head>
<body>
    <div class="timeline-container">
        <div class="timeline-header">
            <h2 class="timeline-title">Medical Claims Timeline</h2>
            <div id="stats" class="timeline-stats">Loading...</div>
        </div>
        <div class="timeline-main">
            <div class="timeline-sidebar">
                <div class="sidebar-resize-handle" id="sidebarResizeHandle"></div>
                <div class="sidebar-header">
                    📊 Claim Types
                </div>
                <div id="legend" class="legend-container">
                    <!-- Legend items will be populated dynamically -->
                </div>
                <button id="toggleAllClaims" class="legend-toggle-all" title="Toggle all claim types">
                    Toggle All
                </button>
            </div>
            <div class="timeline-chart-area">
                <div class="timeline-controls">
                    <div class="view-toggle">
                        <button id="timelineViewBtn" class="view-toggle-button active" title="Timeline View">📊 Timeline</button>
                        <button id="tableViewBtn" class="view-toggle-button" title="Table View">📋 Table</button>
                        <button id="bothViewBtn" class="view-toggle-button" title="Both Views">📊📋 Both</button>
                    </div>
                    <div class="zoom-controls">
                        <button id="zoomIn" class="control-button" title="Zoom In (+)">🔍+</button>
                        <button id="zoomOut" class="control-button" title="Zoom Out (-)">🔍-</button>
                        <button id="zoomToFit" class="control-button" title="Zoom to Fit (F)">⤢</button>
                        <button id="resetZoom" class="control-button" title="Reset View (0)">⌂</button>
                        <div class="zoom-info" id="zoomInfo" title="Current zoom level">100%</div>
                    </div>
                    <div class="pan-controls">
                        <button id="panUp" class="control-button" title="Pan Up (Shift+↑)">↑</button>
                        <button id="panDown" class="control-button" title="Pan Down (Shift+↓)">↓</button>
                        <button id="panLeft" class="control-button" title="Pan Left (Shift+←)">←</button>
                        <button id="panRight" class="control-button" title="Pan Right (Shift+→)">→</button>
                    </div>
                </div>
                <div class="timeline-content">
                    <!-- Loading and Empty States -->
                    <div id="loading" class="loading">Loading timeline data...</div>
                    <div id="emptyState" class="empty-state" style="display: none;">
                        <div class="empty-state-icon">📊</div>
                        <div>No claims visible</div>
                        <div style="font-size: 12px; margin-top: 8px;">Enable claim types in the sidebar</div>
                    </div>
                    
                    <!-- Timeline Graph Section -->
                    <div id="timelineGraphSection" class="timeline-graph-section">
                        <div id="zoomHint" class="zoom-hint" style="display: none;">
                            <div style="font-size: 11px; color: var(--vscode-descriptionForeground); text-align: center; padding: 8px;">
                                💡 <strong>Enhanced Navigation:</strong><br/>
                                <strong>Mouse:</strong> Scroll to zoom, drag to pan, double-click to zoom in/fit, right-click for menu<br/>
                                <strong>Keys:</strong> +/- zoom, F fit, 0 reset, Shift+arrows pan, Home/End to start/end<br/>
                                <strong>Ctrl+Key:</strong> Faster zoom/pan | <strong>Sidebar:</strong> Toggle claim types to filter view
                            </div>
                        </div>
                        <svg id="timeline" class="timeline-svg" style="display: none;"></svg>
                    </div>
                    
                    <!-- View Splitter (only visible in both view) -->
                    <div id="viewSplitter" class="view-splitter" style="display: none;"></div>
                    
                    <!-- Table Section -->
                    <div id="timelineTableSection" class="timeline-table-section" style="display: none;">
                        <div id="tableView" class="table-view active">
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
        
        // Semantic zoom levels for time granularity
        let currentZoomLevel = 1; // 0=years, 1=months, 2=weeks, 3=days
        const zoomLevels = [
            { name: 'Years', tickFormat: d3.timeFormat('%Y'), ticks: d3.timeYear.every(1) },
            { name: 'Months', tickFormat: d3.timeFormat('%Y-%m'), ticks: d3.timeMonth.every(1) },
            { name: 'Weeks', tickFormat: d3.timeFormat('%m/%d'), ticks: d3.timeWeek.every(1) },
            { name: 'Days', tickFormat: d3.timeFormat('%m/%d'), ticks: d3.timeDay.every(1) }
        ];
        
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
        
        // Test function for debugging zoom (can be called from browser console)
        window.testZoom = function() {
            console.log('=== ZOOM TEST ===');
            console.log('svg:', svg);
            console.log('zoom:', zoom);
            console.log('SVG node:', svg ? svg.node() : 'null');
            console.log('SVG dimensions:', svg ? svg.node().getBoundingClientRect() : 'null');
            console.log('SVG has zoom behavior:', svg ? !!svg.node().__zoom : 'null');
            
            if (svg && zoom) {
                console.log('Attempting programmatic zoom...');
                try {
                    svg.transition().duration(1000).call(zoom.scaleBy, 2);
                    console.log('Zoom command executed successfully');
                } catch (error) {
                    console.error('Zoom command failed:', error);
                }
            } else {
                console.log('Cannot test zoom - svg or zoom not available');
            }
        };

        // Add debug info to the page
        function addDebugInfo(message, type = 'info') {
            const debugDiv = document.getElementById('debugInfo') || (() => {
                const div = document.createElement('div');
                div.id = 'debugInfo';
                div.style.cssText = 'position: fixed; top: 10px; right: 10px; background: rgba(0,0,0,0.8); color: white; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 11px; max-width: 300px; z-index: 10000; max-height: 200px; overflow-y: auto;';
                document.body.appendChild(div);
                return div;
            })();
            
            const timestamp = new Date().toLocaleTimeString();
            const color = type === 'error' ? '#ff6b6b' : type === 'success' ? '#51cf66' : '#74c0fc';
            debugDiv.innerHTML += '<div style="color: ' + color + '; margin-bottom: 2px;">[' + timestamp + '] ' + message + '</div>';
            debugDiv.scrollTop = debugDiv.scrollHeight;
        }

        // Initialize when DOM is ready
        document.addEventListener('DOMContentLoaded', function() {
            addDebugInfo('DOM loaded, initializing timeline');
            console.log('WEBVIEW DIAGNOSTIC: DOM loaded, initializing timeline');
            
            const d3Available = typeof d3 !== 'undefined';
            const timelineExists = !!document.getElementById('timeline');
            
            addDebugInfo('D3 available: ' + d3Available + (d3Available ? ' (v' + d3.version + ')' : ''));
            addDebugInfo('Timeline element exists: ' + timelineExists);
            
            console.log('WEBVIEW DIAGNOSTIC: D3 version:', d3Available ? d3.version : 'D3 not loaded');
            console.log('WEBVIEW DIAGNOSTIC: Timeline element exists:', timelineExists);
            
            if (!d3Available) {
                addDebugInfo('D3.js not loaded, cannot initialize timeline', 'error');
                console.error('WEBVIEW DIAGNOSTIC: D3.js not loaded, cannot initialize timeline');
                document.getElementById('loading').innerHTML = '<div style="color: var(--vscode-errorForeground); text-align: center; padding: 40px;"><h3>Error: D3.js Library Not Available</h3><p>The timeline visualization requires D3.js library which failed to load.</p><p>This might be due to network connectivity or security restrictions.</p></div>';
                return;
            }
            
            addDebugInfo('Starting initialization...', 'info');
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
            addDebugInfo('Initializing timeline...');
            console.log('WEBVIEW DIAGNOSTIC: Initializing timeline');
            console.log('WEBVIEW DIAGNOSTIC: typeof d3:', typeof d3);
            console.log('WEBVIEW DIAGNOSTIC: d3.zoom available:', typeof d3.zoom);
            
            try {
                svg = d3.select('#timeline');
                const svgExists = !svg.empty();
                addDebugInfo('SVG selection: ' + (svgExists ? 'found' : 'not found'));
                
                console.log('WEBVIEW DIAGNOSTIC: SVG selected:', svg);
                console.log('WEBVIEW DIAGNOSTIC: SVG node:', svg.node());
                console.log('WEBVIEW DIAGNOSTIC: SVG empty:', svg.empty());
                
                if (svg.empty()) {
                    throw new Error('Timeline SVG element not found');
                }

                // Check SVG dimensions
                const svgNode = svg.node();
                const rect = svgNode.getBoundingClientRect();
                addDebugInfo('SVG dimensions: ' + rect.width + 'x' + rect.height);
                console.log('WEBVIEW DIAGNOSTIC: SVG dimensions:', rect.width, 'x', rect.height);
                
                // If SVG has no dimensions, set minimum dimensions
                if (rect.width === 0 || rect.height === 0) {
                    addDebugInfo('SVG has no dimensions, setting minimum size', 'info');
                    svg.attr('width', '100%').attr('height', '100%');
                    svg.style('min-width', '800px').style('min-height', '600px');
                    
                    // Re-check dimensions after setting
                    const newRect = svgNode.getBoundingClientRect();
                    addDebugInfo('SVG dimensions after resize: ' + newRect.width + 'x' + newRect.height);
                }
                
                // Initialize semantic zoom (no D3 zoom behavior needed)
                console.log('ZOOM SETUP: Semantic zoom initialized');
                addDebugInfo('Semantic zoom initialized', 'success');
                
                // Update the initial time axis
                updateTimeAxis();

                const hasZoomBehavior = !!svg.node().__zoom;
                addDebugInfo('Zoom behavior applied: ' + hasZoomBehavior, hasZoomBehavior ? 'success' : 'error');
                
                console.log('WEBVIEW DIAGNOSTIC: SVG element found and zoom initialized');
                console.log('WEBVIEW DIAGNOSTIC: SVG has zoom behavior:', hasZoomBehavior);
                
                // Test if zoom behavior is working by trying to access zoom transform
                const currentTransform = d3.zoomTransform(svgNode);
                addDebugInfo('Initial transform: k=' + currentTransform.k + ', x=' + currentTransform.x + ', y=' + currentTransform.y);
                console.log('WEBVIEW DIAGNOSTIC: Current zoom transform:', currentTransform);

                vscode.postMessage({
                    command: 'ready',
                    payload: { status: 'initialized' }
                });

                addDebugInfo('Timeline initialization complete!', 'success');
                console.log('WEBVIEW DIAGNOSTIC: Ready message sent to extension');

            } catch (error) {
                addDebugInfo('Initialization error: ' + error.message, 'error');
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
        
        function updateZoomBehavior() {
            // Re-apply zoom behavior to ensure it works with the current container size
            if (svg && zoom) {
                console.log('WEBVIEW DIAGNOSTIC: Updating zoom behavior');
                
                // Check SVG dimensions again
                const svgNode = svg.node();
                const rect = svgNode.getBoundingClientRect();
                console.log('WEBVIEW DIAGNOSTIC: SVG dimensions during update:', rect.width, 'x', rect.height);
                
                // Re-apply zoom behavior
                svg.call(zoom)
                    .on('dblclick.zoom', handleDoubleClick)
                    .on('contextmenu', handleRightClick);
                
                // Verify zoom behavior is applied
                console.log('WEBVIEW DIAGNOSTIC: SVG has zoom behavior after update:', !!svg.node().__zoom);
                
                // Test zoom transform access
                const currentTransform = d3.zoomTransform(svgNode);
                console.log('WEBVIEW DIAGNOSTIC: Current zoom transform after update:', currentTransform);
                
                console.log('WEBVIEW DIAGNOSTIC: Zoom behavior updated for current view');
            } else {
                console.log('WEBVIEW DIAGNOSTIC: Cannot update zoom - svg or zoom not available');
            }
        }

        function initializeControls() {
            // View toggle controls
            document.getElementById('timelineViewBtn').addEventListener('click', () => switchView('timeline'));
            document.getElementById('tableViewBtn').addEventListener('click', () => switchView('table'));
            document.getElementById('bothViewBtn').addEventListener('click', () => switchView('both'));
            
            // Enhanced zoom controls
            document.getElementById('zoomIn').addEventListener('click', () => {
                addDebugInfo('Zoom In button clicked');
                console.log('SEMANTIC ZOOM: Zoom in button clicked');
                zoomIn();
            });

            document.getElementById('zoomOut').addEventListener('click', () => {
                addDebugInfo('Zoom Out button clicked');
                console.log('SEMANTIC ZOOM: Zoom out button clicked');
                zoomOut();
            });

            document.getElementById('zoomToFit').addEventListener('click', () => {
                addDebugInfo('Zoom to Fit clicked');
                console.log('SEMANTIC ZOOM: Zoom to fit - resetting to default');
                resetZoom();
            });

            document.getElementById('resetZoom').addEventListener('click', () => {
                addDebugInfo('Reset Zoom clicked');
                console.log('SEMANTIC ZOOM: Reset zoom button clicked');
                resetZoom();
            });

            // Enhanced pan controls with vertical panning
            document.getElementById('panLeft').addEventListener('click', () => {
                if (svg && zoom) {
                    const width = svg.node().clientWidth;
                    svg.transition().duration(200).call(zoom.translateBy, width * 0.15, 0);
                }
            });

            document.getElementById('panRight').addEventListener('click', () => {
                if (svg && zoom) {
                    const width = svg.node().clientWidth;
                    svg.transition().duration(200).call(zoom.translateBy, -width * 0.15, 0);
                }
            });

            document.getElementById('panUp').addEventListener('click', () => {
                if (svg && zoom) {
                    const height = svg.node().clientHeight;
                    svg.transition().duration(200).call(zoom.translateBy, 0, height * 0.15);
                }
            });

            document.getElementById('panDown').addEventListener('click', () => {
                if (svg && zoom) {
                    const height = svg.node().clientHeight;
                    svg.transition().duration(200).call(zoom.translateBy, 0, -height * 0.15);
                }
            });
            
            // Table controls with synchronized filtering
            document.getElementById('searchBox').addEventListener('input', (e) => {
                tableState.searchQuery = e.target.value;
                tableState.currentPage = 1;
                renderTable();
                
                // Also update timeline if in both view
                if (currentView === 'both') {
                    updateTimelineWithSearch();
                }
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
            
            // Toggle all claims button
            document.getElementById('toggleAllClaims').addEventListener('click', () => {
                toggleAllClaimTypes();
            });
            
            // Sidebar resize functionality
            initializeSidebarResize();
            
            // View splitter functionality
            initializeViewSplitter();
            
            // Keyboard shortcuts for zoom and pan
            document.addEventListener('keydown', handleKeyboardShortcuts);
        }

        function handleKeyboardShortcuts(event) {
            // Only handle shortcuts when timeline is visible and not typing in inputs
            if ((currentView !== 'timeline' && currentView !== 'both') || event.target.tagName === 'INPUT') return;
            
            const panAmount = event.ctrlKey ? 0.2 : 0.1; // Faster pan with Ctrl
            const zoomFactor = event.ctrlKey ? 1.5 : 1.2; // Faster zoom with Ctrl
            
            switch(event.key) {
                case '+':
                case '=':
                    event.preventDefault();
                    console.log('SEMANTIC ZOOM: Keyboard zoom in');
                    zoomIn();
                    break;
                case '-':
                    event.preventDefault();
                    console.log('SEMANTIC ZOOM: Keyboard zoom out');
                    zoomOut();
                    break;
                case '0':
                    event.preventDefault();
                    console.log('SEMANTIC ZOOM: Keyboard reset zoom');
                    resetZoom();
                    break;
                case 'f':
                case 'F':
                    event.preventDefault();
                    console.log('SEMANTIC ZOOM: Keyboard zoom to fit');
                    resetZoom();
                    break;
                case 'ArrowLeft':
                    if (event.shiftKey && svg && zoom) {
                        event.preventDefault();
                        const width = svg.node().clientWidth;
                        svg.transition().duration(150).call(zoom.translateBy, width * panAmount, 0);
                    }
                    break;
                case 'ArrowRight':
                    if (event.shiftKey && svg && zoom) {
                        event.preventDefault();
                        const width = svg.node().clientWidth;
                        svg.transition().duration(150).call(zoom.translateBy, -width * panAmount, 0);
                    }
                    break;
                case 'ArrowUp':
                    if (event.shiftKey && svg && zoom) {
                        event.preventDefault();
                        const height = svg.node().clientHeight;
                        svg.transition().duration(150).call(zoom.translateBy, 0, height * panAmount);
                    }
                    break;
                case 'ArrowDown':
                    if (event.shiftKey && svg && zoom) {
                        event.preventDefault();
                        const height = svg.node().clientHeight;
                        svg.transition().duration(150).call(zoom.translateBy, 0, -height * panAmount);
                    }
                    break;
                case 'Home':
                    event.preventDefault();
                    panToStart();
                    break;
                case 'End':
                    event.preventDefault();
                    panToEnd();
                    break;
            }
        }

        function zoomIn() {
            if (currentZoomLevel < zoomLevels.length - 1) {
                currentZoomLevel++;
                console.log('SEMANTIC ZOOM: Zooming in to level', currentZoomLevel, '(' + zoomLevels[currentZoomLevel].name + ')');
                addDebugInfo('Zoomed in to ' + zoomLevels[currentZoomLevel].name, 'success');
                updateTimeAxis();
                updateZoomIndicator();
            } else {
                console.log('SEMANTIC ZOOM: Already at maximum zoom level');
                addDebugInfo('Maximum zoom level reached', 'info');
            }
        }
        
        function zoomOut() {
            if (currentZoomLevel > 0) {
                currentZoomLevel--;
                console.log('SEMANTIC ZOOM: Zooming out to level', currentZoomLevel, '(' + zoomLevels[currentZoomLevel].name + ')');
                addDebugInfo('Zoomed out to ' + zoomLevels[currentZoomLevel].name, 'success');
                updateTimeAxis();
                updateZoomIndicator();
            } else {
                console.log('SEMANTIC ZOOM: Already at minimum zoom level');
                addDebugInfo('Minimum zoom level reached', 'info');
            }
        }
        
        function resetZoom() {
            currentZoomLevel = 1; // Default to months
            console.log('SEMANTIC ZOOM: Reset to default level', currentZoomLevel, '(' + zoomLevels[currentZoomLevel].name + ')');
            addDebugInfo('Zoom reset to ' + zoomLevels[currentZoomLevel].name, 'success');
            updateTimeAxis();
            updateZoomIndicator();
        }
        
        function updateTimeAxis() {
            if (!svg || !xScale || !timelineData) return;
            
            const currentLevel = zoomLevels[currentZoomLevel];
            console.log('SEMANTIC ZOOM: Updating time axis for', currentLevel.name);
            
            // Create new axis with appropriate ticks and format
            const xAxis = d3.axisBottom(xScale)
                .tickFormat(currentLevel.tickFormat)
                .ticks(currentLevel.ticks);
            
            // Update the x-axis
            svg.select('.x-axis')
                .transition()
                .duration(300)
                .call(xAxis);
                
            console.log('SEMANTIC ZOOM: Time axis updated');
        }

        function handleZoomStart(event) {
            // Add visual feedback when zooming starts
            const sourceType = event.sourceEvent?.type;
            if (sourceType === 'wheel') {
                svg.classed('zooming', true);
            } else if (sourceType === 'mousedown') {
                svg.classed('panning', true);
            }
        }

        function handleZoomEnd(event) {
            // Reset cursor classes when zooming ends
            svg.classed('zooming', false).classed('panning', false);
            
            // Snap to reasonable zoom levels if close
            const k = event.transform.k;
            if (Math.abs(k - 1) < 0.05) {
                svg.transition().duration(200).call(zoom.scaleTo, 1);
            }
            
            // Constrain panning to keep content visible
            constrainPanning();
        }

        function handleDoubleClick(event) {
            // Double-click to zoom to fit or reset
            event.preventDefault();
            
            const clickPoint = d3.pointer(event);
            
            if (currentTransform.k < 1.5) {
                // Zoom in to the clicked point
                svg.transition().duration(400).call(
                    zoom.transform,
                    d3.zoomIdentity.translate(-clickPoint[0] * 2 + svg.node().clientWidth / 2, -clickPoint[1] * 2 + svg.node().clientHeight / 2).scale(3)
                );
            } else {
                // Reset to fit
                zoomToFit();
            }
        }

        function handleRightClick(event) {
            event.preventDefault();
            // Show context menu with zoom options
            showContextMenu(event);
        }

        function zoomToFit() {
            if (!timelineData || !timelineData.claims.length) return;
            
            const container = svg.node();
            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;
            
            // Calculate bounds of all visible claims
            const visibleClaims = timelineData.claims.filter(claim => visibleClaimTypes.has(claim.type));
            if (visibleClaims.length === 0) return;
            
            const margin = { top: 40, right: 40, bottom: 80, left: 200 };
            const availableWidth = containerWidth - margin.left - margin.right;
            const availableHeight = containerHeight - margin.top - margin.bottom;
            
            // Calculate the scale needed to fit all data
            const dateExtent = d3.extent(visibleClaims.flatMap(d => [new Date(d.startDate), new Date(d.endDate)]));
            const timeSpan = dateExtent[1].getTime() - dateExtent[0].getTime();
            const claimCount = visibleClaims.length;
            
            const scaleX = availableWidth / (xScale(dateExtent[1]) - xScale(dateExtent[0]));
            const scaleY = availableHeight / (yScale.range()[1] - yScale.range()[0]);
            const scale = Math.min(scaleX, scaleY, 5); // Cap at 5x zoom
            
            // Center the view on the data
            const centerX = (xScale(dateExtent[0]) + xScale(dateExtent[1])) / 2;
            const centerY = yScale.range()[1] / 2;
            
            const transform = d3.zoomIdentity
                .translate(containerWidth / 2 - centerX * scale, containerHeight / 2 - centerY * scale)
                .scale(scale);
            
            svg.transition().duration(750).call(zoom.transform, transform);
        }

        function constrainPanning() {
            if (!timelineData || !xScale || !yScale) return;
            
            const container = svg.node();
            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;
            
            // Get current transform
            const t = currentTransform;
            
            // Calculate content bounds
            const contentWidth = xScale.range()[1] - xScale.range()[0];
            const contentHeight = yScale.range()[1] - yScale.range()[0];
            
            // Calculate maximum allowed translation
            const maxTranslateX = Math.max(0, (contentWidth * t.k - containerWidth) / 2);
            const maxTranslateY = Math.max(0, (contentHeight * t.k - containerHeight) / 2);
            
            // Constrain translation
            let newX = Math.max(-maxTranslateX, Math.min(maxTranslateX, t.x));
            let newY = Math.max(-maxTranslateY, Math.min(maxTranslateY, t.y));
            
            // Apply constrained transform if needed
            if (newX !== t.x || newY !== t.y) {
                const constrainedTransform = d3.zoomIdentity.translate(newX, newY).scale(t.k);
                svg.transition().duration(300).call(zoom.transform, constrainedTransform);
            }
        }

        function panToStart() {
            if (!xScale || !timelineData) return;
            
            const startDate = timelineData.dateRange.start;
            const targetX = xScale(startDate);
            const containerWidth = svg.node().clientWidth;
            
            const transform = d3.zoomIdentity
                .translate(-targetX * currentTransform.k + containerWidth * 0.1, currentTransform.y)
                .scale(currentTransform.k);
            
            svg.transition().duration(500).call(zoom.transform, transform);
        }

        function panToEnd() {
            if (!xScale || !timelineData) return;
            
            const endDate = timelineData.dateRange.end;
            const targetX = xScale(endDate);
            const containerWidth = svg.node().clientWidth;
            
            const transform = d3.zoomIdentity
                .translate(-targetX * currentTransform.k + containerWidth * 0.9, currentTransform.y)
                .scale(currentTransform.k);
            
            svg.transition().duration(500).call(zoom.transform, transform);
        }

        function showContextMenu(event) {
            // Remove existing context menu
            d3.selectAll('.context-menu').remove();
            
            const menu = d3.select('body')
                .append('div')
                .attr('class', 'context-menu')
                .style('position', 'absolute')
                .style('left', event.pageX + 'px')
                .style('top', event.pageY + 'px')
                .style('background', 'var(--vscode-menu-background)')
                .style('border', '1px solid var(--vscode-menu-border)')
                .style('border-radius', '4px')
                .style('padding', '4px 0')
                .style('box-shadow', '0 2px 8px rgba(0,0,0,0.3)')
                .style('z-index', '1000')
                .style('font-size', '12px')
                .style('min-width', '150px');
            
            const menuItems = [
                { text: 'Zoom In', action: () => svg.transition().duration(200).call(zoom.scaleBy, 1.4) },
                { text: 'Zoom Out', action: () => svg.transition().duration(200).call(zoom.scaleBy, 1/1.4) },
                { text: 'Zoom to Fit', action: zoomToFit },
                { text: 'Reset View', action: () => svg.transition().duration(400).call(zoom.transform, d3.zoomIdentity) },
                { text: '---', action: null },
                { text: 'Pan to Start', action: panToStart },
                { text: 'Pan to End', action: panToEnd }
            ];
            
            menuItems.forEach(item => {
                if (item.text === '---') {
                    menu.append('div')
                        .style('height', '1px')
                        .style('background', 'var(--vscode-menu-separatorBackground)')
                        .style('margin', '4px 0');
                } else {
                    menu.append('div')
                        .text(item.text)
                        .style('padding', '6px 12px')
                        .style('cursor', 'pointer')
                        .style('color', 'var(--vscode-menu-foreground)')
                        .on('mouseover', function() {
                            d3.select(this).style('background', 'var(--vscode-menu-selectionBackground)');
                        })
                        .on('mouseout', function() {
                            d3.select(this).style('background', 'transparent');
                        })
                        .on('click', () => {
                            if (item.action) item.action();
                            menu.remove();
                        });
                }
            });
            
            // Remove menu when clicking elsewhere
            d3.select('body').on('click.context-menu', () => {
                menu.remove();
                d3.select('body').on('click.context-menu', null);
            });
        }

        function updateZoomIndicator() {
            const currentLevel = zoomLevels[currentZoomLevel];
            const zoomText = currentLevel.name;
            
            // Set color based on zoom level
            let zoomColor = 'var(--vscode-descriptionForeground)';
            if (currentZoomLevel === 0) {
                zoomColor = 'var(--vscode-charts-blue)'; // Years - zoomed out
            } else if (currentZoomLevel === 1) {
                zoomColor = 'var(--vscode-charts-green)'; // Months - normal
            } else if (currentZoomLevel === 2) {
                zoomColor = 'var(--vscode-charts-orange)'; // Weeks - zoomed in
            } else if (currentZoomLevel === 3) {
                zoomColor = 'var(--vscode-charts-red)'; // Days - very zoomed in
            }
            
            // Update zoom level display
            const zoomInfo = document.getElementById('zoomInfo');
            if (zoomInfo) {
                zoomInfo.textContent = zoomText;
                zoomInfo.style.color = zoomColor;
                zoomInfo.title = 'Current time scale: ' + zoomText + '\\nZoom in for more detail, zoom out for broader view\\nShortcuts: +/- keys, 0 to reset';
            }
            
            // Update button titles with current zoom level and shortcuts
            const zoomInBtn = document.getElementById('zoomIn');
            const zoomOutBtn = document.getElementById('zoomOut');
            const zoomToFitBtn = document.getElementById('zoomToFit');
            const resetBtn = document.getElementById('resetZoom');
            
            if (zoomInBtn) {
                zoomInBtn.title = 'Zoom In (+) - Show more detail\\nCurrent: ' + zoomText + '\\nShortcut: + or = key';
                zoomInBtn.disabled = currentZoomLevel >= zoomLevels.length - 1;
            }
            if (zoomOutBtn) {
                zoomOutBtn.title = 'Zoom Out (-) - Show broader view\\nCurrent: ' + zoomText + '\\nShortcut: - key';
                zoomOutBtn.disabled = currentZoomLevel <= 0;
            }
            if (zoomToFitBtn) {
                zoomToFitBtn.title = 'Reset to Default View\\nShortcut: F key';
            }
            if (resetBtn) {
                resetBtn.title = 'Reset to Default View\\nShortcut: 0 key';
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

                // Initialize claim type configurations and visibility
                initializeClaimTypes();
                
                const loadingElement = document.getElementById('loading');
                const timelineElement = document.getElementById('timeline');

                if (loadingElement) loadingElement.style.display = 'none';
                if (timelineElement) timelineElement.style.display = 'block';

                renderLegend();
                renderTimeline();
                updateStats();
                
                // Re-apply zoom behavior after timeline is rendered
                setTimeout(() => {
                    updateZoomBehavior();
                }, 100);
                
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
                } else {
                    legendItem.classList.add('active');
                }

                legendItem.innerHTML = \`
                    <div class="legend-color" style="background-color: \${config.color}"></div>
                    <div class="legend-content">
                        <div class="legend-text">\${config.displayName}</div>
                        <div class="legend-count">\${config.count} claim\${config.count !== 1 ? 's' : ''}</div>
                    </div>
                \`;

                legendItem.addEventListener('click', () => toggleClaimType(type));
                
                legendItem.title = \`Click to \${config.visible ? 'hide' : 'show'} \${config.displayName}\\n\${config.count} claim\${config.count !== 1 ? 's' : ''} of this type\`;

                legendContainer.appendChild(legendItem);
            });
            
            // Update toggle all button text
            updateToggleAllButton();
        }
        
        function toggleAllClaimTypes() {
            const allVisible = visibleClaimTypes.size === claimTypeConfigs.size;
            
            if (allVisible) {
                // Hide all
                visibleClaimTypes.clear();
                claimTypeConfigs.forEach((config) => {
                    config.visible = false;
                });
            } else {
                // Show all
                claimTypeConfigs.forEach((config, type) => {
                    config.visible = true;
                    visibleClaimTypes.add(type);
                });
            }
            
            // Update legend visual state
            renderLegend();
            updateTimelineVisibility();
            updateStats();
        }
        
        function updateToggleAllButton() {
            const toggleButton = document.getElementById('toggleAllClaims');
            const allVisible = visibleClaimTypes.size === claimTypeConfigs.size;
            const noneVisible = visibleClaimTypes.size === 0;
            
            if (noneVisible) {
                toggleButton.textContent = 'Show All';
                toggleButton.title = 'Show all claim types';
            } else if (allVisible) {
                toggleButton.textContent = 'Hide All';
                toggleButton.title = 'Hide all claim types';
            } else {
                toggleButton.textContent = 'Show All';
                toggleButton.title = \`Show all claim types (\${visibleClaimTypes.size}/\${claimTypeConfigs.size} visible)\`;
            }
        }
        
        function initializeSidebarResize() {
            const sidebar = document.querySelector('.timeline-sidebar');
            const resizeHandle = document.getElementById('sidebarResizeHandle');
            let isResizing = false;
            let startX = 0;
            let startWidth = 0;
            
            resizeHandle.addEventListener('mousedown', (e) => {
                isResizing = true;
                startX = e.clientX;
                startWidth = parseInt(document.defaultView.getComputedStyle(sidebar).width, 10);
                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none';
                e.preventDefault();
            });
            
            document.addEventListener('mousemove', (e) => {
                if (!isResizing) return;
                
                const width = startWidth + e.clientX - startX;
                const minWidth = 140;
                const maxWidth = 350;
                const constrainedWidth = Math.max(minWidth, Math.min(maxWidth, width));
                
                sidebar.style.width = constrainedWidth + 'px';
                
                // Trigger timeline re-render if needed
                if ((currentView === 'timeline' || currentView === 'both') && svg && timelineData) {
                    // Debounce the re-render
                    clearTimeout(window.resizeTimeout);
                    window.resizeTimeout = setTimeout(() => {
                        renderTimeline();
                    }, 100);
                }
            });
            
            document.addEventListener('mouseup', () => {
                if (isResizing) {
                    isResizing = false;
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';
                }
            });
        }
        
        function initializeViewSplitter() {
            const splitter = document.getElementById('viewSplitter');
            const timelineGraphSection = document.getElementById('timelineGraphSection');
            const timelineTableSection = document.getElementById('timelineTableSection');
            let isResizing = false;
            let startY = 0;
            let startGraphHeight = 0;
            let startTableHeight = 0;
            
            splitter.addEventListener('mousedown', (e) => {
                if (currentView !== 'both') return;
                
                isResizing = true;
                startY = e.clientY;
                startGraphHeight = timelineGraphSection.offsetHeight;
                startTableHeight = timelineTableSection.offsetHeight;
                document.body.style.cursor = 'row-resize';
                document.body.style.userSelect = 'none';
                e.preventDefault();
            });
            
            document.addEventListener('mousemove', (e) => {
                if (!isResizing || currentView !== 'both') return;
                
                const deltaY = e.clientY - startY;
                const totalHeight = startGraphHeight + startTableHeight;
                const newGraphHeight = startGraphHeight + deltaY;
                const newTableHeight = startTableHeight - deltaY;
                
                // Constrain heights
                const minHeight = 150;
                const maxGraphHeight = totalHeight - minHeight;
                const maxTableHeight = totalHeight - minHeight;
                
                if (newGraphHeight >= minHeight && newGraphHeight <= maxGraphHeight &&
                    newTableHeight >= minHeight && newTableHeight <= maxTableHeight) {
                    
                    const graphPercent = (newGraphHeight / totalHeight) * 100;
                    const tablePercent = (newTableHeight / totalHeight) * 100;
                    
                    timelineGraphSection.style.flex = \`0 0 \${graphPercent}%\`;
                    timelineTableSection.style.flex = \`0 0 \${tablePercent}%\`;
                    
                    // Trigger timeline re-render
                    if (svg && timelineData) {
                        clearTimeout(window.splitterTimeout);
                        window.splitterTimeout = setTimeout(() => {
                            renderTimeline();
                        }, 50);
                    }
                }
            });
            
            document.addEventListener('mouseup', () => {
                if (isResizing) {
                    isResizing = false;
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';
                }
            });
        }
        
        function updateTimelineWithSearch() {
            if (!svg || !timelineData || currentView !== 'both') return;
            
            // Get the same filtered claims as the table
            const searchQuery = tableState.searchQuery.toLowerCase();
            
            svg.selectAll('.claim-bar')
                .transition()
                .duration(300)
                .style('opacity', d => {
                    // Check visibility first
                    if (!visibleClaimTypes.has(d.type)) return 0;
                    
                    // Check search query
                    if (searchQuery) {
                        const searchableText = [
                            d.id,
                            d.type,
                            d.displayName,
                            d.startDate.toLocaleDateString(),
                            d.endDate.toLocaleDateString(),
                            JSON.stringify(d.details)
                        ].join(' ').toLowerCase();
                        
                        if (!searchableText.includes(searchQuery)) return 0.2; // Dimmed but visible
                    }
                    
                    return 1;
                })
                .style('pointer-events', d => {
                    if (!visibleClaimTypes.has(d.type)) return 'none';
                    return 'all';
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
                legendItem.classList.toggle('active', config.visible);
                legendItem.title = \`Click to \${config.visible ? 'hide' : 'show'} \${config.displayName}\\n\${config.count} claim\${config.count !== 1 ? 's' : ''} of this type\`;
            }

            // Update toggle all button
            updateToggleAllButton();

            // Update timeline
            updateTimelineVisibility();
            updateStats();
        }

        function updateTimelineVisibility() {
            if (visibleClaimTypes.size === 0) {
                // Show empty state
                if (currentView === 'timeline' || currentView === 'both') {
                    document.getElementById('timeline').style.display = 'none';
                    document.getElementById('emptyState').style.display = 'flex';
                }
                if (currentView === 'table' || currentView === 'both') {
                    renderTable();
                }
                return;
            }

            if (currentView === 'timeline' || currentView === 'both') {
                document.getElementById('timeline').style.display = 'block';
                document.getElementById('emptyState').style.display = 'none';

                // Update claim bar visibility with animation
                if (svg) {
                    svg.selectAll('.claim-bar')
                        .transition()
                        .duration(300)
                        .style('opacity', d => visibleClaimTypes.has(d.type) ? 1 : 0)
                        .style('pointer-events', d => visibleClaimTypes.has(d.type) ? 'all' : 'none');
                }
            }
            
            if (currentView === 'table' || currentView === 'both') {
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

                // Get the correct container based on current view
                const container = currentView === 'both' 
                    ? document.getElementById('timelineGraphSection')
                    : document.querySelector('.timeline-content');
                const containerRect = container.getBoundingClientRect();
                const width = Math.max(800, containerRect.width); // Much larger minimum width since we have more space
                const height = Math.max(currentView === 'both' ? 300 : 600, containerRect.height); // Adjust height for both view
                
                const margin = { 
                    top: 40, 
                    right: 40, 
                    bottom: 100, // More space for rotated labels
                    left: Math.max(150, Math.min(300, width * 0.3)) // Even more space for claim names
                };
                
                const innerWidth = Math.max(600, width - margin.left - margin.right); // Much larger minimum
                const innerHeight = Math.max(400, height - margin.top - margin.bottom); // Much larger minimum

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

                // Create main container with margins
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
                        
                        const maxLength = Math.floor(margin.left / 6); // More characters allowed
                        const displayName = claim.displayName || (claim.type + ' ' + claim.id);
                        return displayName.length > maxLength ? 
                            displayName.substring(0, maxLength - 3) + '...' : 
                            displayName;
                    });

                // Add axes to main group
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

                // Add claim bars to main group
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
                
                // Re-apply zoom behavior after rendering
                console.log('WEBVIEW DIAGNOSTIC: Re-applying zoom behavior after render');
                addDebugInfo('Timeline rendered, updating zoom behavior');
                
                // Check SVG dimensions after rendering
                const svgNode = svg.node();
                const rect = svgNode.getBoundingClientRect();
                addDebugInfo('SVG dimensions after render: ' + rect.width + 'x' + rect.height);
                
                updateZoomBehavior();

            } catch (error) {
                console.error('WEBVIEW DIAGNOSTIC: Error rendering timeline:', error);
                showError('Failed to render timeline: ' + error.message);
            }
        }

        function handleClaimClick(event, d) {
            console.log('WEBVIEW DIAGNOSTIC: Claim clicked:', d);
            
            // Highlight in table if both view is active
            if (currentView === 'both') {
                highlightClaimInTable(d.id);
            }
            
            vscode.postMessage({
                command: 'select',
                payload: d.id
            });
        }
        
        function highlightClaimInTable(claimId) {
            // Remove previous selections
            document.querySelectorAll('.claims-table tr.selected').forEach(row => {
                row.classList.remove('selected');
            });
            
            // Highlight the selected claim
            const row = document.querySelector(\`[data-claim-id="\${claimId}"]\`);
            if (row) {
                row.classList.add('selected');
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
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

        // View Functions
        function switchView(view) {
            currentView = view;
            
            // Update button states
            document.getElementById('timelineViewBtn').classList.toggle('active', view === 'timeline');
            document.getElementById('tableViewBtn').classList.toggle('active', view === 'table');
            document.getElementById('bothViewBtn').classList.toggle('active', view === 'both');
            
            const timelineContent = document.querySelector('.timeline-content');
            const timelineGraphSection = document.getElementById('timelineGraphSection');
            const timelineTableSection = document.getElementById('timelineTableSection');
            const viewSplitter = document.getElementById('viewSplitter');
            const timeline = document.getElementById('timeline');
            const emptyState = document.getElementById('emptyState');
            const zoomHint = document.getElementById('zoomHint');
            
            // Reset classes
            timelineContent.classList.remove('both-view');
            
            if (view === 'timeline') {
                // Timeline only view
                timelineGraphSection.style.display = 'block';
                timelineTableSection.style.display = 'none';
                viewSplitter.style.display = 'none';
                timeline.style.display = 'block';
                emptyState.style.display = visibleClaimTypes.size === 0 ? 'flex' : 'none';
                zoomHint.style.display = 'none';
                
                // Re-apply zoom behavior for timeline view and preserve transform
                setTimeout(() => {
                    const savedTransform = currentTransform;
                    updateZoomBehavior();
                    if (svg && zoom && savedTransform) {
                        svg.call(zoom.transform, savedTransform);
                    }
                }, 50);
                
                // Show zoom hint after a delay
                setTimeout(() => {
                    if (zoomHint && currentView === 'timeline') {
                        zoomHint.style.display = 'block';
                        setTimeout(() => {
                            zoomHint.style.display = 'none';
                        }, 4000);
                    }
                }, 1000);
                
            } else if (view === 'table') {
                // Table only view
                timelineGraphSection.style.display = 'none';
                timelineTableSection.style.display = 'block';
                viewSplitter.style.display = 'none';
                timeline.style.display = 'none';
                emptyState.style.display = 'none';
                zoomHint.style.display = 'none';
                renderTable();
                
            } else if (view === 'both') {
                // Both views
                timelineContent.classList.add('both-view');
                timelineGraphSection.style.display = 'block';
                timelineTableSection.style.display = 'block';
                viewSplitter.style.display = 'block';
                timeline.style.display = 'block';
                emptyState.style.display = visibleClaimTypes.size === 0 ? 'flex' : 'none';
                zoomHint.style.display = 'none';
                
                // Render both views
                renderTable();
                
                // Re-render timeline to adjust for new size
                setTimeout(() => {
                    if (timelineData && svg) {
                        const savedTransform = currentTransform;
                        renderTimeline();
                        // Re-apply zoom behavior after timeline is rendered and restore transform
                        updateZoomBehavior();
                        if (zoom && savedTransform) {
                            svg.call(zoom.transform, savedTransform);
                        }
                    }
                }, 100);
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
            
            // Highlight in timeline if both view is active
            if (currentView === 'both') {
                highlightClaimInTimeline(claimId);
            }
            
            // Send selection message to extension
            vscode.postMessage({
                command: 'select',
                payload: claimId
            });
        }
        
        function highlightClaimInTimeline(claimId) {
            if (!svg) return;
            
            // Reset all claim bars
            svg.selectAll('.claim-bar')
                .style('stroke-width', 1)
                .style('stroke', 'var(--vscode-panel-border)');
            
            // Highlight the selected claim
            svg.selectAll('.claim-bar')
                .filter(d => d.id === claimId)
                .style('stroke-width', 3)
                .style('stroke', 'var(--vscode-focusBorder)');
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
