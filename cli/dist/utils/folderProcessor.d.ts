import { ClaimsParser } from '../parser/ClaimsParser';
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
    errors: Array<{
        file: string;
        error: string;
    }>;
    summary: {
        totalClaims: number;
        claimTypes: Set<string>;
        dateRange: {
            start: Date;
            end: Date;
        } | null;
    };
}
export declare class FolderProcessor {
    private parser;
    constructor(parser: ClaimsParser);
    scanFolder(folderPath: string, recursive?: boolean): Promise<JsonFileInfo[]>;
    private scanDirectory;
    private analyzeJsonFile;
    processFolder(folderPath: string, options?: FolderProcessingOptions): Promise<FolderProcessingResult>;
    listFiles(folderPath: string, recursive?: boolean): Promise<JsonFileInfo[]>;
}
//# sourceMappingURL=folderProcessor.d.ts.map