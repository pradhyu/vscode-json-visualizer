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
const folderProcessor_1 = require("./utils/folderProcessor");
const program = new commander_1.Command();
program
    .name('claims-timeline')
    .description('Generate interactive timeline visualizations from medical claims JSON data')
    .version('1.0.0');
// Main generate command
program
    .command('generate')
    .alias('gen')
    .description('Generate timeline visualization from JSON file or folder')
    .argument('<input>', 'Input JSON file path or folder path')
    .option('-o, --output <path>', 'Output HTML file path or directory', 'timeline.html')
    .option('-c, --config <path>', 'Configuration file path')
    .option('--open', 'Open generated HTML file(s) in browser')
    .option('--theme <theme>', 'Color theme (light|dark|auto)', 'auto')
    .option('--title <title>', 'Timeline title')
    .option('--no-interactive', 'Disable interactive features')
    .option('--format <format>', 'Date format (YYYY-MM-DD|MM/DD/YYYY|DD-MM-YYYY)', 'YYYY-MM-DD')
    .option('--width <width>', 'Timeline width in pixels', '1200')
    .option('--height <height>', 'Timeline height in pixels', '600')
    .option('--recursive', 'Process subfolders recursively (folder mode only)')
    .action(async (input, options) => {
    const startTime = Date.now();
    try {
        // Check if input is a file or folder
        const stats = fs.statSync(input);
        const isFolder = stats.isDirectory();
        if (isFolder) {
            // Folder processing mode
            await processFolderMode(input, options, startTime);
        }
        else {
            // Single file processing mode
            await processSingleFileMode(input, options, startTime);
        }
    }
    catch (error) {
        console.error(chalk_1.default.red('Error:'), error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
});
// Helper function for single file processing
async function processSingleFileMode(input, options, startTime) {
    const spinner = (0, ora_1.default)('Processing medical claims data...').start();
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
// Helper function for folder processing
async function processFolderMode(input, options, startTime) {
    const spinner = (0, ora_1.default)('Scanning folder for JSON files...').start();
    // Validate folder
    await (0, validators_1.validateFolder)(input);
    // Load configuration
    const configManager = new ConfigManager_1.ConfigManager();
    if (options.config) {
        await configManager.loadConfig(options.config);
    }
    configManager.updateFromCliOptions(options);
    // Create folder processor
    const parser = new ClaimsParser_1.ClaimsParser(configManager.getConfig());
    const folderProcessor = new folderProcessor_1.FolderProcessor(parser);
    // Scan folder first
    spinner.text = 'Scanning for JSON files...';
    const files = await folderProcessor.scanFolder(input, options.recursive);
    const validFiles = files.filter(f => f.isValidClaims);
    if (validFiles.length === 0) {
        spinner.fail('No valid medical claims JSON files found');
        console.log();
        console.log(chalk_1.default.yellow('📁 Folder Scan Results:'));
        console.log(`   Total JSON files: ${files.length}`);
        console.log(`   Valid claims files: ${validFiles.length}`);
        console.log();
        console.log(chalk_1.default.dim('Tip: Ensure JSON files contain rxTba, rxHistory, or medHistory data'));
        return;
    }
    spinner.succeed(`Found ${validFiles.length} valid claims files`);
    // Show file list
    console.log();
    console.log(chalk_1.default.bold('📋 Found Claims Files:'));
    validFiles.forEach((file, index) => {
        const claimsInfo = file.claimsCount ? `${file.claimsCount} claims` : 'unknown';
        const typesInfo = file.claimTypes ? `(${file.claimTypes.join(', ')})` : '';
        console.log(`   ${index + 1}. ${chalk_1.default.cyan(file.name)} - ${claimsInfo} ${typesInfo}`);
    });
    console.log();
    // Determine output directory
    const outputDir = path.isAbsolute(options.output)
        ? options.output
        : path.join(input, options.output === 'timeline.html' ? 'timelines' : options.output);
    // Process folder
    spinner.start('Processing files...');
    const result = await folderProcessor.processFolder(input, {
        recursive: options.recursive,
        outputDir,
        theme: options.theme,
        width: parseInt(options.width),
        height: parseInt(options.height),
        interactive: options.interactive !== false,
        openAfter: options.open
    });
    const duration = Date.now() - startTime;
    if (result.processedFiles > 0) {
        spinner.succeed(chalk_1.default.green(`Successfully processed ${result.processedFiles} files!`));
    }
    else {
        spinner.fail('No files were processed successfully');
    }
    // Display summary
    console.log();
    console.log(chalk_1.default.bold('📊 Folder Processing Summary:'));
    console.log(`   Input Folder:    ${chalk_1.default.cyan(input)}`);
    console.log(`   Output Folder:   ${chalk_1.default.cyan(outputDir)}`);
    console.log(`   Files Found:     ${chalk_1.default.yellow(result.totalFiles)}`);
    console.log(`   Files Processed: ${chalk_1.default.green(result.processedFiles)}`);
    console.log(`   Files Failed:    ${chalk_1.default.red(result.failedFiles)}`);
    console.log(`   Total Claims:    ${chalk_1.default.yellow(result.summary.totalClaims)}`);
    console.log(`   Claim Types:     ${chalk_1.default.yellow(Array.from(result.summary.claimTypes).join(', '))}`);
    if (result.summary.dateRange) {
        console.log(`   Date Range:      ${chalk_1.default.yellow(result.summary.dateRange.start.toLocaleDateString())} - ${chalk_1.default.yellow(result.summary.dateRange.end.toLocaleDateString())}`);
    }
    console.log(`   Duration:        ${chalk_1.default.yellow((0, formatters_1.formatDuration)(duration))}`);
    console.log();
    // Show errors if any
    if (result.errors.length > 0) {
        console.log(chalk_1.default.bold.red('❌ Processing Errors:'));
        result.errors.forEach(error => {
            console.log(`   ${chalk_1.default.red(error.file)}: ${error.error}`);
        });
        console.log();
    }
    // Show output files
    if (result.outputFiles.length > 0) {
        console.log(chalk_1.default.bold('📄 Generated Files:'));
        result.outputFiles.forEach(file => {
            console.log(`   ${chalk_1.default.cyan(path.basename(file))}`);
        });
        console.log();
        console.log(chalk_1.default.dim(`Files saved to: ${outputDir}`));
        // Open first file if requested
        if (options.open && result.outputFiles.length > 0) {
            const openSpinner = (0, ora_1.default)('Opening first timeline in browser...').start();
            try {
                await (0, open_1.default)(path.resolve(result.outputFiles[0]));
                openSpinner.succeed('Opened in browser');
            }
            catch (error) {
                openSpinner.fail('Failed to open in browser');
                console.log(chalk_1.default.yellow(`Please open manually: ${path.resolve(result.outputFiles[0])}`));
            }
        }
    }
}
// Folder command
program
    .command('folder')
    .alias('dir')
    .description('Process all JSON files in a folder')
    .argument('<folder>', 'Folder path containing JSON files')
    .option('-o, --output <dir>', 'Output directory for HTML files', 'timelines')
    .option('-c, --config <path>', 'Configuration file path')
    .option('--open', 'Open first generated timeline in browser')
    .option('--theme <theme>', 'Color theme (light|dark|auto)', 'auto')
    .option('--format <format>', 'Date format', 'YYYY-MM-DD')
    .option('--width <width>', 'Timeline width in pixels', '1200')
    .option('--height <height>', 'Timeline height in pixels', '600')
    .option('--recursive', 'Process subfolders recursively')
    .option('--list-only', 'Only list files, don\'t process them')
    .action(async (folder, options) => {
    const startTime = Date.now();
    try {
        await (0, validators_1.validateFolder)(folder);
        const configManager = new ConfigManager_1.ConfigManager();
        if (options.config) {
            await configManager.loadConfig(options.config);
        }
        configManager.updateFromCliOptions(options);
        const parser = new ClaimsParser_1.ClaimsParser(configManager.getConfig());
        const folderProcessor = new folderProcessor_1.FolderProcessor(parser);
        if (options.listOnly) {
            // List mode
            const spinner = (0, ora_1.default)('Scanning folder...').start();
            const files = await folderProcessor.scanFolder(folder, options.recursive);
            spinner.succeed(`Found ${files.length} JSON files`);
            console.log();
            console.log(chalk_1.default.bold('📁 JSON Files Found:'));
            const validFiles = files.filter(f => f.isValidClaims);
            const invalidFiles = files.filter(f => !f.isValidClaims);
            if (validFiles.length > 0) {
                console.log();
                console.log(chalk_1.default.bold.green('✅ Valid Claims Files:'));
                validFiles.forEach((file, index) => {
                    const claimsInfo = file.claimsCount ? `${file.claimsCount} claims` : 'unknown';
                    const typesInfo = file.claimTypes ? `(${file.claimTypes.join(', ')})` : '';
                    const sizeInfo = (0, formatters_1.formatFileSize)(file.size);
                    console.log(`   ${index + 1}. ${chalk_1.default.cyan(file.name)} - ${claimsInfo} ${typesInfo} [${sizeInfo}]`);
                });
            }
            if (invalidFiles.length > 0) {
                console.log();
                console.log(chalk_1.default.bold.yellow('⚠️  Other JSON Files:'));
                invalidFiles.forEach((file, index) => {
                    const sizeInfo = (0, formatters_1.formatFileSize)(file.size);
                    const errorInfo = file.error ? ` (${file.error})` : '';
                    console.log(`   ${index + 1}. ${chalk_1.default.dim(file.name)} [${sizeInfo}]${errorInfo}`);
                });
            }
            console.log();
            console.log(chalk_1.default.bold('📊 Summary:'));
            console.log(`   Total JSON files: ${files.length}`);
            console.log(`   Valid claims files: ${chalk_1.default.green(validFiles.length)}`);
            console.log(`   Other files: ${chalk_1.default.yellow(invalidFiles.length)}`);
        }
        else {
            // Process mode
            await processFolderMode(folder, { ...options, output: options.output }, startTime);
        }
    }
    catch (error) {
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
                type: 'list',
                name: 'inputType',
                message: 'What would you like to process?',
                choices: [
                    { name: 'Single JSON file', value: 'file' },
                    { name: 'Folder with JSON files', value: 'folder' }
                ]
            },
            {
                type: 'input',
                name: 'input',
                message: (answers) => answers.inputType === 'file' ? 'Path to JSON file:' : 'Path to folder:',
                validate: async (input, answers) => {
                    try {
                        if (answers.inputType === 'file') {
                            await (0, validators_1.validateJsonFile)(input);
                        }
                        else {
                            await (0, validators_1.validateFolder)(input);
                        }
                        return true;
                    }
                    catch (error) {
                        return error instanceof Error ? error.message : 'Invalid path';
                    }
                }
            },
            {
                type: 'input',
                name: 'output',
                message: (answers) => answers.inputType === 'file' ? 'Output HTML file:' : 'Output directory:',
                default: (answers) => answers.inputType === 'file' ? 'timeline.html' : 'timelines'
            },
            {
                type: 'input',
                name: 'title',
                message: 'Timeline title (optional):',
                when: (answers) => answers.inputType === 'file'
            },
            {
                type: 'confirm',
                name: 'recursive',
                message: 'Process subfolders recursively?',
                default: true,
                when: (answers) => answers.inputType === 'folder'
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
                message: (answers) => answers.inputType === 'file'
                    ? 'Open in browser after generation?'
                    : 'Open first timeline in browser after generation?',
                default: true
            }
        ]);
        // Execute generation with answers
        if (answers.inputType === 'file') {
            await program.parseAsync(['node', 'claims-timeline', 'generate', answers.input,
                '--output', answers.output,
                '--theme', answers.theme,
                '--format', answers.format,
                ...(answers.title ? ['--title', answers.title] : []),
                ...(answers.open ? ['--open'] : [])
            ]);
        }
        else {
            await program.parseAsync(['node', 'claims-timeline', 'folder', answers.input,
                '--output', answers.output,
                '--theme', answers.theme,
                '--format', answers.format,
                ...(answers.recursive ? ['--recursive'] : []),
                ...(answers.open ? ['--open'] : [])
            ]);
        }
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
    console.log(chalk_1.default.dim('   # Generate from folder with JSON files'));
    console.log('   claims-timeline generate /path/to/folder --recursive');
    console.log();
    console.log(chalk_1.default.dim('   # Process folder with custom output'));
    console.log('   claims-timeline folder /path/to/data -o output-dir --open');
    console.log();
    console.log(chalk_1.default.dim('   # List files in folder without processing'));
    console.log('   claims-timeline folder /path/to/data --list-only');
    console.log();
    console.log(chalk_1.default.dim('   # Interactive mode (supports both files and folders)'));
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