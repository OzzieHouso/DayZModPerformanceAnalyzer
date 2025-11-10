/**
 * Copyright (c) 2025 ozziehouso
 *
 * This file is part of a project that can be used and adapted via pull requests.
 * Redistribution or recreation of this code as a separate project is prohibited.
 * See LICENSE file for details.
 */

import { performanceRules, SEVERITY } from './rules.js';
import { enhancedRules } from './enhancedRules.js';

export class PerformanceAnalyzer {
  constructor(files, options = {}) {
    this.files = files;
    this.useEnhancedRules = options.enhanced !== false;
    this.results = {
      summary: {
        totalFiles: files.length,
        totalIssues: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0
      },
      issues: [],
      fileStats: []
    };
  }

  analyze() {
    console.log(`Analyzing ${this.files.length} files...`);

    for (const file of this.files) {
      const fileIssues = this.analyzeFile(file);

      if (fileIssues.length > 0) {
        this.results.issues.push({
          file: file.path,
          issues: fileIssues
        });
      }

      this.results.fileStats.push({
        file: file.path,
        size: file.size,
        lines: file.lines.length,
        issueCount: fileIssues.length
      });
    }

    this.calculateSummary();

    return this.results;
  }

  analyzeFile(file) {
    const issues = [];

    const allRules = this.useEnhancedRules
      ? [...performanceRules, ...enhancedRules]
      : performanceRules;

    for (const rule of allRules) {
      try {
        const matches = this.searchPattern(file, rule.pattern);

        if (matches.length > 0) {
          let ruleIssues = [];

          if (rule.check) {
            ruleIssues = rule.check(matches, file);
          } else {
            ruleIssues = matches.map(m => ({
              line: m.line,
              message: rule.description,
              severity: rule.severity
            }));
          }

          for (const issue of ruleIssues) {
            issues.push({
              ruleId: rule.id,
              ruleName: rule.name,
              severity: issue.severity || rule.severity,
              line: issue.line,
              message: issue.message,
              description: rule.description
            });
          }
        }
      } catch (error) {
        console.error(`Error checking rule ${rule.id} on ${file.path}:`, error.message);
      }
    }

    return issues;
  }

  /**
   * Search for pattern in file
   */
  searchPattern(file, pattern) {
    const matches = [];
    const regex = new RegExp(pattern.source, pattern.flags);

    let match;
    while ((match = regex.exec(file.content)) !== null) {
      matches.push({
        text: match[0],
        line: this.getLineNumber(file.content, match.index),
        index: match.index,
        groups: match.groups || {}
      });
    }

    return matches.length > 0 ? [{ matches }] : [];
  }

  getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }

  calculateSummary() {
    for (const fileResult of this.results.issues) {
      for (const issue of fileResult.issues) {
        this.results.summary.totalIssues++;

        switch (issue.severity) {
          case SEVERITY.CRITICAL:
            this.results.summary.critical++;
            break;
          case SEVERITY.HIGH:
            this.results.summary.high++;
            break;
          case SEVERITY.MEDIUM:
            this.results.summary.medium++;
            break;
          case SEVERITY.LOW:
            this.results.summary.low++;
            break;
          case SEVERITY.INFO:
            this.results.summary.info++;
            break;
        }
      }
    }
  }

  getResults() {
    return this.results;
  }

  getScore() {
    const weights = {
      [SEVERITY.CRITICAL]: 20,
      [SEVERITY.HIGH]: 10,
      [SEVERITY.MEDIUM]: 5,
      [SEVERITY.LOW]: 2,
      [SEVERITY.INFO]: 1
    };

    let penalties = 0;
    penalties += this.results.summary.critical * weights[SEVERITY.CRITICAL];
    penalties += this.results.summary.high * weights[SEVERITY.HIGH];
    penalties += this.results.summary.medium * weights[SEVERITY.MEDIUM];
    penalties += this.results.summary.low * weights[SEVERITY.LOW];
    penalties += this.results.summary.info * weights[SEVERITY.INFO];

    penalties = Math.min(penalties, 100);

    return Math.max(0, 100 - penalties);
  }

  getRating() {
    const score = this.getScore();

    if (score >= 90) return 'EXCELLENT';
    if (score >= 75) return 'GOOD';
    if (score >= 60) return 'FAIR';
    if (score >= 40) return 'POOR';
    return 'CRITICAL';
  }
}
