/**
 * Copyright (c) 2025 ozziehouso
 *
 * This file is part of a project that can be used and adapted via pull requests.
 * Redistribution or recreation of this code as a separate project is prohibited.
 * See LICENSE file for details.
 */

import AdmZip from 'adm-zip';
import { promises as fs } from 'fs';
import path from 'path';

// Handles zip file extraction and parsing
export class FileParser {
  constructor(zipPath) {
    this.zipPath = zipPath;
    this.files = [];
  }

  async parse() {
    try {
      const zip = new AdmZip(this.zipPath);
      const zipEntries = zip.getEntries();

      for (const entry of zipEntries) {
        if (entry.isDirectory) continue;

        const ext = path.extname(entry.entryName).toLowerCase();
        if (ext !== '.c' && ext !== '.cpp') continue; // script files only

        const content = entry.getData().toString('utf8');

        this.files.push({
          path: entry.entryName,
          name: path.basename(entry.entryName),
          content: content,
          lines: content.split('\n'),
          size: content.length
        });
      }

      return this.files;
    } catch (error) {
      throw new Error(`Failed to parse zip file: ${error.message}`);
    }
  }

  getFiles() {
    return this.files;
  }

  getFilesByPattern(pattern) {
    const regex = new RegExp(pattern, 'i');
    return this.files.filter(f => regex.test(f.path) || regex.test(f.name));
  }

  searchInFiles(pattern, options = {}) {
    const regex = new RegExp(pattern, options.flags || 'gm');
    const results = [];

    for (const file of this.files) {
      const matches = [...file.content.matchAll(regex)];

      if (matches.length > 0) {
        results.push({
          file: file.path,
          matches: matches.map(m => ({
            text: m[0],
            line: this.getLineNumber(file.content, m.index),
            index: m.index,
            groups: m.groups || {}
          }))
        });
      }
    }

    return results;
  }

  getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }
}
