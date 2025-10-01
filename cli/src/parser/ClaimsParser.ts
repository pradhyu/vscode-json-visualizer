import * as fs from 'fs';
import * as path from 'path';
import moment from 'moment';

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

export class ClaimsParser {
  private config: ParserConfig;

  constructor(config: ParserConfig = {}) {
    this.config = {
      rxTbaPath: 'rxTba',
      rxHistoryPath: 'rxHistory',
      medHistoryPath: 'medHistory',
      dateFormat: 'YYYY-MM-DD',
      colors: {
        rxTba: '#FF6B6B',
        rxHistory: '#4ECDC4',
        medHistory: '#45B7D1'
      },
      ...config
    };
  }

  async parseFile(filePath: string): Promise<TimelineData> {
    try {
      const fileContent = await fs.promises.readFile(filePath, 'utf-8');
      const jsonData = JSON.parse(fileContent);
      return this.parseData(jsonData);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        throw new Error(`File not found: ${filePath}`);
      }
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in file: ${filePath}. ${error.message}`);
      }
      throw error;
    }
  }

  parseData(data: any): TimelineData {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid data: Expected JSON object');
    }

    const claims: ClaimItem[] = [];

    // Parse rxTba claims
    if (data[this.config.rxTbaPath!] && Array.isArray(data[this.config.rxTbaPath!])) {
      const rxTbaClaims = this.parseRxClaims(data[this.config.rxTbaPath!], 'rxTba');
      claims.push(...rxTbaClaims);
    }

    // Parse rxHistory claims
    if (data[this.config.rxHistoryPath!] && Array.isArray(data[this.config.rxHistoryPath!])) {
      const rxHistoryClaims = this.parseRxClaims(data[this.config.rxHistoryPath!], 'rxHistory');
      claims.push(...rxHistoryClaims);
    }

    // Parse medHistory claims
    if (data[this.config.medHistoryPath!]) {
      const medHistoryClaims = this.parseMedHistoryClaims(data[this.config.medHistoryPath!]);
      claims.push(...medHistoryClaims);
    }

    if (claims.length === 0) {
      throw new Error('No valid claims found in the data');
    }

    // Sort claims by start date (most recent first)
    claims.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());

    // Calculate date range
    const startDates = claims.map(claim => claim.startDate);
    const endDates = claims.map(claim => claim.endDate);
    
    const overallStart = new Date(Math.min(...startDates.map(d => d.getTime())));
    const overallEnd = new Date(Math.max(...endDates.map(d => d.getTime())));

    // Get unique claim types
    const claimTypes = [...new Set(claims.map(claim => claim.type))];

    return {
      claims,
      dateRange: {
        start: overallStart,
        end: overallEnd
      },
      metadata: {
        totalClaims: claims.length,
        claimTypes
      }
    };
  }

  private parseRxClaims(rxData: any[], type: 'rxTba' | 'rxHistory'): ClaimItem[] {
    const claims: ClaimItem[] = [];
    const color = this.config.colors![type]!;

    rxData.forEach((claim, index) => {
      try {
        // Parse start date
        const startDate = this.parseDate(claim.dos || claim.dateOfService);
        
        // Calculate end date (start date + days supply)
        const daysSupply = parseInt(claim.dayssupply || claim.daysSupply || '30');
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + daysSupply);

        // Create display name
        const displayName = claim.medication || claim.drugName || claim.displayName || `${type} Claim ${index + 1}`;

        claims.push({
          id: claim.id || `${type}-${index + 1}`,
          type,
          displayName,
          color,
          startDate,
          endDate,
          details: {
            ...claim,
            daysSupply,
            medication: displayName,
            dosage: claim.dosage || 'N/A',
            prescriber: claim.prescriber || 'N/A',
            pharmacy: claim.pharmacy || 'N/A',
            ndc: claim.ndc || 'N/A',
            quantity: claim.quantity || 'N/A',
            copay: claim.copay || 'N/A'
          }
        });
      } catch (error) {
        console.warn(`Warning: Skipping invalid ${type} claim at index ${index}: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    return claims;
  }

  private parseMedHistoryClaims(medHistoryData: any): ClaimItem[] {
    const claims: ClaimItem[] = [];
    const color = this.config.colors!.medHistory!;

    // Handle both direct array and nested structure
    const claimsArray = medHistoryData.claims || medHistoryData;
    
    if (!Array.isArray(claimsArray)) {
      throw new Error('medHistory data must contain a claims array');
    }

    claimsArray.forEach((claim, claimIndex) => {
      if (!claim.lines || !Array.isArray(claim.lines)) {
        console.warn(`Warning: medHistory claim ${claimIndex} has no lines array`);
        return;
      }

      claim.lines.forEach((line: any, lineIndex: number) => {
        try {
          const startDate = this.parseDate(line.srvcStart || line.serviceStart);
          const endDate = line.srvcEnd || line.serviceEnd 
            ? this.parseDate(line.srvcEnd || line.serviceEnd)
            : startDate;

          const displayName = line.description || line.serviceType || 
                            claim.provider || `Medical Service ${claimIndex + 1}-${lineIndex + 1}`;

          claims.push({
            id: line.lineId || `med-${claimIndex + 1}-${lineIndex + 1}`,
            type: 'medHistory',
            displayName,
            color,
            startDate,
            endDate,
            details: {
              ...line,
              claimId: claim.claimId,
              provider: claim.provider || 'N/A',
              serviceType: line.serviceType || line.description || 'N/A',
              chargedAmount: line.chargedAmount || 'N/A',
              allowedAmount: line.allowedAmount || 'N/A',
              paidAmount: line.paidAmount || 'N/A',
              procedureCode: line.procedureCode || 'N/A'
            }
          });
        } catch (error) {
          console.warn(`Warning: Skipping invalid medHistory line ${claimIndex}-${lineIndex}: ${error instanceof Error ? error.message : String(error)}`);
        }
      });
    });

    return claims;
  }

  private parseDate(dateString: string): Date {
    if (!dateString) {
      throw new Error('Date string is required');
    }

    // Try parsing with configured format first
    let date = moment(dateString, this.config.dateFormat!, true);
    
    if (!date.isValid()) {
      // Try common formats
      const formats = ['YYYY-MM-DD', 'MM/DD/YYYY', 'DD-MM-YYYY', 'YYYY/MM/DD', 'DD/MM/YYYY'];
      
      for (const format of formats) {
        date = moment(dateString, format, true);
        if (date.isValid()) {
          break;
        }
      }
    }

    if (!date.isValid()) {
      // Try JavaScript Date constructor as fallback
      date = moment(new Date(dateString));
    }

    if (!date.isValid()) {
      throw new Error(`Unable to parse date: "${dateString}"`);
    }

    return date.toDate();
  }
}