#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import open from 'open';
import * as fs from 'fs';
import * as path from 'path';
import { ClaimsParser } from './parser/ClaimsParser';
import { HtmlGenerator } from './generator/HtmlGenerator';
import { ConfigManager } from './config/ConfigManager';
import { validateJsonFile, validateOutputPath } from './utils/validators';
import { formatFileSize, formatDuration } from './utils/formatters';

const program = new Command();

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
    const spinner = ora('Processing medical claims data...').start();

    try {
      // Validate input file
      await validateJsonFile(input);
      
      // Validate output path
      await validateOutputPath(options.output);

      // Load configuration
      const configManager = new ConfigManager();
      if (options.config) {
        await configManager.loadConfig(options.config);
      }

      // Update config with CLI options
      configManager.updateFromCliOptions(options);

      spinner.text = 'Parsing JSON data...';
      
      // Parse claims data
      const parser = new ClaimsParser(configManager.getConfig());
      const timelineData = await parser.parseFile(input);

      spinner.text = 'Generating HTML visualization...';

      // Generate HTML
      const htmlGenerator = new HtmlGenerator({
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

      spinner.succeed(chalk.green('Timeline generated successfully!'));

      // Display summary
      console.log();
      console.log(chalk.bold('📊 Generation Summary:'));
      console.log(`   Input:     ${chalk.cyan(input)}`);
      console.log(`   Output:    ${chalk.cyan(options.output)}`);
      console.log(`   Claims:    ${chalk.yellow(timelineData.metadata.totalClaims)}`);
      console.log(`   Types:     ${chalk.yellow(timelineData.metadata.claimTypes.join(', '))}`);
      console.log(`   Size:      ${chalk.yellow(formatFileSize(fileSize))}`);
      console.log(`   Duration:  ${chalk.yellow(formatDuration(duration))}`);
      console.log();

      // Open in browser if requested
      if (options.open) {
        const openSpinner = ora('Opening in browser...').start();
        try {
          await open(path.resolve(options.output));
          openSpinner.succeed('Opened in browser');
        } catch (error) {
          openSpinner.fail('Failed to open in browser');
          console.log(chalk.yellow(`Please open manually: ${path.resolve(options.output)}`));
        }
      } else {
        console.log(chalk.dim(`To view: open ${path.resolve(options.output)}`));
      }

    } catch (error) {
      spinner.fail('Generation failed');
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Interactive mode command
program
  .command('interactive')
  .alias('i')
  .description('Interactive mode with guided setup')
  .action(async () => {
    console.log(chalk.bold.blue('🏥 Medical Claims Timeline Generator'));
    console.log(chalk.dim('Interactive mode - follow the prompts to generate your timeline\n'));

    try {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'input',
          message: 'Path to JSON file:',
          validate: async (input) => {
            try {
              await validateJsonFile(input);
              return true;
            } catch (error) {
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

    } catch (error) {
      console.error(chalk.red('Interactive mode failed:'), error);
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
    const spinner = ora('Validating JSON structure...').start();

    try {
      await validateJsonFile(input);
      
      // Parse and analyze
      const parser = new ClaimsParser();
      const timelineData = await parser.parseFile(input);

      spinner.succeed('JSON file is valid!');

      console.log();
      console.log(chalk.bold('📋 Validation Results:'));
      console.log(`   File:      ${chalk.cyan(input)}`);
      console.log(`   Claims:    ${chalk.green(timelineData.metadata.totalClaims)}`);
      console.log(`   Types:     ${chalk.green(timelineData.metadata.claimTypes.join(', '))}`);
      console.log(`   Date Range: ${chalk.green(timelineData.dateRange.start.toISOString().split('T')[0])} to ${chalk.green(timelineData.dateRange.end.toISOString().split('T')[0])}`);

      if (options.verbose) {
        console.log();
        console.log(chalk.bold('📊 Detailed Analysis:'));
        
        // Show claims by type
        const claimsByType = timelineData.claims.reduce((acc, claim) => {
          acc[claim.type] = (acc[claim.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        Object.entries(claimsByType).forEach(([type, count]) => {
          console.log(`   ${type}: ${chalk.yellow(count)} claims`);
        });

        // Show sample claim
        if (timelineData.claims.length > 0) {
          console.log();
          console.log(chalk.bold('📄 Sample Claim:'));
          const sample = timelineData.claims[0];
          console.log(`   ID:          ${sample.id}`);
          console.log(`   Type:        ${sample.type}`);
          console.log(`   Display:     ${sample.displayName}`);
          console.log(`   Start Date:  ${sample.startDate.toISOString().split('T')[0]}`);
          console.log(`   End Date:    ${sample.endDate.toISOString().split('T')[0]}`);
        }
      }

    } catch (error) {
      spinner.fail('Validation failed');
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Info command
program
  .command('info')
  .description('Show system information and examples')
  .action(() => {
    console.log(chalk.bold.blue('🏥 Medical Claims Timeline CLI'));
    console.log(chalk.dim('Command line tool for generating medical claims timeline visualizations\n'));

    console.log(chalk.bold('📋 Supported Data Formats:'));
    console.log('   • rxTba - Prescription claims to be adjudicated');
    console.log('   • rxHistory - Historical prescription claims');
    console.log('   • medHistory - Medical service claims');
    console.log();

    console.log(chalk.bold('🎨 Features:'));
    console.log('   • Interactive timeline with zoom and pan');
    console.log('   • Color-coded claim types');
    console.log('   • Detailed tooltips and information panels');
    console.log('   • Multiple date formats support');
    console.log('   • Light/dark theme support');
    console.log('   • Responsive design');
    console.log();

    console.log(chalk.bold('📖 Examples:'));
    console.log(chalk.dim('   # Generate timeline from JSON file'));
    console.log('   claims-timeline generate data.json');
    console.log();
    console.log(chalk.dim('   # Generate with custom output and open in browser'));
    console.log('   claims-timeline generate data.json -o my-timeline.html --open');
    console.log();
    console.log(chalk.dim('   # Interactive mode'));
    console.log('   claims-timeline interactive');
    console.log();
    console.log(chalk.dim('   # Validate JSON structure'));
    console.log('   claims-timeline validate data.json --verbose');
    console.log();

    console.log(chalk.bold('🔗 More Information:'));
    console.log('   Documentation: https://github.com/medical-claims-timeline/cli');
    console.log('   Issues: https://github.com/medical-claims-timeline/cli/issues');
  });

// Error handling
program.on('command:*', () => {
  console.error(chalk.red('Invalid command:'), program.args.join(' '));
  console.log(chalk.dim('Run'), chalk.cyan('claims-timeline --help'), chalk.dim('for available commands'));
  process.exit(1);
});

// Parse command line arguments
if (process.argv.length === 2) {
  // No arguments provided, show help
  program.help();
} else {
  program.parse();
}