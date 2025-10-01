import * as fs from 'fs';
import * as path from 'path';
import { ClaimsParser, TimelineData } from '../parser/ClaimsParser';
import { HtmlGenerator } from '../generator/HtmlGenerator';

export interface JsonFileInfo {
  name: string;
  path: string;
  size: number;
  isValidClaims: boolean;
  claimsCount?: number;
  claimTypes?: string[];
  error?: string;
}

export interface FolderProcessingOptions {
  recursive?: boolean;
  outputDir?: string;
  theme?: string;
  width?: number;
  height?: number;
  interactive?: boolean;
  openAfter?: boolean;
}

export interface FolderProcessingResult {
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  outputFiles: string[];
  errors: Array<{ file: string; error: string }>;
  summary: {
    totalClaims: number;
    claimTypes: Set<string>;
    dateRange: { start: Date; end: Date } | null;
  };
}

export class FolderProcessor {
  private parser: ClaimsParser;

  constructor(parser: ClaimsParser) {
    this.parser = parser;
  }

  async scanFolder(folderPath: string, recursive: boolean = true): Promise<JsonFileInfo[]> {
    const files: JsonFileInfo[] = [];
    
    try {
      await this.scanDirectory(folderPath, files, recursive);
    } catch (error) {
      throw new Error(`Failed to scan folder: ${error instanceof Error ? error.message : String(error)}`);
    }

    return files.sort((a, b) => a.name.localeCompare(b.name));
  }

  private async scanDirectory(dirPath: string, files: JsonFileInfo[], recursive: boolean): Promise<void> {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory() && recursive) {
        await this.scanDirectory(fullPath, files, recursive);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
        const fileInfo = await this.analyzeJsonFile(fullPath);
        files.push(fileInfo);
      }
    }
  }

  private async analyzeJsonFile(filePath: string): Promise<JsonFileInfo> {
    const stats = await fs.promises.stat(filePath);
    const fileName = path.basename(filePath);

    const fileInfo: JsonFileInfo = {
      name: fileName,
      path: filePath,
      size: stats.size,
      isValidClaims: false
    };

    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      
      // Check if it's a valid claims file
      const hasRxTba = data.rxTba && Array.isArray(data.rxTba);
      const hasRxHistory = data.rxHistory && Array.isArray(data.rxHistory);
      const hasMedHistory = data.medHistory && (data.medHistory.claims || Array.isArray(data.medHistory));
      
      if (hasRxTba || hasRxHistory || hasMedHistory) {
        fileInfo.isValidClaims = true;
        
        // Count claims
        let totalClaims = 0;
        const claimTypes: string[] = [];
        
        if (hasRxTba) {
          totalClaims += data.rxTba.length;
          claimTypes.push('rxTba');
        }
        
        if (hasRxHistory) {
          totalClaims += data.rxHistory.length;
          claimTypes.push('rxHistory');
        }
        
        if (hasMedHistory) {
          const medClaims = Array.isArray(data.medHistory) 
            ? data.medHistory.length 
            : (data.medHistory.claims ? data.medHistory.claims.reduce((total: number, claim: any) => {
                return total + (claim.lines ? claim.lines.length : 1);
              }, 0) : 0);
          totalClaims += medClaims;
          claimTypes.push('medHistory');
        }
        
        fileInfo.claimsCount = totalClaims;
        fileInfo.claimTypes = claimTypes;
      }
    } catch (error) {
      fileInfo.error = error instanceof Error ? error.message : String(error);
    }

    return fileInfo;
  }

  async processFolder(
    folderPath: string, 
    options: FolderProcessingOptions = {}
  ): Promise<FolderProcessingResult> {
    const {
      recursive = true,
      outputDir = folderPath,
      theme = 'auto',
      width = 1200,
      height = 600,
      interactive = true,
      openAfter = false
    } = options;

    // Scan folder for JSON files
    const files = await this.scanFolder(folderPath, recursive);
    const validFiles = files.filter(f => f.isValidClaims);

    const result: FolderProcessingResult = {
      totalFiles: files.length,
      processedFiles: 0,
      failedFiles: 0,
      outputFiles: [],
      errors: [],
      summary: {
        totalClaims: 0,
        claimTypes: new Set(),
        dateRange: null
      }
    };

    if (validFiles.length === 0) {
      throw new Error(`No valid medical claims JSON files found in ${folderPath}`);
    }

    // Ensure output directory exists
    await fs.promises.mkdir(outputDir, { recursive: true });

    // Process each valid file
    for (const fileInfo of validFiles) {
      try {
        console.log(`Processing: ${fileInfo.name}...`);
        
        // Parse the file
        const timelineData = await this.parser.parseFile(fileInfo.path);
        
        // Generate HTML
        const htmlGenerator = new HtmlGenerator({
          theme: theme as 'light' | 'dark' | 'auto',
          title: `Medical Claims Timeline - ${fileInfo.name}`,
          interactive,
          width,
          height
        });

        const html = htmlGenerator.generate(timelineData);
        
        // Create output filename
        const baseName = path.basename(fileInfo.name, '.json');
        const outputFileName = `${baseName}-timeline.html`;
        const outputPath = path.join(outputDir, outputFileName);
        
        // Write HTML file
        await fs.promises.writeFile(outputPath, html);
        
        result.processedFiles++;
        result.outputFiles.push(outputPath);
        
        // Update summary
        result.summary.totalClaims += timelineData.metadata.totalClaims;
        timelineData.metadata.claimTypes.forEach(type => result.summary.claimTypes.add(type));
        
        if (!result.summary.dateRange) {
          result.summary.dateRange = { ...timelineData.dateRange };
        } else {
          if (timelineData.dateRange.start < result.summary.dateRange.start) {
            result.summary.dateRange.start = timelineData.dateRange.start;
          }
          if (timelineData.dateRange.end > result.summary.dateRange.end) {
            result.summary.dateRange.end = timelineData.dateRange.end;
          }
        }
        
      } catch (error) {
        result.failedFiles++;
        result.errors.push({
          file: fileInfo.name,
          error: error instanceof Error ? error.message : String(error)
        });
        console.error(`Failed to process ${fileInfo.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return result;
  }

  async listFiles(folderPath: string, recursive: boolean = true): Promise<JsonFileInfo[]> {
    return this.scanFolder(folderPath, recursive);
  }
}