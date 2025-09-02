# Local LLM MCP: Fix Mode Detection Logic Across All Plugins

## TASK OVERVIEW
Fix inconsistent mode detection logic across all plugin files to match the vanilla template standard. This is causing single-file analysis to fail with "Either projectPath or files array must be provided" errors.

## ROOT CAUSE IDENTIFIED
Plugin files have modified mode detection that checks multi-file indicators BEFORE single-file indicators, causing default parameter conflicts. The vanilla template uses the correct priority order.

## AFFECTED LOCATION
**Directory**: `C:\MCP\local-llm-mcp\src\prompts\`
**Files**: All `.ts` files in subdirectories (`analyze/`, `generate/`, `system/`, `custom/`, etc.)
**Method**: `detectAnalysisMode(params: any): 'single-file' | 'multi-file'`

## THE FIX REQUIRED

### ❌ CURRENT BROKEN PATTERN (in plugin files):
```typescript
private detectAnalysisMode(params: any): 'single-file' | 'multi-file' {
  // Multi-file indicators checked FIRST (WRONG PRIORITY)
  if (params.projectPath || params.files || params.maxDepth !== undefined) {
    return 'multi-file';
  }
  
  // Single-file indicators checked SECOND
  if (params.code || params.filePath) {
    return 'single-file';
  }
  
  // Various defaults
  return 'single-file' | 'multi-file';
}
```

### ✅ CORRECT TEMPLATE PATTERN (from vanilla template):
```typescript
private detectAnalysisMode(params: any): 'single-file' | 'multi-file' {
  // Single-file indicators take priority (avoids default parameter issues)
  if (params.code || params.filePath) {
    return 'single-file';
  }
  
  // Multi-file indicators
  if (params.projectPath || params.files) {
    return 'multi-file';
  }
  
  // Default based on plugin purpose
  return 'single-file'; // or 'multi-file' depending on plugin
}
```

## WHY THIS MATTERS
When a user provides `filePath`, plugins add default values like `maxDepth: 5`. The broken pattern sees `maxDepth !== undefined` first and incorrectly returns `'multi-file'`, causing validation to fail.

The correct pattern checks `params.filePath` first and correctly returns `'single-file'` before defaults interfere.

## SPECIFIC CHANGES NEEDED

### 1. Priority Order Fix
- Move single-file checks (`params.code || params.filePath`) to FIRST position
- Move multi-file checks (`params.projectPath || params.files`) to SECOND position  
- Remove `params.maxDepth !== undefined` from multi-file detection (it's a default parameter, not a user indicator)

### 2. Default Return Value
Choose appropriate default based on plugin purpose:
- **File-focused plugins** (code analysis, linting): `return 'single-file'`
- **Project-focused plugins** (architecture, counting, project analysis): `return 'multi-file'`

## PROCESS INSTRUCTIONS

### Step 1: Discovery
List all plugin files that contain `detectAnalysisMode` method:
```bash
# Search pattern in C:\MCP\local-llm-mcp\src\prompts\
find . -name "*.ts" -exec grep -l "detectAnalysisMode" {} \;
```

### Step 2: Analysis  
For each file found:
1. Read the current `detectAnalysisMode` implementation
2. Identify if it uses the broken pattern (multi-file checks first)
3. Determine appropriate default return value based on plugin purpose

### Step 3: Fix Implementation
For each broken file:
1. Replace the `detectAnalysisMode` method with the correct template pattern
2. Set appropriate default return value
3. Ensure no other logic changes are made

### Step 4: Verification
After fixes:
1. Build the project: `npm run build`
2. Test both single-file and multi-file analysis on a sample plugin
3. Confirm no "Either projectPath or files array must be provided" errors

## REFERENCE FILES

### Template Source (CORRECT):
`C:\MCP\local-llm-mcp\src\templates\plugin-template.ts` - Lines ~120-135

### Example of Broken File:
`C:\MCP\local-llm-mcp\src\prompts\analyze\count-files.ts` - Lines ~120-135

### Expected File Count:
Approximately 20-30 plugin files across all prompt categories

## SUCCESS CRITERIA
- ✅ All plugin files use consistent mode detection logic matching template
- ✅ Single-file analysis works with `filePath` parameter
- ✅ Multi-file analysis continues to work with `projectPath` parameter  
- ✅ No validation errors for legitimate single-file requests
- ✅ Project builds successfully after changes

## CRITICAL NOTES
- This is a **systematic consistency fix**, not a template change
- The vanilla template logic is correct and should not be modified
- Only the plugin implementations need updating to match the template standard
- This affects user experience but doesn't change core functionality
- Test thoroughly as this impacts all plugin mode detection behavior

## CONTEXT
This issue was discovered when testing website analysis functionality. The security fixes for HTML/CSS file support are working correctly, but single-file analysis fails due to this mode detection priority bug across all plugin files.

**Current Status**: Multi-file analysis works perfectly, single-file analysis blocked by validation logic mismatch.