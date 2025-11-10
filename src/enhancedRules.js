/**
 * Copyright (c) 2025 ozziehouso
 *
 * This file is part of a project that can be used and adapted via pull requests.
 * Redistribution or recreation of this code as a separate project is prohibited.
 * See LICENSE file for details.
 */

import { SEVERITY } from './rules.js';
import { DAYZ_FUNCTIONS, DAYZ_PATTERNS, COMMON_MISTAKES } from './dayzKnowledge.js';

export const enhancedRules = [
  {
    id: 'missing-super-call',
    name: 'Override Without super Call',
    severity: SEVERITY.HIGH,
    description: 'Override method missing super call - may break game functionality',
    pattern: /override\s+void\s+(OnInit|OnUpdate|OnMissionStart|OnMissionFinish|EEInit|EEDelete|EEKilled)\s*\([^)]*\)\s*\{/g,
    check: (matches, file) => {
      const issues = [];

      for (const match of matches) {
        const methodMatch = match.matches?.[0]?.text.match(/override\s+void\s+([A-Za-z_][A-Za-z0-9_]*)/);
        if (!methodMatch) continue;

        const methodName = methodMatch[1];
        const lineNum = match.matches[0].line;

        // Get the method body (next ~50 lines)
        const startLine = lineNum - 1;
        const endLine = Math.min(file.lines.length, startLine + 50);
        const methodBody = file.lines.slice(startLine, endLine).join('\n');

        // Check if super.MethodName() is called
        const superCallRegex = new RegExp(`super\\.${methodName}\\s*\\(`);
        const hasSuperCall = superCallRegex.test(methodBody);

        if (!hasSuperCall) {
          issues.push({
            line: lineNum,
            message: `Recommended: Override ${methodName}() should call super.${methodName}() to maintain vanilla functionality`,
            severity: SEVERITY.MEDIUM
          });
        }
      }

      return issues;
    }
  },

  {
    id: 'wrong-callqueue-category',
    name: 'Incorrect CallQueue Category',
    severity: SEVERITY.MEDIUM,
    description: 'CallQueue category may not be optimal for the operation',
    pattern: /GetGame\(\)\.GetCallQueue\((CALL_CATEGORY_[A-Z_]+)\)\.CallLater/g,
    check: (matches, file) => {
      const issues = [];

      for (const match of matches) {
        const categoryMatch = match.matches?.[0]?.text.match(/CALL_CATEGORY_([A-Z_]+)/);
        if (!categoryMatch) continue;

        const category = categoryMatch[1];
        const lineNum = match.matches[0].line;
        const lineText = file.lines[lineNum - 1] || '';

        // Check for potential misuse
        if (category === 'SYSTEM' && /Update.*Player|Player.*Update/i.test(lineText)) {
          issues.push({
            line: lineNum,
            message: 'Recommended: Use CALL_CATEGORY_GAMEPLAY for player-related updates (vanilla pattern)',
            severity: SEVERITY.LOW
          });
        }

        if (category === 'GAMEPLAY' && /GUI|UI|Menu|Widget/i.test(lineText)) {
          issues.push({
            line: lineNum,
            message: 'Info: Consider CALL_CATEGORY_GUI for UI-related operations',
            severity: SEVERITY.INFO
          });
        }
      }

      return issues;
    }
  },

  {
    id: 'getgame-spam',
    name: 'Excessive GetGame() Calls',
    severity: SEVERITY.LOW,
    description: 'Multiple GetGame() calls - consider caching the result',
    pattern: /GetGame\(\)/g,
    check: (matches, file) => {
      const issues = [];

      // Count GetGame() calls per function
      const functions = file.content.match(/void\s+[A-Za-z_][A-Za-z0-9_]*\s*\([^)]*\)\s*\{[^}]*\}/gs) || [];

      for (const func of functions) {
        const getGameCount = (func.match(/GetGame\(\)/g) || []).length;

        if (getGameCount > 5) {
          const funcMatch = func.match(/void\s+([A-Za-z_][A-Za-z0-9_]*)/);
          const funcName = funcMatch ? funcMatch[1] : 'unknown';

          issues.push({
            line: 0,
            message: `Info: Function '${funcName}' calls GetGame() ${getGameCount} times - consider caching: 'auto game = GetGame();'`,
            severity: SEVERITY.INFO
          });
        }
      }

      return issues;
    }
  },

  {
    id: 'inappropriate-update-interval',
    name: 'Non-Standard Update Interval',
    severity: SEVERITY.LOW,
    description: 'Update interval differs from vanilla patterns',
    pattern: /CallLater\s*\([^,]+,\s*(\d+)\s*,\s*true/g,
    check: (matches, file) => {
      const issues = [];
      const standardIntervals = [100, 500, 1000, 30000];

      for (const match of matches) {
        const intervalMatch = match.matches?.[0]?.text.match(/,\s*(\d+)\s*,\s*true/);
        if (!intervalMatch) continue;

        const interval = parseInt(intervalMatch[1]);
        const lineNum = match.matches[0].line;

        // Check if interval is non-standard and suspicious
        if (interval > 0 && interval < 30000 && !standardIntervals.includes(interval)) {
          const closest = standardIntervals.reduce((prev, curr) =>
            Math.abs(curr - interval) < Math.abs(prev - interval) ? curr : prev
          );

          issues.push({
            line: lineNum,
            message: `Info: Interval ${interval}ms is non-standard - vanilla typically uses ${closest}ms for similar operations`,
            severity: SEVERITY.INFO
          });
        }
      }

      return issues;
    }
  },

  {
    id: 'direct-player-iteration',
    name: 'Direct Player Array Iteration',
    severity: SEVERITY.MEDIUM,
    description: 'Iterating all players without scheduler pattern',
    pattern: /(foreach|for)\s*\([^)]*players[^)]*\)/gi,
    check: (matches, file) => {
      const issues = [];

      for (const match of matches) {
        const lineNum = match.matches?.[0]?.line || 1;
        const startLine = Math.max(0, lineNum - 15);
        const contextLines = file.lines.slice(startLine, lineNum + 10);
        const context = contextLines.join('\n');

        // Check if in OnUpdate or repeating CallLater
        const inUpdate = /override\s+void\s+OnUpdate/.test(context);
        const inRepeatingCall = /CallLater.*true/.test(context);

        // Check for scheduler pattern
        const hasScheduler = /SCHEDULER|_PER_TICK|currentPlayer|playerIndex/i.test(context);

        if ((inUpdate || inRepeatingCall) && !hasScheduler) {
          issues.push({
            line: lineNum,
            message: 'Recommended: Iterating all players in update loop - consider using scheduler pattern (e.g., SCHEDULER_PLAYERS_PER_TICK) like vanilla MissionServer',
            severity: SEVERITY.MEDIUM
          });
        }
      }

      return issues;
    }
  },

  {
    id: 'missing-destructor-cleanup',
    name: 'Missing Cleanup in Destructor',
    severity: SEVERITY.MEDIUM,
    description: 'Class uses resources but destructor doesn\'t clean them up',
    pattern: /class\s+([A-Za-z_][A-Za-z0-9_]*)/g,
    check: (matches, file) => {
      const issues = [];

      for (const match of matches) {
        const classMatch = match.matches?.[0]?.text.match(/class\s+([A-Za-z_][A-Za-z0-9_]*)/);
        if (!classMatch) continue;

        const className = classMatch[1];

        // Find class body
        const classRegex = new RegExp(`class\\s+${className}[^{]*\\{`, 's');
        const classStartIndex = file.content.search(classRegex);
        if (classStartIndex === -1) continue;

        // Extract class body (simplified - find matching braces)
        let braceCount = 0;
        let classEnd = classStartIndex;
        let started = false;

        for (let i = classStartIndex; i < file.content.length; i++) {
          if (file.content[i] === '{') {
            braceCount++;
            started = true;
          } else if (file.content[i] === '}') {
            braceCount--;
            if (started && braceCount === 0) {
              classEnd = i;
              break;
            }
          }
        }

        const classBody = file.content.substring(classStartIndex, classEnd);

        // Check for resource usage
        const usesCallLater = /CallLater/.test(classBody);
        const usesFileHandle = /FileHandle|OpenFile/.test(classBody);
        const usesTimers = /Timer|Schedule/.test(classBody);

        // Check for destructor
        const hasDestructor = new RegExp(`void\\s+~${className}`).test(classBody);

        // If has destructor, check if it cleans up
        if (hasDestructor && (usesCallLater || usesFileHandle || usesTimers)) {
          const destructorRegex = new RegExp(`void\\s+~${className}\\s*\\([^)]*\\)\\s*\\{([^}]+\\}[^}]*)*\\}`, 's');
          const destructorMatch = classBody.match(destructorRegex);

          if (destructorMatch) {
            const destructorBody = destructorMatch[0];
            const hasRemove = /\.Remove\s*\(/.test(destructorBody);
            const hasCloseFile = /CloseFile/.test(destructorBody);

            if (usesCallLater && !hasRemove) {
              issues.push({
                line: match.matches[0].line,
                message: `Recommended: Class '${className}' uses CallLater but destructor doesn't call Remove() - follow vanilla cleanup pattern`,
                severity: SEVERITY.MEDIUM
              });
            }

            if (usesFileHandle && !hasCloseFile) {
              issues.push({
                line: match.matches[0].line,
                message: `Recommended: Class '${className}' uses FileHandle but destructor doesn't call CloseFile()`,
                severity: SEVERITY.MEDIUM
              });
            }
          }
        } else if (!hasDestructor && (usesCallLater || usesFileHandle)) {
          issues.push({
            line: match.matches[0].line,
            message: `Recommended: Class '${className}' uses resources but has no destructor for cleanup`,
            severity: SEVERITY.MEDIUM
          });
        }
      }

      return issues;
    }
  },

  {
    id: 'unsafe-cast',
    name: 'Direct Cast Without Null Check',
    severity: SEVERITY.LOW,
    description: 'Cast operation without null validation',
    pattern: /([A-Za-z_][A-Za-z0-9_]*)\.Cast\s*\(/g,
    check: (matches, file) => {
      const issues = [];
      let unsafeCasts = 0;

      for (const match of matches) {
        const lineNum = match.matches?.[0]?.line || 1;
        const line = file.lines[lineNum - 1] || '';

        // Check if result is assigned
        const hasAssignment = /=/.test(line);

        if (hasAssignment) {
          // Check next few lines for null check
          const nextLines = file.lines.slice(lineNum, lineNum + 3).join('\n');
          const hasNullCheck = /if\s*\(\s*[^)]*\s*(==|!=)\s*null/.test(nextLines) ||
                               /if\s*\(\s*![^)]*\)/.test(nextLines);

          if (!hasNullCheck) {
            unsafeCasts++;
          }
        }
      }

      if (unsafeCasts > 5) {
        issues.push({
          line: 0,
          message: `Info: Found ${unsafeCasts} casts without null checks - consider validating cast results`,
          severity: SEVERITY.INFO
        });
      }

      return issues;
    }
  },

  {
    id: 'unsafe-method-call',
    name: 'Method Call Without Object Validation',
    severity: SEVERITY.MEDIUM,
    description: 'Method called on object that may be null (Enforce doc: lines 350-377)',
    pattern: /void\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/g,
    check: (matches, file) => {
      const issues = [];

      for (const match of matches) {
        const lineNum = match.matches?.[0]?.line || 1;
        const methodMatch = match.matches?.[0]?.text.match(/void\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/);
        if (!methodMatch) continue;

        const methodName = methodMatch[1];
        const params = methodMatch[2];

        // Check if method has object parameters
        const objectParams = params.match(/([A-Za-z_][A-Za-z0-9_]*)\s+([a-z_][a-z0-9_]*)/g);
        if (!objectParams) continue;

        // Get method body
        const startLine = lineNum - 1;
        const endLine = Math.min(file.lines.length, startLine + 50);
        const methodBody = file.lines.slice(startLine, endLine).join('\n');

        // For each object parameter, check if it's validated before use
        for (const paramStr of objectParams) {
          const paramMatch = paramStr.match(/[A-Za-z_][A-Za-z0-9_]*\s+([a-z_][a-z0-9_]*)/);
          if (!paramMatch) continue;

          const paramName = paramMatch[1];

          // Check if parameter is used with method calls
          const paramUsageRegex = new RegExp(`${paramName}\\.[A-Za-z_]`, 'g');
          const usages = methodBody.match(paramUsageRegex);

          if (usages && usages.length > 0) {
            // Check if there's a null check for this parameter
            const nullCheckRegex = new RegExp(`if\\s*\\(\\s*${paramName}\\s*\\)`);
            const hasNullCheck = nullCheckRegex.test(methodBody);

            if (!hasNullCheck) {
              issues.push({
                line: lineNum,
                message: `Recommended: Method '${methodName}' uses '${paramName}' without null check - see Enforce doc SafeMethod pattern`,
                severity: SEVERITY.LOW
              });
            }
          }
        }
      }

      return issues;
    }
  },

  {
    id: 'weak-reference-array',
    name: 'Array Without Strong References',
    severity: SEVERITY.MEDIUM,
    description: 'Array storing objects without ref keyword - objects may be deleted prematurely (Enforce doc: lines 1014-1018)',
    pattern: /array\s*<\s*([A-Za-z_][A-Za-z0-9_]*)\s*>/g,
    check: (matches, file) => {
      const issues = [];

      for (const match of matches) {
        const lineNum = match.matches?.[0]?.line || 1;
        const line = file.lines[lineNum - 1] || '';
        const arrayMatch = match.matches?.[0]?.text.match(/array\s*<\s*([A-Za-z_][A-Za-z0-9_]*)\s*>/);
        if (!arrayMatch) continue;

        const typeName = arrayMatch[1];

        // Check if it's a class type (not primitive)
        const isPrimitive = ['int', 'float', 'bool', 'string', 'vector'].includes(typeName);
        if (isPrimitive) continue;

        // Check if 'ref' keyword is present
        const hasRef = /array\s*<\s*ref\s+/.test(line);

        if (!hasRef) {
          // Check if array is inserted with objects
          const nextLines = file.lines.slice(lineNum, lineNum + 10).join('\n');
          const hasInsert = /\.Insert\s*\(\s*new\s+/.test(nextLines);

          if (hasInsert) {
            issues.push({
              line: lineNum,
              message: `Recommended: array<${typeName}> is weak reference array - use array<ref ${typeName}> to keep objects alive (Enforce ARC pattern)`,
              severity: SEVERITY.MEDIUM
            });
          }
        }
      }

      return issues;
    }
  },

  {
    id: 'cyclic-strong-reference',
    name: 'Potential Cyclic Strong Reference',
    severity: SEVERITY.MEDIUM,
    description: 'Two classes with strong references to each other may cause memory leaks (Enforce doc: lines 909-928)',
    pattern: /class\s+([A-Za-z_][A-Za-z0-9_]*)/g,
    check: (matches, file) => {
      const issues = [];
      const classes = new Map();

      // First pass: collect all classes and their strong references
      for (const match of matches) {
        const classMatch = match.matches?.[0]?.text.match(/class\s+([A-Za-z_][A-Za-z0-9_]*)/);
        if (!classMatch) continue;

        const className = classMatch[1];
        const lineNum = match.matches[0].line;

        // Find class body
        const classRegex = new RegExp(`class\\s+${className}[^{]*\\{`, 's');
        const classStartIndex = file.content.search(classRegex);
        if (classStartIndex === -1) continue;

        let braceCount = 0;
        let classEnd = classStartIndex;
        let started = false;

        for (let i = classStartIndex; i < file.content.length; i++) {
          if (file.content[i] === '{') {
            braceCount++;
            started = true;
          } else if (file.content[i] === '}') {
            braceCount--;
            if (started && braceCount === 0) {
              classEnd = i;
              break;
            }
          }
        }

        const classBody = file.content.substring(classStartIndex, classEnd);

        // Find strong references (ref keyword)
        const strongRefs = [];
        const refPattern = /ref\s+([A-Za-z_][A-Za-z0-9_]*)\s+m_/g;
        let refMatch;
        while ((refMatch = refPattern.exec(classBody)) !== null) {
          strongRefs.push(refMatch[1]);
        }

        classes.set(className, { lineNum, strongRefs });
      }

      // Second pass: detect cyclic references
      for (const [className, data] of classes.entries()) {
        for (const refType of data.strongRefs) {
          const referencedClass = classes.get(refType);
          if (referencedClass) {
            // Check if referenced class has strong ref back to this class
            if (referencedClass.strongRefs.includes(className)) {
              issues.push({
                line: data.lineNum,
                message: `Warning: '${className}' and '${refType}' have strong references to each other - may cause memory leak. Use weak reference pattern (Enforce ARC best practice)`,
                severity: SEVERITY.MEDIUM
              });
            }
          }
        }
      }

      return issues;
    }
  },

  {
    id: 'modded-without-super',
    name: 'Modded Class Override Without super',
    severity: SEVERITY.HIGH,
    description: 'Modded class override without super call breaks mod compatibility (Enforce doc: lines 1067-1090)',
    pattern: /modded\s+class\s+([A-Za-z_][A-Za-z0-9_]*)/g,
    check: (matches, file) => {
      const issues = [];

      for (const match of matches) {
        const classMatch = match.matches?.[0]?.text.match(/modded\s+class\s+([A-Za-z_][A-Za-z0-9_]*)/);
        if (!classMatch) continue;

        const className = classMatch[1];

        // Find class body
        const classRegex = new RegExp(`modded\\s+class\\s+${className}[^{]*\\{`, 's');
        const classStartIndex = file.content.search(classRegex);
        if (classStartIndex === -1) continue;

        let braceCount = 0;
        let classEnd = classStartIndex;
        let started = false;

        for (let i = classStartIndex; i < file.content.length; i++) {
          if (file.content[i] === '{') {
            braceCount++;
            started = true;
          } else if (file.content[i] === '}') {
            braceCount--;
            if (started && braceCount === 0) {
              classEnd = i;
              break;
            }
          }
        }

        const classBody = file.content.substring(classStartIndex, classEnd);

        // Find all override methods
        const overridePattern = /override\s+void\s+([A-Za-z_][A-Za-z0-9_]*)\s*\([^)]*\)\s*\{/g;
        let overrideMatch;

        while ((overrideMatch = overridePattern.exec(classBody)) !== null) {
          const methodName = overrideMatch[1];
          const methodStart = overrideMatch.index;

          // Get method body (approximation)
          let methodBraceCount = 0;
          let methodEnd = methodStart;
          let methodStarted = false;

          for (let i = methodStart; i < classBody.length; i++) {
            if (classBody[i] === '{') {
              methodBraceCount++;
              methodStarted = true;
            } else if (classBody[i] === '}') {
              methodBraceCount--;
              if (methodStarted && methodBraceCount === 0) {
                methodEnd = i;
                break;
              }
            }
          }

          const methodBody = classBody.substring(methodStart, methodEnd);

          // Check for super call
          const superCallRegex = new RegExp(`super\\.${methodName}\\s*\\(`);
          if (!superCallRegex.test(methodBody)) {
            issues.push({
              line: match.matches[0].line,
              message: `IMPORTANT: Modded class '${className}' override '${methodName}' missing super call - breaks mod compatibility! (Enforce modding pattern)`,
              severity: SEVERITY.HIGH
            });
          }
        }
      }

      return issues;
    }
  }
];
