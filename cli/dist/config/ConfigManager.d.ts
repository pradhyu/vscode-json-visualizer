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
export declare class ConfigManager {
    private config;
    constructor();
    private setDefaults;
    loadConfig(configPath: string): Promise<void>;
    updateFromCliOptions(options: CliOptions): void;
    getConfig(): ParserConfig;
    saveConfig(configPath: string): Promise<void>;
    validateConfig(): string[];
    static createSampleConfig(outputPath: string): Promise<void>;
}
//# sourceMappingURL=ConfigManager.d.ts.map