/**
 * Copyright (c) 2025 ozziehouso
 *
 * This file is part of a project that can be used and adapted via pull requests.
 * Redistribution or recreation of this code as a separate project is prohibited.
 * See LICENSE file for details.
 */

import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { promises as fs } from 'fs';
import path from 'path';
import { FileParser } from './fileParser.js';
import { PerformanceAnalyzer } from './analyzer.js';
import { Reporter } from './reporter.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max
  },
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() !== '.zip') {
      return cb(new Error('Only .zip files are allowed'));
    }
    cb(null, true);
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Route handling for HTML pages without extensions
app.get('/faq', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/faq.html'));
});

app.get('/index', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

// Main analysis endpoint
app.post('/api/analyze', upload.single('modFile'), async (req, res) => {
  let filePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    filePath = req.file.path;
    console.log(`Analyzing: ${req.file.originalname} (${req.file.size} bytes)`);

    // Parse files from zip
    const parser = new FileParser(filePath);
    const files = await parser.parse();

    if (files.length === 0) {
      return res.json({
        success: false,
        error: 'No script files (.c, .cpp) found in zip',
        fileName: req.file.originalname
      });
    }

    // Analyze
    const analyzer = new PerformanceAnalyzer(files);
    const results = analyzer.analyze();

    // Get score and rating
    const score = analyzer.getScore();
    const rating = analyzer.getRating();

    // Format response
    const response = {
      success: true,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      timestamp: new Date().toISOString(),
      score: score,
      rating: rating,
      summary: results.summary,
      issues: results.issues,
      fileStats: results.fileStats.slice(0, 10) // Top 10 files only
    };

    res.json(response);

  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Analysis failed'
    });
  } finally {
    // Clean up uploaded file
    if (filePath) {
      try {
        await fs.unlink(filePath);
        console.log(`Cleaned up: ${filePath}`);
      } catch (err) {
        console.error('Failed to delete temp file:', err);
      }
    }
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large (max 50MB)' });
    }
    return res.status(400).json({ error: error.message });
  }

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  next();
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 DayZ Mod Performance Analyzer Server`);
  console.log(`   Running on: http://localhost:${PORT}`);
  console.log(`   API Endpoint: http://localhost:${PORT}/api/analyze`);
  console.log(`   Web UI: http://localhost:${PORT}\n`);
});
