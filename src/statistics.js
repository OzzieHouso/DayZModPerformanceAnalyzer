/**
 * Copyright (c) 2025 ozziehouso
 *
 * This file is part of a project that can be used and adapted via pull requests.
 * Redistribution or recreation of this code as a separate project is prohibited.
 * See LICENSE file for details.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const STATS_FILE = path.join(__dirname, '../data/statistics.json');

export class Statistics {
  constructor() {
    this.stats = null;
  }

  async initialize() {
    try {
      await fs.mkdir(path.dirname(STATS_FILE), { recursive: true });

      try {
        const data = await fs.readFile(STATS_FILE, 'utf-8');
        this.stats = JSON.parse(data);
      } catch (error) {
        // File doesn't exist or is invalid, create new stats
        this.stats = {
          totalAnalyses: 0,
          totalFilesChecked: 0,
          firstUse: new Date().toISOString(),
          lastUse: null
        };
        await this.save();
      }
    } catch (error) {
      console.error('Failed to initialize statistics:', error);
      throw error;
    }
  }

  async save() {
    try {
      await fs.writeFile(STATS_FILE, JSON.stringify(this.stats, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save statistics:', error);
      throw error;
    }
  }

  async recordAnalysis(fileCount) {
    if (!this.stats) {
      await this.initialize();
    }

    this.stats.totalAnalyses += 1;
    this.stats.totalFilesChecked += fileCount;
    this.stats.lastUse = new Date().toISOString();

    await this.save();
  }

  async getStats() {
    if (!this.stats) {
      await this.initialize();
    }

    return {
      totalAnalyses: this.stats.totalAnalyses,
      totalFilesChecked: this.stats.totalFilesChecked,
      firstUse: this.stats.firstUse,
      lastUse: this.stats.lastUse
    };
  }
}
