import { TimelineData } from '../parser/ClaimsParser';
export interface HtmlGeneratorOptions {
    theme?: 'light' | 'dark' | 'auto';
    title?: string;
    interactive?: boolean;
    width?: number;
    height?: number;
}
export declare class HtmlGenerator {
    private options;
    constructor(options?: HtmlGeneratorOptions);
    generate(timelineData: TimelineData): string;
    private generateCSS;
    private generateJavaScript;
    private formatDateRange;
}
//# sourceMappingURL=HtmlGenerator.d.ts.map