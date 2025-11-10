#!/usr/bin/env node

/**
 * Copyright (c) 2025 ozziehouso
 *
 * This file is part of a project that can be used and adapted via pull requests.
 * Redistribution or recreation of this code as a separate project is prohibited.
 * See LICENSE file for details.
 */

import { Command } from 'commander';
import { FileParser } from './fileParser.js';
import { PerformanceAnalyzer } from './analyzer.js';
import { Reporter } from './reporter.js';
import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';

const program = new Command();

program
  .name('dayz-perf')
  .description('Deep performance analysis tool for DayZ mods')
  .version('1.0.0')
  .argument('<zipfile>', 'Path to mod zip file')
  .option('-o, --output <file>', 'Save JSON report to file')
  .option('-q, --quiet', 'Only show summary')
  .action(async (zipfile, options) => {
    try {
      console.log(chalk.cyan.bold('\nDayZ Mod Performance Analyzer\n'));

      // Check if file exists
      try {
        await fs.access(zipfile);
      } catch (error) {
        console.error(chalk.red(`Error: File not found: ${zipfile}`));
        process.exit(1);
      }

      // Parse files
      console.log(chalk.gray(`Extracting: ${zipfile}...`));
      const parser = new FileParser(zipfile);
      const files = await parser.parse();

      if (files.length === 0) {
        console.log(chalk.yellow('No script files (.c, .cpp) found in zip'));
        process.exit(0);
      }

      console.log(chalk.gray(`Found ${files.length} script files\n`));

      // Analyze
      console.log(chalk.gray('Running performance analysis...'));
      const analyzer = new PerformanceAnalyzer(files);
      const results = analyzer.analyze();

      // Generate report
      const reporter = new Reporter(results, analyzer);

      if (!options.quiet) {
        reporter.generateConsoleReport();
      } else {
        // Quick summary only
        const score = analyzer.getScore();
        const rating = analyzer.getRating();
        console.log(`\n  Score: ${score}/100 (${rating})`);
        console.log(`  Issues: ${results.summary.totalIssues} (${results.summary.critical} critical, ${results.summary.high} high)\n`);
      }

      // Save JSON report if requested
      if (options.output) {
        const jsonReport = reporter.generateJSONReport();
        await fs.writeFile(options.output, jsonReport);
        console.log(chalk.green(`JSON report saved to: ${options.output}`));
      }

      // Exit with error code if critical issues found
      if (results.summary.critical > 0) {
        process.exit(2);
      } else if (results.summary.high > 0) {
        process.exit(1);
      } else {
        process.exit(0);
      }

    } catch (error) {
      console.error(chalk.red(`\nError: ${error.message}`));
      if (process.env.DEBUG) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

program.parse();
