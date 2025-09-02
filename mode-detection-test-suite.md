# Local LLM MCP Mode Detection Test Suite

## OBJECTIVE
Test the recently fixed `detectAnalysisMode` methods across all 10 plugins to verify that single-file analysis now works correctly with `filePath` parameter, and multi-file analysis remains unaffected.

## SETUP
**Test Directory**: `C:\MCP\local-llm-mcp\src\plugins`  
**Issue Fixed**: Mode detection priority inversion that caused single-file analysis to fail with "Either projectPath or files array must be provided" errors.

## TEST SCENARIOS

### 🔧 **CRITICAL TEST: Single-File Analysis with filePath**
**Expected Behavior**: Should work without validation errors
**Previous Issue**: Failed due to `maxDepth !== undefined` priority bug

Test these functions with `filePath` parameter:

```javascript
// ANALYZE FUNCTIONS (Priority Test)
1. local-llm:find_pattern_usage
   - filePath: "C:/MCP/local-llm-mcp/src/prompts/analyze/count-files.ts"
   - patterns: ["detectAnalysisMode", "private"]
   - Expected: Should analyze single file for patterns WITHOUT requiring projectPath

2. local-llm:analyze_single_file  
   - filePath: "C:/MCP/local-llm-mcp/src/prompts/analyze/security-audit.ts"
   - analysisDepth: "detailed"
   - Expected: Should analyze code quality and structure

3. local-llm:trace_execution_path
   - filePath: "C:/MCP/local-llm-mcp/src/prompts/generate/unit-tests.ts"
   - entryPoint: "execute"
   - Expected: Should trace execution within single file

// GENERATE FUNCTIONS (Priority Test)
4. local-llm:generate_unit_tests
   - filePath: "C:/MCP/local-llm-mcp/src/prompts/analyze/diff-signatures.ts"
   - testFramework: "jest"
   - Expected: Should generate tests for single file

5. local-llm:suggest_refactoring
   - filePath: "C:/MCP/local-llm-mcp/src/prompts/generate/refactoring.ts"
   - focusAreas: ["readability", "performance"]
   - Expected: Should provide refactoring suggestions for single file

6. local-llm:generate_project_documentation
   - filePath: "C:/MCP/local-llm-mcp/src/plugins/base-plugin.ts"
   - docStyle: "markdown"
   - Expected: Should document single file

// FUN FUNCTIONS (Priority Test)
7. local-llm:css_art_generator
   - filePath: "C:/MCP/local-llm-mcp/src/prompts/fun/css-art-generator.ts"
   - artType: "drawing"
   - Expected: Should analyze existing CSS art file

8. local-llm:arcade_game
   - filePath: "C:/MCP/local-llm-mcp/src/prompts/fun/arcade-game.ts"
   - gameType: "shooter"
   - Expected: Should enhance existing game file
```

### ✅ **CONFIRMATION TEST: Multi-File Analysis Still Works**
**Expected Behavior**: Should continue working as before

```javascript
// Test multi-file functionality remains intact
9. local-llm:find_pattern_usage
   - projectPath: "C:/MCP/local-llm-mcp/src/prompts"
   - patterns: ["detectAnalysisMode"]
   - maxDepth: 3
   - Expected: Should analyze entire project directory

10. local-llm:analyze_project_structure
    - projectPath: "C:/MCP/local-llm-mcp/src/plugins"
    - analysisDepth: "detailed"
    - Expected: Should analyze full plugin directory structure
```

## SUCCESS CRITERIA

### ✅ **FIXED ISSUES (Should Now Work)**
- No "Either projectPath or files array must be provided" errors when using `filePath`
- Single-file analysis completes successfully with meaningful results
- Mode detection correctly identifies single-file vs multi-file scenarios

### ✅ **PRESERVED FUNCTIONALITY (Should Still Work)**
- Multi-file analysis with `projectPath` works unchanged
- All domain-specific logic maintained (e.g., WordPress theme conversion logic)
- Default return values appropriate for each plugin's purpose

### ❌ **FAILURE INDICATORS**
- Validation errors when using `filePath` parameter
- Mode detection choosing wrong analysis mode
- Broken multi-file functionality
- Truncated or missing code in plugin files

## DETAILED TEST EXECUTION

### **Phase 1: Quick Validation (5 tests)**
Run these first to verify the core fix:
1. `local-llm:find_pattern_usage` with `filePath` (most likely to fail before fix)
2. `local-llm:suggest_refactoring` with `filePath` (common single-file use case)
3. `local-llm:generate_unit_tests` with `filePath` (generation testing)
4. `local-llm:find_pattern_usage` with `projectPath` (multi-file confirmation)
5. `local-llm:analyze_project_structure` with `projectPath` (complex multi-file)

### **Phase 2: Comprehensive Testing (10 functions)**
If Phase 1 passes, test all 10 previously broken functions with both single-file and multi-file parameters.

### **Phase 3: Edge Case Testing**
- Test with both `filePath` AND `projectPath` provided (should choose single-file)
- Test with invalid file paths (should handle gracefully)
- Test with empty parameters (should use appropriate defaults)

## REPORTING FORMAT

For each test, report:
```
✅/❌ Function: local-llm:function_name
Parameters: [list key parameters]
Mode Detected: single-file | multi-file
Result: Success | Error
Error Details: [if any]
Analysis Quality: [brief assessment of output]
```

## BACKGROUND CONTEXT

**What Was Fixed**: 
- Priority inversion in `detectAnalysisMode` methods
- Removed dangerous `params.maxDepth !== undefined` checks
- Applied consistent template pattern across all plugins

**Files Modified**:
- find-patterns.ts, project-structure-legacy.ts, trace-execution.ts
- wordpress-theme-from-static.ts, unit-tests.ts, refactoring.ts, project-documentation.ts  
- css-art-generator.ts, arcade-game.ts
- (diff-signatures.ts was already fixed in previous commit)

**Expected Impact**: Single-file analysis should now work reliably while maintaining all existing multi-file functionality.

---

**Ready for testing! Start with Phase 1 for quick validation, then proceed to comprehensive testing if the core fix is working correctly.**