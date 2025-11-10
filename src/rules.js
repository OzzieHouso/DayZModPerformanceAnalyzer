/**
 * Copyright (c) 2025 ozziehouso
 *
 * This file is part of a project that can be used and adapted via pull requests.
 * Redistribution or recreation of this code as a separate project is prohibited.
 * See LICENSE file for details.
 */

export const SEVERITY = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  INFO: 'INFO'
};

export const performanceRules = [
  {
    id: 'world-scan-loop',
    name: 'World Scan in Loop',
    severity: SEVERITY.CRITICAL,
    description: 'GetObjectsAtPosition with large radius called repeatedly',
    pattern: /GetObjectsAtPosition\s*\([^,]+,\s*(\d+\.?\d*)/g,
    check: (matches, file) => {
      const issues = [];
      for (const match of matches) {
        const radius = parseFloat(match.groups?.radius || match.matches?.[0]?.text.match(/,\s*(\d+\.?\d*)/)?.[1]);

        // Check if in a loop context (within 10 lines of loop keywords)
        const lineNum = match.line || match.matches?.[0]?.line;
        const startLine = Math.max(0, lineNum - 10);
        const contextLines = file.lines.slice(startLine, lineNum);
        const inLoop = contextLines.some(line =>
          /\b(while|for|foreach)\s*\(/.test(line) ||
          /CallLater.*true/.test(line)
        );

        if (radius > 5000 || (radius > 1000 && inLoop)) {
          issues.push({
            line: lineNum,
            message: `Potential issue: Large radius (${radius}m) world scan${inLoop ? ' inside loop/repeating timer' : ''} - consider optimizing if called frequently`,
            severity: inLoop ? SEVERITY.CRITICAL : SEVERITY.HIGH
          });
        }
      }
      return issues;
    }
  },

  {
    id: 'getplayers-spam',
    name: 'GetPlayers() Called Frequently',
    severity: SEVERITY.HIGH,
    description: 'GetPlayers() called in OnUpdate or frequent timer without rate limiting',
    pattern: /GetPlayers\s*\(/g,
    check: (matches, file) => {
      const issues = [];

      // Check if GetPlayers is in OnUpdate or OnMissionStart
      const inUpdate = /override\s+void\s+OnUpdate/.test(file.content);
      const getPlayersCount = matches.length;

      if (inUpdate && getPlayersCount > 0) {
        // Look for rate limiting patterns
        const hasRateLimiting = /if\s*\([^)]*currentTime[^)]*</.test(file.content) ||
                               /if\s*\([^)]*GetTime[^)]*</.test(file.content);

        if (!hasRateLimiting) {
          issues.push({
            line: matches[0]?.matches?.[0]?.line || 1,
            message: `GetPlayers() called in OnUpdate without visible rate limiting (found ${getPlayersCount} call(s))`,
            severity: SEVERITY.HIGH
          });
        }
      }

      return issues;
    }
  },

  {
    id: 'calllater-no-remove',
    name: 'CallLater Without Remove',
    severity: SEVERITY.HIGH,
    description: 'CallLater scheduled but never removed, potential memory leak',
    pattern: /CallLater\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)/g,
    check: (matches, file) => {
      const issues = [];
      const calledFunctions = new Set();

      // Find all CallLater functions
      for (const match of matches) {
        const funcMatch = match.matches?.[0]?.text.match(/CallLater\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)/);
        if (funcMatch && funcMatch[1]) {
          calledFunctions.add(funcMatch[1]);
        }
      }

      // Check if there's a corresponding Remove for each
      for (const func of calledFunctions) {
        const hasRemove = new RegExp(`Remove\\s*\\(\\s*${func}\\s*\\)`).test(file.content);

        if (!hasRemove) {
          issues.push({
            line: 0,
            message: `CallLater(${func}) scheduled but no corresponding Remove() found in file`,
            severity: SEVERITY.MEDIUM
          });
        }
      }

      return issues;
    }
  },

  {
    id: 'file-operations-loop',
    name: 'File I/O in Loop',
    severity: SEVERITY.CRITICAL,
    description: 'File operations (FPrintln, OpenFile) called in loops',
    pattern: /(FPrintln|OpenFile|JsonFileLoader)/g,
    check: (matches, file) => {
      const issues = [];

      for (const match of matches) {
        const lineNum = match.matches?.[0]?.line || 1;
        const startLine = Math.max(0, lineNum - 10);
        const contextLines = file.lines.slice(startLine, lineNum);

        const inLoop = contextLines.some(line =>
          /\b(while|for|foreach)\s*\(/.test(line)
        );

        if (inLoop) {
          issues.push({
            line: lineNum,
            message: `File operation (${match.matches[0].text}) inside loop - severe performance impact`,
            severity: SEVERITY.CRITICAL
          });
        }
      }

      return issues;
    }
  },

  {
    id: 'missing-destructor',
    name: 'Missing Destructor',
    severity: SEVERITY.MEDIUM,
    description: 'Class uses CallLater or resources but has no destructor for cleanup',
    pattern: /class\s+([A-Za-z_][A-Za-z0-9_]*)/g,
    check: (matches, file) => {
      const issues = [];

      for (const match of matches) {
        const classMatch = match.matches?.[0]?.text.match(/class\s+([A-Za-z_][A-Za-z0-9_]*)/);
        if (!classMatch) continue;

        const className = classMatch[1];
        const classRegex = new RegExp(`class\\s+${className}[^{]*\\{([^}]+\\{[^}]*\\}[^}]*)*\\}`, 's');
        const classBody = file.content.match(classRegex)?.[0];

        if (!classBody) continue;

        // Check if class uses resources
        const usesCallLater = /CallLater/.test(classBody);
        const usesFileHandle = /FileHandle/.test(classBody);
        const hasDestructor = new RegExp(`void\\s+~${className}`).test(classBody);

        if ((usesCallLater || usesFileHandle) && !hasDestructor) {
          issues.push({
            line: match.matches[0].line,
            message: `Class '${className}' uses resources (CallLater/FileHandle) but has no destructor for cleanup`,
            severity: SEVERITY.MEDIUM
          });
        }
      }

      return issues;
    }
  },

  {
    id: 'rpc-spam',
    name: 'Excessive RPC Calls',
    severity: SEVERITY.HIGH,
    description: 'RPC calls in loops or frequent updates',
    pattern: /(SendRPC|ScriptRPC|GetRPCManager)/g,
    check: (matches, file) => {
      const issues = [];

      for (const match of matches) {
        const lineNum = match.matches?.[0]?.line || 1;
        const startLine = Math.max(0, lineNum - 10);
        const contextLines = file.lines.slice(startLine, lineNum);

        const inLoop = contextLines.some(line =>
          /\b(while|for|foreach)\s*\(/.test(line) ||
          /CallLater.*true/.test(line)
        );

        if (inLoop) {
          issues.push({
            line: lineNum,
            message: 'RPC call inside loop or repeating timer - network spam risk',
            severity: SEVERITY.HIGH
          });
        }
      }

      return issues;
    }
  },

  {
    id: 'string-concatenation-loop',
    name: 'String Concatenation in Loop',
    severity: SEVERITY.MEDIUM,
    description: 'String concatenation using + operator in loops (use array join instead)',
    pattern: /\+\s*["']/g,
    check: (matches, file) => {
      const issues = [];
      let loopStringConcats = 0;

      for (const match of matches) {
        const lineNum = match.matches?.[0]?.line || 1;
        const startLine = Math.max(0, lineNum - 5);
        const contextLines = file.lines.slice(startLine, lineNum);

        const inLoop = contextLines.some(line =>
          /\b(while|for|foreach)\s*\(/.test(line)
        );

        if (inLoop) {
          loopStringConcats++;
        }
      }

      if (loopStringConcats > 3) {
        issues.push({
          line: 0,
          message: `Found ${loopStringConcats} string concatenations in loops - consider using arrays`,
          severity: SEVERITY.LOW
        });
      }

      return issues;
    }
  },

  {
    id: 'sleep-in-code',
    name: 'Sleep() Used',
    severity: SEVERITY.HIGH,
    description: 'Sleep() blocks the server thread - use CallLater instead',
    pattern: /\bSleep\s*\(/g,
    check: (matches, file) => {
      return matches.flatMap(m => m.matches.map(match => ({
        line: match.line,
        message: 'Sleep() blocks server execution - use CallLater/CallLaterEx for delayed operations',
        severity: SEVERITY.HIGH
      })));
    }
  },

  {
    id: 'spawning-entities-loop',
    name: 'Entity Spawning in Loop',
    severity: SEVERITY.CRITICAL,
    description: 'CreateObject/SpawnEntity called in tight loop without delay',
    pattern: /(CreateObject|CreateObjectEx|SpawnEntity)\s*\(/g,
    check: (matches, file) => {
      const issues = [];

      for (const match of matches) {
        const lineNum = match.matches?.[0]?.line || 1;
        const startLine = Math.max(0, lineNum - 10);
        const endLine = Math.min(file.lines.length, lineNum + 5);
        const contextLines = file.lines.slice(startLine, endLine);

        // Check if in a tight loop (for/while without CallLater delay)
        const inLoop = contextLines.some(line => /\b(while|for)\s*\(/.test(line));
        const hasDelay = contextLines.some(line => /CallLater|Sleep/.test(line));

        if (inLoop && !hasDelay) {
          issues.push({
            line: lineNum,
            message: 'Entity creation in tight loop without delay - can freeze server',
            severity: SEVERITY.CRITICAL
          });
        }
      }

      return issues;
    }
  },

  {
    id: 'update-frequency',
    name: 'High Frequency Update',
    severity: SEVERITY.MEDIUM,
    description: 'OnUpdate without throttling or very fast CallLater intervals',
    pattern: /CallLater\s*\([^,]+,\s*(\d+)/g,
    check: (matches, file) => {
      const issues = [];

      for (const match of matches) {
        const intervalMatch = match.matches?.[0]?.text.match(/,\s*(\d+)/);
        if (!intervalMatch) continue;

        const interval = parseInt(intervalMatch[1]);

        // Flag intervals under 100ms (very fast)
        if (interval < 100) {
          issues.push({
            line: match.matches[0].line,
            message: `Very fast CallLater interval (${interval}ms) - consider increasing for performance`,
            severity: interval < 50 ? SEVERITY.HIGH : SEVERITY.MEDIUM
          });
        }
      }

      return issues;
    }
  }
];
