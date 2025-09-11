import * as vscode from 'vscode';

/**
 * Configuration interface for parser settings
 */
export interface ParserConfig {
    rxTbaPath: string;
    rxHistoryPath: string;
    medHistoryPath: string;
    dateFormat: string;
    colors: {
        rxTba: string;
        rxHistory: string;
        medHistory: string;
    };
    customMappings: Record<string, string>;
}

/**
 * Validation result interface
 */
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
}

/**
 * Configuration Manager for Medical Claims Timeline extension
 * Handles loading, validation, and management of extension settings
 */
export class ConfigManager {
    private static readonly EXTENSION_ID = 'medicalClaimsTimeline';
    
    /**
     * Default configuration values
     */
    private static readonly DEFAULT_CONFIG: ParserConfig = {
        rxTbaPath: 'rxTba',
        rxHistoryPath: 'rxHistory',
        medHistoryPath: 'medHistory',
        dateFormat: 'YYYY-MM-DD',
        colors: {
            rxTba: '#FF6B6B',
            rxHistory: '#4ECDC4',
            medHistory: '#45B7D1'
        },
        customMappings: {}
    };

    /**
     * Get current parser configuration from VSCode settings
     * @returns ParserConfig with current settings or defaults
     */
    public getParserConfig(): ParserConfig {
        const config = vscode.workspace.getConfiguration(ConfigManager.EXTENSION_ID);
        
        return {
            rxTbaPath: config.get<string>('rxTbaPath') || ConfigManager.DEFAULT_CONFIG.rxTbaPath,
            rxHistoryPath: config.get<string>('rxHistoryPath') || ConfigManager.DEFAULT_CONFIG.rxHistoryPath,
            medHistoryPath: config.get<string>('medHistoryPath') || ConfigManager.DEFAULT_CONFIG.medHistoryPath,
            dateFormat: config.get<string>('dateFormat') || ConfigManager.DEFAULT_CONFIG.dateFormat,
            colors: config.get<object>('colors') as any || ConfigManager.DEFAULT_CONFIG.colors,
            customMappings: config.get<Record<string, string>>('customMappings') || ConfigManager.DEFAULT_CONFIG.customMappings
        };
    }

    /**
     * Update configuration settings
     * @param updates Partial configuration updates
     * @param target Configuration target (Global, Workspace, or WorkspaceFolder)
     */
    public async updateConfig(
        updates: Partial<ParserConfig>, 
        target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace
    ): Promise<void> {
        const config = vscode.workspace.getConfiguration(ConfigManager.EXTENSION_ID);
        
        const updatePromises: Thenable<void>[] = [];
        
        if (updates.rxTbaPath !== undefined) {
            updatePromises.push(config.update('rxTbaPath', updates.rxTbaPath, target));
        }
        
        if (updates.rxHistoryPath !== undefined) {
            updatePromises.push(config.update('rxHistoryPath', updates.rxHistoryPath, target));
        }
        
        if (updates.medHistoryPath !== undefined) {
            updatePromises.push(config.update('medHistoryPath', updates.medHistoryPath, target));
        }
        
        if (updates.dateFormat !== undefined) {
            updatePromises.push(config.update('dateFormat', updates.dateFormat, target));
        }
        
        if (updates.colors !== undefined) {
            updatePromises.push(config.update('colors', updates.colors, target));
        }
        
        if (updates.customMappings !== undefined) {
            updatePromises.push(config.update('customMappings', updates.customMappings, target));
        }
        
        await Promise.all(updatePromises);
    }

    /**
     * Validate configuration values
     * @param config Configuration to validate
     * @returns ValidationResult with validation status and errors
     */
    public validateConfig(config: ParserConfig): ValidationResult {
        const errors: string[] = [];
        
        // Validate path strings are not empty
        if (!config.rxTbaPath || config.rxTbaPath.trim() === '') {
            errors.push('rxTbaPath cannot be empty');
        }
        
        if (!config.rxHistoryPath || config.rxHistoryPath.trim() === '') {
            errors.push('rxHistoryPath cannot be empty');
        }
        
        if (!config.medHistoryPath || config.medHistoryPath.trim() === '') {
            errors.push('medHistoryPath cannot be empty');
        }
        
        // Validate date format
        if (!config.dateFormat || config.dateFormat.trim() === '') {
            errors.push('dateFormat cannot be empty');
        } else if (!this.isValidDateFormat(config.dateFormat)) {
            errors.push(`Invalid date format: ${config.dateFormat}. Supported formats include YYYY-MM-DD, MM/DD/YYYY, DD-MM-YYYY`);
        }
        
        // Validate colors object
        if (!config.colors) {
            errors.push('colors configuration is required');
        } else {
            if (!config.colors.rxTba || !this.isValidColor(config.colors.rxTba)) {
                errors.push('Invalid color for rxTba. Must be a valid hex color (e.g., #FF6B6B)');
            }
            
            if (!config.colors.rxHistory || !this.isValidColor(config.colors.rxHistory)) {
                errors.push('Invalid color for rxHistory. Must be a valid hex color (e.g., #4ECDC4)');
            }
            
            if (!config.colors.medHistory || !this.isValidColor(config.colors.medHistory)) {
                errors.push('Invalid color for medHistory. Must be a valid hex color (e.g., #45B7D1)');
            }
        }
        
        // Validate custom mappings
        if (config.customMappings) {
            for (const [key, value] of Object.entries(config.customMappings)) {
                if (typeof key !== 'string' || typeof value !== 'string') {
                    errors.push(`Invalid custom mapping: ${key} -> ${value}. Both key and value must be strings`);
                }
                
                if (key.trim() === '' || value.trim() === '') {
                    errors.push(`Custom mapping keys and values cannot be empty: ${key} -> ${value}`);
                }
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Get default configuration
     * @returns Default ParserConfig
     */
    public getDefaultConfig(): ParserConfig {
        return { ...ConfigManager.DEFAULT_CONFIG };
    }

    /**
     * Reset configuration to defaults
     * @param target Configuration target
     */
    public async resetToDefaults(target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace): Promise<void> {
        await this.updateConfig(ConfigManager.DEFAULT_CONFIG, target);
    }

    /**
     * Validate if a string is a valid date format
     * @param format Date format string to validate
     * @returns true if valid format
     */
    private isValidDateFormat(format: string): boolean {
        const validFormats = [
            'YYYY-MM-DD',
            'MM/DD/YYYY',
            'DD-MM-YYYY',
            'YYYY/MM/DD',
            'DD/MM/YYYY',
            'MM-DD-YYYY'
        ];
        
        return validFormats.includes(format);
    }

    /**
     * Validate if a string is a valid hex color
     * @param color Color string to validate
     * @returns true if valid hex color
     */
    private isValidColor(color: string): boolean {
        const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
        return hexColorRegex.test(color);
    }
}