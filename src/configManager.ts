import * as vscode from 'vscode';
import { ClaimTypeConfig, DateFieldConfig, ParserConfig } from './types';

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
    private static readonly EXTENSION_ID = 'claimsTimeline';
    
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
        
        // Check if new flexible configuration is available
        const claimTypes = config.get<ClaimTypeConfig[]>('claimTypes');
        
        if (claimTypes && claimTypes.length > 0) {
            // Use new flexible configuration
            return {
                claimTypes,
                globalDateFormat: config.get<string>('globalDateFormat') || 'YYYY-MM-DD',
                defaultColors: config.get<string[]>('defaultColors') || [
                    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', 
                    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
                ]
            };
        }
        
        // Fall back to legacy configuration for backward compatibility
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
        
        // Handle new flexible configuration
        if (updates.claimTypes !== undefined) {
            updatePromises.push(config.update('claimTypes', updates.claimTypes, target));
        }
        
        if (updates.globalDateFormat !== undefined) {
            updatePromises.push(config.update('globalDateFormat', updates.globalDateFormat, target));
        }
        
        if (updates.defaultColors !== undefined) {
            updatePromises.push(config.update('defaultColors', updates.defaultColors, target));
        }
        
        // Handle legacy configuration
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

    /**
     * Create a default flexible configuration from legacy settings
     * @returns ClaimTypeConfig array with default claim types
     */
    public createDefaultFlexibleConfig(): ClaimTypeConfig[] {
        return [
            {
                name: 'rxTba',
                arrayPath: 'rxTba',
                color: '#FF6B6B',
                idField: { path: 'id', defaultValue: 'auto-generated' },
                startDate: { type: 'field', field: 'dos', fallbacks: ['fillDate', 'prescriptionDate'] },
                endDate: { 
                    type: 'calculation', 
                    calculation: { 
                        baseField: 'dos', 
                        operation: 'add', 
                        value: 'dayssupply', 
                        unit: 'days' 
                    } 
                },
                displayName: { path: 'medication', defaultValue: 'rxTba Claim' },
                displayFields: [
                    { label: 'Medication', path: 'medication', format: 'text', showInTooltip: true, showInDetails: true },
                    { label: 'Dosage', path: 'dosage', format: 'text', showInTooltip: true, showInDetails: true },
                    { label: 'Days Supply', path: 'dayssupply', format: 'number', showInTooltip: true, showInDetails: true },
                    { label: 'Prescriber', path: 'prescriber', format: 'text', showInTooltip: false, showInDetails: true },
                    { label: 'Pharmacy', path: 'pharmacy', format: 'text', showInTooltip: false, showInDetails: true },
                    { label: 'Copay', path: 'copay', format: 'currency', showInTooltip: false, showInDetails: true }
                ]
            },
            {
                name: 'rxHistory',
                arrayPath: 'rxHistory',
                color: '#4ECDC4',
                idField: { path: 'id', defaultValue: 'auto-generated' },
                startDate: { type: 'field', field: 'dos', fallbacks: ['fillDate'] },
                endDate: { 
                    type: 'calculation', 
                    calculation: { 
                        baseField: 'dos', 
                        operation: 'add', 
                        value: 'dayssupply', 
                        unit: 'days' 
                    } 
                },
                displayName: { path: 'medication', defaultValue: 'rxHistory Claim' },
                displayFields: [
                    { label: 'Medication', path: 'medication', format: 'text', showInTooltip: true, showInDetails: true },
                    { label: 'Days Supply', path: 'dayssupply', format: 'number', showInTooltip: true, showInDetails: true },
                    { label: 'Refills Remaining', path: 'refillsRemaining', format: 'number', showInTooltip: false, showInDetails: true }
                ]
            },
            {
                name: 'medHistory',
                arrayPath: 'medHistory.claims',
                color: '#45B7D1',
                idField: { path: 'lines[0].lineId', defaultValue: 'auto-generated' },
                startDate: { type: 'field', field: 'lines[0].srvcStart' },
                endDate: { type: 'field', field: 'lines[0].srvcEnd' },
                displayName: { path: 'lines[0].description', defaultValue: 'Medical Claim' },
                displayFields: [
                    { label: 'Service Type', path: 'lines[0].serviceType', format: 'text', showInTooltip: true, showInDetails: true },
                    { label: 'Provider', path: 'provider', format: 'text', showInTooltip: true, showInDetails: true },
                    { label: 'Procedure Code', path: 'lines[0].procedureCode', format: 'text', showInTooltip: false, showInDetails: true },
                    { label: 'Charged Amount', path: 'lines[0].chargedAmount', format: 'currency', showInTooltip: false, showInDetails: true },
                    { label: 'Paid Amount', path: 'lines[0].paidAmount', format: 'currency', showInTooltip: false, showInDetails: true }
                ]
            }
        ];
    }

    /**
     * Validate flexible claim type configuration
     * @param claimTypes Array of claim type configurations to validate
     * @returns ValidationResult with validation status and errors
     */
    public validateFlexibleConfig(claimTypes: ClaimTypeConfig[]): ValidationResult {
        const errors: string[] = [];

        if (!claimTypes || claimTypes.length === 0) {
            errors.push('At least one claim type configuration is required');
            return { isValid: false, errors };
        }

        claimTypes.forEach((claimType, index) => {
            const prefix = `Claim type ${index + 1} (${claimType.name || 'unnamed'})`;

            // Validate required fields
            if (!claimType.name || claimType.name.trim() === '') {
                errors.push(`${prefix}: name is required`);
            }

            if (!claimType.arrayPath || claimType.arrayPath.trim() === '') {
                errors.push(`${prefix}: arrayPath is required`);
            }

            if (!claimType.color || !this.isValidColor(claimType.color)) {
                errors.push(`${prefix}: valid color is required (e.g., #FF6B6B)`);
            }

            // Validate ID field
            if (!claimType.idField || !claimType.idField.path) {
                errors.push(`${prefix}: idField.path is required`);
            }

            // Validate start date
            if (!claimType.startDate) {
                errors.push(`${prefix}: startDate configuration is required`);
            } else {
                const startDateErrors = this.validateDateFieldConfig(claimType.startDate, `${prefix}.startDate`);
                errors.push(...startDateErrors);
            }

            // Validate end date
            if (!claimType.endDate) {
                errors.push(`${prefix}: endDate configuration is required`);
            } else {
                const endDateErrors = this.validateDateFieldConfig(claimType.endDate, `${prefix}.endDate`);
                errors.push(...endDateErrors);
            }

            // Validate display name
            if (!claimType.displayName || !claimType.displayName.path) {
                errors.push(`${prefix}: displayName.path is required`);
            }

            // Validate display fields
            if (claimType.displayFields) {
                claimType.displayFields.forEach((field, fieldIndex) => {
                    const fieldPrefix = `${prefix}.displayFields[${fieldIndex}]`;
                    
                    if (!field.label || field.label.trim() === '') {
                        errors.push(`${fieldPrefix}: label is required`);
                    }
                    
                    if (!field.path || field.path.trim() === '') {
                        errors.push(`${fieldPrefix}: path is required`);
                    }
                    
                    if (field.format && !['text', 'date', 'currency', 'number'].includes(field.format)) {
                        errors.push(`${fieldPrefix}: invalid format '${field.format}'. Must be one of: text, date, currency, number`);
                    }
                });
            }
        });

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate date field configuration
     * @param dateConfig Date field configuration to validate
     * @param prefix Error message prefix
     * @returns Array of validation errors
     */
    private validateDateFieldConfig(dateConfig: DateFieldConfig, prefix: string): string[] {
        const errors: string[] = [];

        if (!dateConfig.type || !['field', 'calculation', 'fixed'].includes(dateConfig.type)) {
            errors.push(`${prefix}: type must be 'field', 'calculation', or 'fixed'`);
            return errors;
        }

        switch (dateConfig.type) {
            case 'field':
                if (!dateConfig.field || dateConfig.field.trim() === '') {
                    errors.push(`${prefix}: field is required when type is 'field'`);
                }
                break;

            case 'calculation':
                if (!dateConfig.calculation) {
                    errors.push(`${prefix}: calculation is required when type is 'calculation'`);
                } else {
                    const calc = dateConfig.calculation;
                    
                    if (!calc.baseField || calc.baseField.trim() === '') {
                        errors.push(`${prefix}.calculation: baseField is required`);
                    }
                    
                    if (!calc.operation || !['add', 'subtract'].includes(calc.operation)) {
                        errors.push(`${prefix}.calculation: operation must be 'add' or 'subtract'`);
                    }
                    
                    if (calc.value === undefined || calc.value === null) {
                        errors.push(`${prefix}.calculation: value is required`);
                    }
                    
                    if (!calc.unit || !['days', 'weeks', 'months', 'years'].includes(calc.unit)) {
                        errors.push(`${prefix}.calculation: unit must be 'days', 'weeks', 'months', or 'years'`);
                    }
                }
                break;

            case 'fixed':
                if (!dateConfig.value || dateConfig.value.trim() === '') {
                    errors.push(`${prefix}: value is required when type is 'fixed'`);
                }
                break;
        }

        return errors;
    }

    /**
     * Convert legacy configuration to flexible configuration
     * @param legacyConfig Legacy parser configuration
     * @returns ClaimTypeConfig array
     */
    public convertLegacyToFlexible(legacyConfig: ParserConfig): ClaimTypeConfig[] {
        const claimTypes: ClaimTypeConfig[] = [];

        // Convert rxTba
        if (legacyConfig.rxTbaPath) {
            claimTypes.push({
                name: 'rxTba',
                arrayPath: legacyConfig.rxTbaPath,
                color: legacyConfig.colors?.rxTba || '#FF6B6B',
                idField: { path: 'id', defaultValue: 'auto-generated' },
                startDate: { type: 'field', field: 'dos', fallbacks: ['fillDate', 'prescriptionDate'] },
                endDate: { 
                    type: 'calculation', 
                    calculation: { 
                        baseField: 'dos', 
                        operation: 'add', 
                        value: 'dayssupply', 
                        unit: 'days' 
                    } 
                },
                displayName: { path: 'medication', defaultValue: 'rxTba Claim' },
                displayFields: [
                    { label: 'Medication', path: 'medication', format: 'text', showInTooltip: true, showInDetails: true },
                    { label: 'Dosage', path: 'dosage', format: 'text', showInTooltip: true, showInDetails: true },
                    { label: 'Days Supply', path: 'dayssupply', format: 'number', showInTooltip: true, showInDetails: true }
                ]
            });
        }

        // Convert rxHistory
        if (legacyConfig.rxHistoryPath) {
            claimTypes.push({
                name: 'rxHistory',
                arrayPath: legacyConfig.rxHistoryPath,
                color: legacyConfig.colors?.rxHistory || '#4ECDC4',
                idField: { path: 'id', defaultValue: 'auto-generated' },
                startDate: { type: 'field', field: 'dos', fallbacks: ['fillDate'] },
                endDate: { 
                    type: 'calculation', 
                    calculation: { 
                        baseField: 'dos', 
                        operation: 'add', 
                        value: 'dayssupply', 
                        unit: 'days' 
                    } 
                },
                displayName: { path: 'medication', defaultValue: 'rxHistory Claim' },
                displayFields: [
                    { label: 'Medication', path: 'medication', format: 'text', showInTooltip: true, showInDetails: true },
                    { label: 'Days Supply', path: 'dayssupply', format: 'number', showInTooltip: true, showInDetails: true }
                ]
            });
        }

        // Convert medHistory
        if (legacyConfig.medHistoryPath) {
            claimTypes.push({
                name: 'medHistory',
                arrayPath: legacyConfig.medHistoryPath + '.claims',
                color: legacyConfig.colors?.medHistory || '#45B7D1',
                idField: { path: 'lines[0].lineId', defaultValue: 'auto-generated' },
                startDate: { type: 'field', field: 'lines[0].srvcStart' },
                endDate: { type: 'field', field: 'lines[0].srvcEnd' },
                displayName: { path: 'lines[0].description', defaultValue: 'Medical Claim' },
                displayFields: [
                    { label: 'Service Type', path: 'lines[0].serviceType', format: 'text', showInTooltip: true, showInDetails: true },
                    { label: 'Provider', path: 'provider', format: 'text', showInTooltip: true, showInDetails: true }
                ]
            });
        }

        return claimTypes;
    }
}