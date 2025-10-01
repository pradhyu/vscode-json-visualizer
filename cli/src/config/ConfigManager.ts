import * as fs from 'fs';
import * as path from 'path';
import { ParserConfig } from '../parser/ClaimsParser';

export interface CliOptions {
  config?: string;
  format?: string;
  theme?: string;
  title?: string;
  interactive?: boolean;
  width?: string;
  height?: string;
}

export class ConfigManager {
  private config: ParserConfig = {};

  constructor() {
    this.setDefaults();
  }

  private setDefaults(): void {
    this.config = {
      rxTbaPath: 'rxTba',
      rxHistoryPath: 'rxHistory',
      medHistoryPath: 'medHistory',
      dateFormat: 'YYYY-MM-DD',
      colors: {
        rxTba: '#FF6B6B',
        rxHistory: '#4ECDC4',
        medHistory: '#45B7D1'
      }
    };
  }

  async loadConfig(configPath: string): Promise<void> {
    try {
      const configContent = await fs.promises.readFile(configPath, 'utf-8');
      const userConfig = JSON.parse(configContent);
      
      // Merge with defaults
      this.config = {
        ...this.config,
        ...userConfig,
        colors: {
          ...this.config.colors,
          ...userConfig.colors
        }
      };
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        throw new Error(`Configuration file not found: ${configPath}`);
      }
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in configuration file: ${configPath}. ${error.message}`);
      }
      throw error;
    }
  }

  updateFromCliOptions(options: CliOptions): void {
    if (options.format) {
      this.config.dateFormat = options.format;
    }
  }

  getConfig(): ParserConfig {
    return { ...this.config };
  }

  async saveConfig(configPath: string): Promise<void> {
    const configDir = path.dirname(configPath);
    await fs.promises.mkdir(configDir, { recursive: true });
    await fs.promises.writeFile(configPath, JSON.stringify(this.config, null, 2));
  }

  validateConfig(): string[] {
    const errors: string[] = [];

    // Validate date format
    const validFormats = ['YYYY-MM-DD', 'MM/DD/YYYY', 'DD-MM-YYYY', 'YYYY/MM/DD', 'DD/MM/YYYY', 'MM-DD-YYYY'];
    if (this.config.dateFormat && !validFormats.includes(this.config.dateFormat)) {
      errors.push(`Invalid date format: ${this.config.dateFormat}. Valid formats: ${validFormats.join(', ')}`);
    }

    // Validate colors
    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (this.config.colors) {
      Object.entries(this.config.colors).forEach(([type, color]) => {
        if (color && !hexColorRegex.test(color)) {
          errors.push(`Invalid color for ${type}: ${color}. Must be a valid hex color (e.g., #FF6B6B)`);
        }
      });
    }

    return errors;
  }

  static async createSampleConfig(outputPath: string): Promise<void> {
    const sampleConfig = {
      rxTbaPath: 'rxTba',
      rxHistoryPath: 'rxHistory',
      medHistoryPath: 'medHistory',
      dateFormat: 'YYYY-MM-DD',
      colors: {
        rxTba: '#FF6B6B',
        rxHistory: '#4ECDC4',
        medHistory: '#45B7D1'
      }
    };

    const configDir = path.dirname(outputPath);
    await fs.promises.mkdir(configDir, { recursive: true });
    await fs.promises.writeFile(outputPath, JSON.stringify(sampleConfig, null, 2));
  }
}