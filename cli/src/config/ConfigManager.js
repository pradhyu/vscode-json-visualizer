"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigManager = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class ConfigManager {
    config = {};
    constructor() {
        this.setDefaults();
    }
    setDefaults() {
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
    async loadConfig(configPath) {
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
        }
        catch (error) {
            if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
                throw new Error(`Configuration file not found: ${configPath}`);
            }
            if (error instanceof SyntaxError) {
                throw new Error(`Invalid JSON in configuration file: ${configPath}. ${error.message}`);
            }
            throw error;
        }
    }
    updateFromCliOptions(options) {
        if (options.format) {
            this.config.dateFormat = options.format;
        }
    }
    getConfig() {
        return { ...this.config };
    }
    async saveConfig(configPath) {
        const configDir = path.dirname(configPath);
        await fs.promises.mkdir(configDir, { recursive: true });
        await fs.promises.writeFile(configPath, JSON.stringify(this.config, null, 2));
    }
    validateConfig() {
        const errors = [];
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
    static async createSampleConfig(outputPath) {
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
exports.ConfigManager = ConfigManager;
//# sourceMappingURL=ConfigManager.js.map