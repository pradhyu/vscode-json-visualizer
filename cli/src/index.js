#!/usr/bin/env node
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const inquirer_1 = __importDefault(require("inquirer"));
const open_1 = __importDefault(require("open"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ClaimsParser_1 = require("./parser/ClaimsParser");
const HtmlGenerator_1 = require("./generator/HtmlGenerator");
const ConfigManager_1 = require("./config/ConfigManager");
const validators_1 = require("./utils/validators");
const formatters_1 = require("./utils/formatters");
const program = new commander_1.Command();
program
    .name('claims-timeline')
    .description('Generate interactive timeline visualizations from medical claims JSON data')
    .version('1.0.0');
// Main generate command
program
    .command('generate')
    .alias('gen')
    .description('Generate timeline visualization from JSON file')
    .argument('<input>', 'Input JSON file path')
    .option('-o, --output <path>', 'Output HTML file path', 'timeline.html')
    .option('-c, --config <path>', 'Configuration file path')
    .option('--open', 'Open generated HTML file in browser')
    .option('--theme <theme>', 'Color theme (light|dark|auto)', 'auto')
    .option('--title <title>', 'Timeline title')
    .option('--no-interactive', 'Disable interactive features')
    .option('--format <format>', 'Date format (YYYY-MM-DD|MM/DD/YYYY|DD-MM-YYYY)', 'YYYY-MM-DD')
    .option('--width <width>', 'Timeline width in pixels', '1200')
    .option('--height <height>', 'Timeline height in pixels', '600')
    .action(async (input, options) => {
    const startTime = Date.now();
    const spinner = (0, ora_1.default)('Processing medical claims data...').start();
    try {
        // Validate input file
        await (0, validators_1.validateJsonFile)(input);
        // Validate output path
        await (0, validators_1.validateOutputPath)(options.output);
        // Load configuration
        const configManager = new ConfigManager_1.ConfigManager();
        if (options.config) {
            await configManager.loadConfig(options.config);
        }
        // Update config with CLI options
        configManager.updateFromCliOptions(options);
        spinner.text = 'Parsing JSON data...';
        // Parse claims data
        const parser = new ClaimsParser_1.ClaimsParser(configManager.getConfig());
        const timelineData = await parser.parseFile(input);
        spinner.text = 'Generating HTML visualization...';
        // Generate HTML
        const htmlGenerator = new HtmlGenerator_1.HtmlGenerator({
            theme: options.theme,
            title: options.title || `Medical Claims Timeline - ${path.basename(input)}`,
            interactive: options.interactive !== false,
            width: parseInt(options.width),
            height: parseInt(options.height)
        });
        const html = htmlGenerator.generate(timelineData);
        // Write output file
        fs.writeFileSync(options.output, html);
        const duration = Date.now() - startTime;
        const fileSize = fs.statSync(options.output).size;
        spinner.succeed(chalk_1.default.green('Timeline generated successfully!'));
        // Display summary
        console.log();
        console.log(chalk_1.default.bold('📊 Generation Summary:'));
        console.log(`   Input:     ${chalk_1.default.cyan(input)}`);
        console.log(`   Output:    ${chalk_1.default.cyan(options.output)}`);
        console.log(`   Claims:    ${chalk_1.default.yellow(timelineData.metadata.totalClaims)}`);
        console.log(`   Types:     ${chalk_1.default.yellow(timelineData.metadata.claimTypes.join(', '))}`);
        console.log(`   Size:      ${chalk_1.default.yellow((0, formatters_1.formatFileSize)(fileSize))}`);
        console.log(`   Duration:  ${chalk_1.default.yellow((0, formatters_1.formatDuration)(duration))}`);
        console.log();
        // Open in browser if requested
        if (options.open) {
            const openSpinner = (0, ora_1.default)('Opening in browser...').start();
            try {
                await (0, open_1.default)(path.resolve(options.output));
                openSpinner.succeed('Opened in browser');
            }
            catch (error) {
                openSpinner.fail('Failed to open in browser');
                console.log(chalk_1.default.yellow(`Please open manually: ${path.resolve(options.output)}`));
            }
        }
        else {
            console.log(chalk_1.default.dim(`To view: open ${path.resolve(options.output)}`));
        }
    }
    catch (error) {
        spinner.fail('Generation failed');
        console.error(chalk_1.default.red('Error:'), error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
});
// Interactive mode command
program
    .command('interactive')
    .alias('i')
    .description('Interactive mode with guided setup')
    .action(async () => {
    console.log(chalk_1.default.bold.blue('🏥 Medical Claims Timeline Generator'));
    console.log(chalk_1.default.dim('Interactive mode - follow the prompts to generate your timeline\n'));
    try {
        const answers = await inquirer_1.default.prompt([
            {
                type: 'input',
                name: 'input',
                message: 'Path to JSON file:',
                validate: async (input) => {
                    try {
                        await (0, validators_1.validateJsonFile)(input);
                        return true;
                    }
                    catch (error) {
                        return error instanceof Error ? error.message : 'Invalid file';
                    }
                }
            },
            {
                type: 'input',
                name: 'output',
                message: 'Output HTML file:',
                default: 'timeline.html'
            },
            {
                type: 'input',
                name: 'title',
                message: 'Timeline title (optional):',
            },
            {
                type: 'list',
                name: 'theme',
                message: 'Color theme:',
                choices: ['auto', 'light', 'dark'],
                default: 'auto'
            },
            {
                type: 'list',
                name: 'format',
                message: 'Date format:',
                choices: ['YYYY-MM-DD', 'MM/DD/YYYY', 'DD-MM-YYYY'],
                default: 'YYYY-MM-DD'
            },
            {
                type: 'confirm',
                name: 'open',
                message: 'Open in browser after generation?',
                default: true
            }
        ]);
        // Execute generation with answers
        await program.parseAsync(['node', 'claims-timeline', 'generate', answers.input,
            '--output', answers.output,
            '--theme', answers.theme,
            '--format', answers.format,
            ...(answers.title ? ['--title', answers.title] : []),
            ...(answers.open ? ['--open'] : [])
        ]);
    }
    catch (error) {
        console.error(chalk_1.default.red('Interactive mode failed:'), error);
        process.exit(1);
    }
});
// Validate command
program
    .command('validate')
    .alias('val')
    .description('Validate JSON file structure')
    .argument('<input>', 'Input JSON file path')
    .option('-v, --verbose', 'Verbose output')
    .action(async (input, options) => {
    const spinner = (0, ora_1.default)('Validating JSON structure...').start();
    try {
        await (0, validators_1.validateJsonFile)(input);
        // Parse and analyze
        const parser = new ClaimsParser_1.ClaimsParser();
        const timelineData = await parser.parseFile(input);
        spinner.succeed('JSON file is valid!');
        console.log();
        console.log(chalk_1.default.bold('📋 Validation Results:'));
        console.log(`   File:      ${chalk_1.default.cyan(input)}`);
        console.log(`   Claims:    ${chalk_1.default.green(timelineData.metadata.totalClaims)}`);
        console.log(`   Types:     ${chalk_1.default.green(timelineData.metadata.claimTypes.join(', '))}`);
        console.log(`   Date Range: ${chalk_1.default.green(timelineData.dateRange.start.toISOString().split('T')[0])} to ${chalk_1.default.green(timelineData.dateRange.end.toISOString().split('T')[0])}`);
        if (options.verbose) {
            console.log();
            console.log(chalk_1.default.bold('📊 Detailed Analysis:'));
            // Show claims by type
            const claimsByType = timelineData.claims.reduce((acc, claim) => {
                acc[claim.type] = (acc[claim.type] || 0) + 1;
                return acc;
            }, {});
            Object.entries(claimsByType).forEach(([type, count]) => {
                console.log(`   ${type}: ${chalk_1.default.yellow(count)} claims`);
            });
            // Show sample claim
            if (timelineData.claims.length > 0) {
                console.log();
                console.log(chalk_1.default.bold('📄 Sample Claim:'));
                const sample = timelineData.claims[0];
                console.log(`   ID:          ${sample.id}`);
                console.log(`   Type:        ${sample.type}`);
                console.log(`   Display:     ${sample.displayName}`);
                console.log(`   Start Date:  ${sample.startDate.toISOString().split('T')[0]}`);
                console.log(`   End Date:    ${sample.endDate.toISOString().split('T')[0]}`);
            }
        }
    }
    catch (error) {
        spinner.fail('Validation failed');
        console.error(chalk_1.default.red('Error:'), error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
});
// Info command
program
    .command('info')
    .description('Show system information and examples')
    .action(() => {
    console.log(chalk_1.default.bold.blue('🏥 Medical Claims Timeline CLI'));
    console.log(chalk_1.default.dim('Command line tool for generating medical claims timeline visualizations\n'));
    console.log(chalk_1.default.bold('📋 Supported Data Formats:'));
    console.log('   • rxTba - Prescription claims to be adjudicated');
    console.log('   • rxHistory - Historical prescription claims');
    console.log('   • medHistory - Medical service claims');
    console.log();
    console.log(chalk_1.default.bold('🎨 Features:'));
    console.log('   • Interactive timeline with zoom and pan');
    console.log('   • Color-coded claim types');
    console.log('   • Detailed tooltips and information panels');
    console.log('   • Multiple date formats support');
    console.log('   • Light/dark theme support');
    console.log('   • Responsive design');
    console.log();
    console.log(chalk_1.default.bold('📖 Examples:'));
    console.log(chalk_1.default.dim('   # Generate timeline from JSON file'));
    console.log('   claims-timeline generate data.json');
    console.log();
    console.log(chalk_1.default.dim('   # Generate with custom output and open in browser'));
    console.log('   claims-timeline generate data.json -o my-timeline.html --open');
    console.log();
    console.log(chalk_1.default.dim('   # Interactive mode'));
    console.log('   claims-timeline interactive');
    console.log();
    console.log(chalk_1.default.dim('   # Validate JSON structure'));
    console.log('   claims-timeline validate data.json --verbose');
    console.log();
    console.log(chalk_1.default.bold('🔗 More Information:'));
    console.log('   Documentation: https://github.com/medical-claims-timeline/cli');
    console.log('   Issues: https://github.com/medical-claims-timeline/cli/issues');
});
// Error handling
program.on('command:*', () => {
    console.error(chalk_1.default.red('Invalid command:'), program.args.join(' '));
    console.log(chalk_1.default.dim('Run'), chalk_1.default.cyan('claims-timeline --help'), chalk_1.default.dim('for available commands'));
    process.exit(1);
});
// Parse command line arguments
if (process.argv.length === 2) {
    // No arguments provided, show help
    program.help();
}
else {
    program.parse();
}
//# sourceMappingURL=index.js.map