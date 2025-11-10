# DayZ Mod Performance Analyzer

Automated performance analysis tool for DayZ mods. Detects common performance issues and provides actionable recommendations.

## Features

- **Deep Code Analysis** - Scans all `.c` and `.cpp` files in your mod
- **20+ Performance Checks** - Based on official DayZ patterns and Enforce Script best practices
- **Smart Detection** - Identifies critical issues before they impact your server
- **Detailed Reports** - Color-coded console output with severity ratings
- **Performance Score** - Get a 0-100 score for your mod's performance
- **JSON Export** - Save detailed reports for CI/CD integration
- **Web Interface** - Beautiful dark-themed UI for easy analysis

## Quick Start
You can visit https://dayzcodez.dev to use this tool, or create PR's to make this a great analyzer for DayZ PC Mods

### Installation

```bash
npm install
```

### CLI Usage

```bash
# Analyze a mod
node src/cli.js path/to/your/mod.zip

# Save JSON report
node src/cli.js mod.zip --output report.json

# Quiet mode (summary only)
node src/cli.js mod.zip --quiet
```

### Web Interface

```bash
npm run dev
```

Then open `http://localhost:3000` in your browser.

## What It Checks

The analyzer detects **20+ performance patterns** across 4 severity levels:

### Critical Issues (3 rules)
- **World Scans in Loops** - Large radius scans called repeatedly
- **File I/O in Loops** - File operations inside loops
- **Entity Spawning in Loops** - Creating objects in tight loops

### High Severity (5 rules)
- **GetPlayers() Spam** - Called in OnUpdate without rate limiting
- **RPC Spam** - Network calls in loops
- **Sleep() Usage** - Blocking server thread
- **High Frequency Updates** - Very fast CallLater intervals (<100ms)
- **Modded Class Without super** - Missing super calls in modded classes

### Medium Severity (7 rules)
- **Missing Destructors** - Classes with resources but no cleanup
- **CallLater Without Remove** - Scheduled callbacks never removed
- **Cyclic Strong References** - Memory leak patterns (ARC)
- **Weak Reference Arrays** - Arrays storing objects without `ref` keyword
- **Direct Player Iteration** - Looping all players without scheduler pattern
- **Missing Object Validation** - Method calls on potentially null objects
- **String Concatenation in Loops** - Inefficient string building

### Low Severity (5+ rules)
- **Unsafe Casts** - Type casts without null checks
- **GetGame() Caching** - Multiple GetGame() calls in hot paths
- **Non-Standard Intervals** - Update intervals differing from vanilla
- **CallQueue Category** - Potentially incorrect CALL_CATEGORY usage
- And more...

## Performance Score

The tool assigns a score from 0-100:

- **90-100**: EXCELLENT
- **75-89**: GOOD
- **60-74**: FAIR
- **40-59**: POOR
- **0-39**: CRITICAL

## Example Output

```
================================================================================
  DayZ Mod Performance Analysis Report
================================================================================

Summary:
   Files Analyzed: 10
   Total Issues:   5

   Issues by Severity:
     HIGH:     2
     MEDIUM:   3

Performance Score:
   85/100 - GOOD

Issues Found:

  HIGH (2):
    GetPlayers() Called Frequently
       scripts/5_Mission/MyMod/MissionServer.c:45
       Recommended: GetPlayers() in OnUpdate should be rate limited

    World Scan in Loop
       scripts/4_World/MyMod/EntityScanner.c:78
       Potential issue: Large radius world scan - consider optimizing

Recommendations:
   HIGH severity patterns may cause performance problems.
   Recommended: Review and optimize before production use.
```

## Exit Codes

- `0` - No critical or high severity issues
- `1` - High severity issues found
- `2` - Critical issues found

Perfect for CI/CD pipelines!

## Common Fixes

### GetPlayers() Spam
Add rate limiting:
```c
float m_LastCheckTime;

void OnUpdate(float timeslice) {
    float currentTime = GetGame().GetTime() / 1000.0;
    if (currentTime - m_LastCheckTime < 1.0) return;
    m_LastCheckTime = currentTime;

    GetGame().GetPlayers(players);
}
```

### CallLater Without Remove
Always clean up in destructor:
```c
void ~MyClass() {
    GetGame().GetCallQueue(CALL_CATEGORY_SYSTEM).Remove(MyFunction);
}
```

### Weak Reference Arrays
Use `ref` keyword for object arrays:
```c
// Bad - objects deleted immediately
array<MyClass> items = new array<MyClass>();

// Good - keeps objects alive
array<ref MyClass> items = new array<ref MyClass>();
```

## Technical Details

### Rules Engine
The analyzer uses pattern matching and context analysis to detect issues:
- Regex-based pattern detection
- Context-aware validation (checks surrounding code)
- Severity scoring based on impact
- False positive mitigation

### Based On
- Official DayZ script patterns (MissionServer.c, etc.)
- Bohemia Interactive Enforce Script Syntax documentation
- Community best practices

### Limitations
This is a static analysis tool. It cannot detect:
- Runtime performance issues
- Algorithmic complexity (O(n²) problems)
- Issues spanning multiple files
- Context-specific optimizations

**Always review suggestions in context.**

## Adding Custom Rules

Edit `src/rules.js` or `src/enhancedRules.js`:

```javascript
{
  id: 'my-custom-rule',
  name: 'My Custom Check',
  severity: SEVERITY.HIGH,
  description: 'What this checks',
  pattern: /YourPattern/g,
  check: (matches, file) => {
    const issues = [];
    // Your logic here
    return issues;
  }
}
```

## Web Interface Features

- Drag & drop mod upload
- Real-time analysis
- Interactive results
- Dark theme
- Mobile responsive
- No data retention (files deleted after analysis)

## License

MIT License - See LICENSE file for details

## Contributing

Issues and pull requests welcome! Please check existing issues before creating new ones.

## Resources

- [DayZ Enforce Script Syntax](https://community.bistudio.com/wiki/DayZ:Enforce_Script_Syntax)
- [DayZ Modding Discord](https://discord.com/invite/enfusion-modders-452035973786632194)
- [Bohemia Forums](https://forums.bohemia.net/)

---

**Disclaimer:** This tool provides automated suggestions based on pattern matching. Always review flagged code in context. Not all flagged patterns are problems, and not all problems will be detected.
