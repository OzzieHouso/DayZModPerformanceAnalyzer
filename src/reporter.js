/**
 * Copyright (c) 2025 ozziehouso
 *
 * This file is part of a project that can be used and adapted via pull requests.
 * Redistribution or recreation of this code as a separate project is prohibited.
 * See LICENSE file for details.
 */

import chalk from 'chalk';
import { SEVERITY } from './rules.js';

export class Reporter {
  constructor(results, analyzer) {
    this.results = results;
    this.analyzer = analyzer;
  }

  generateConsoleReport() {
    console.log('\n' + '='.repeat(80));
    console.log(chalk.bold.cyan('  DayZ Mod Performance Analysis Report'));
    console.log('='.repeat(80) + '\n');

    this.printSummary();
    this.printScore();

    if (this.results.summary.totalIssues > 0) {
      this.printIssues();
    }

    this.printFileStats();
    this.printRecommendations();

    console.log('\n' + '='.repeat(80));
  }

  printSummary() {
    const s = this.results.summary;

    console.log(chalk.bold('Summary:'));
    console.log(`   Files Analyzed: ${s.totalFiles}`);
    console.log(`   Total Issues:   ${s.totalIssues}`);
    console.log('');
    console.log(chalk.bold('   Issues by Severity:'));

    if (s.critical > 0) {
      console.log(`     CRITICAL: ${chalk.red.bold(s.critical)}`);
    }
    if (s.high > 0) {
      console.log(`     HIGH:     ${chalk.redBright.bold(s.high)}`);
    }
    if (s.medium > 0) {
      console.log(`     MEDIUM:   ${chalk.yellow.bold(s.medium)}`);
    }
    if (s.low > 0) {
      console.log(`     LOW:      ${chalk.blue.bold(s.low)}`);
    }
    if (s.info > 0) {
      console.log(`     INFO:     ${chalk.gray.bold(s.info)}`);
    }

    if (s.totalIssues === 0) {
      console.log(chalk.green('     No issues found!'));
    }

    console.log('');
  }

  printScore() {
    const score = this.analyzer.getScore();
    const rating = this.analyzer.getRating();

    let scoreColor = chalk.green;
    let ratingColor = chalk.green.bold;

    if (score < 90) { scoreColor = chalk.yellow; ratingColor = chalk.yellow.bold; }
    if (score < 75) { scoreColor = chalk.yellow; ratingColor = chalk.yellow.bold; }
    if (score < 60) { scoreColor = chalk.red; ratingColor = chalk.red.bold; }
    if (score < 40) { scoreColor = chalk.redBright; ratingColor = chalk.redBright.bold; }

    console.log(chalk.bold('Performance Score:'));
    console.log(`   ${scoreColor.bold(score)}/100 - ${ratingColor(rating)}`);
    console.log('');
  }

  printIssues() {
    console.log(chalk.bold('Issues Found:\n'));
    const issuesBySeverity = {
      [SEVERITY.CRITICAL]: [],
      [SEVERITY.HIGH]: [],
      [SEVERITY.MEDIUM]: [],
      [SEVERITY.LOW]: [],
      [SEVERITY.INFO]: []
    };

    for (const fileResult of this.results.issues) {
      for (const issue of fileResult.issues) {
        issuesBySeverity[issue.severity].push({
          ...issue,
          file: fileResult.file
        });
      }
    }

    for (const severity of [SEVERITY.CRITICAL, SEVERITY.HIGH, SEVERITY.MEDIUM, SEVERITY.LOW, SEVERITY.INFO]) {
      const issues = issuesBySeverity[severity];
      if (issues.length === 0) continue;

      const severityColor = this.getSeverityColor(severity);
      console.log(severityColor.bold(`  ${severity} (${issues.length}):`));

      for (const issue of issues) {
        console.log(severityColor(`    ${issue.ruleName}`));
        console.log(`       ${chalk.gray(issue.file)}${issue.line ? chalk.gray(`:${issue.line}`) : ''}`);
        console.log(`       ${issue.message}`);
        console.log('');
      }
    }
  }

  printFileStats() {
    console.log(chalk.bold('File Statistics:\n'));

    const topFiles = [...this.results.fileStats]
      .filter(f => f.issueCount > 0)
      .sort((a, b) => b.issueCount - a.issueCount)
      .slice(0, 10);

    if (topFiles.length === 0) {
      console.log(chalk.green('   No files with issues\n'));
      return;
    }

    console.log(chalk.gray('   Top files by issue count:\n'));

    for (const file of topFiles) {
      const issueColor = file.issueCount > 5 ? chalk.red : file.issueCount > 2 ? chalk.yellow : chalk.blue;
      console.log(`   ${file.file}`);
      console.log(`     Issues: ${issueColor.bold(file.issueCount)}, Lines: ${file.lines}, Size: ${this.formatBytes(file.size)}`);
    }

    console.log('');
  }

  printRecommendations() {
    const s = this.results.summary;

    if (s.totalIssues === 0) {
      console.log(chalk.green.bold('Excellent! No potential performance issues detected.\n'));
      return;
    }

    console.log(chalk.bold('Recommendations:\n'));

    if (s.critical > 0) {
      console.log(chalk.red('   CRITICAL patterns detected - these are likely to cause server performance issues.'));
      console.log(chalk.red('   Recommended: Review and address before deploying to production.\n'));
    }

    if (s.high > 0) {
      console.log(chalk.redBright('   HIGH severity patterns may cause significant performance problems.'));
      console.log(chalk.redBright('   Recommended: Review and optimize before production use.\n'));
    }

    if (s.medium > 0) {
      console.log(chalk.yellow('   MEDIUM patterns detected that could cause issues under load.'));
      console.log(chalk.yellow('   Recommended: Consider addressing these for optimal performance.\n'));
    }

    if (s.low > 0 || s.info > 0) {
      console.log(chalk.blue('   Minor optimization opportunities detected.'));
      console.log(chalk.blue('   Optional: Review when time permits.\n'));
    }

    console.log(chalk.gray('   Note: These are automated suggestions. Context matters - review each issue.'));
    console.log(chalk.gray('   For guidance, see: https://community.bistudio.com/wiki/DayZ:Enforce_Script_Syntax'));
    console.log('');
  }

  generateJSONReport() {
    return JSON.stringify({
      score: this.analyzer.getScore(),
      rating: this.analyzer.getRating(),
      timestamp: new Date().toISOString(),
      ...this.results
    }, null, 2);
  }

  getSeverityColor(severity) {
    switch (severity) {
      case SEVERITY.CRITICAL: return chalk.red;
      case SEVERITY.HIGH: return chalk.redBright;
      case SEVERITY.MEDIUM: return chalk.yellow;
      case SEVERITY.LOW: return chalk.blue;
      case SEVERITY.INFO: return chalk.gray;
      default: return chalk.white;
    }
  }

  formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}
