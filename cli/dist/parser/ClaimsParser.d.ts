export interface ClaimItem {
    id: string;
    type: string;
    displayName: string;
    color: string;
    startDate: Date;
    endDate: Date;
    details: Record<string, any>;
}
export interface TimelineData {
    claims: ClaimItem[];
    dateRange: {
        start: Date;
        end: Date;
    };
    metadata: {
        totalClaims: number;
        claimTypes: string[];
    };
}
export interface ParserConfig {
    rxTbaPath?: string;
    rxHistoryPath?: string;
    medHistoryPath?: string;
    dateFormat?: string;
    colors?: {
        rxTba?: string;
        rxHistory?: string;
        medHistory?: string;
    };
}
export declare class ClaimsParser {
    private config;
    constructor(config?: ParserConfig);
    parseFile(filePath: string): Promise<TimelineData>;
    parseData(data: any): TimelineData;
    private parseRxClaims;
    private parseMedHistoryClaims;
    private parseDate;
}
//# sourceMappingURL=ClaimsParser.d.ts.map