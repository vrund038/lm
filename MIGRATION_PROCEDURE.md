# Local LLM MCP Plugin Migration Procedure v4.3

*Migration from legacy patterns to modern v4.2 architecture with utilities*

## Overview

This document provides a step-by-step procedure for migrating existing plugins to use the new modern architecture with shared utilities, proper caching, and dynamic token calculation.

## Pre-Migration Checklist

Before starting any migration:

1. ✅ **Backup current working state**
   ```bash
   cd C:\MCP\local-llm-mcp
   git add . && git commit -m "Pre-migration backup"
   ```

2. ✅ **Verify utilities are working**
   ```bash
   npm run build
   # Should build successfully without errors
   ```

3. ✅ **Test template compiles**
   - Template location: `src/templates/plugin-template.ts`
   - Should have no TypeScript errors

## Migration Procedure

### Phase 1: Analysis and Planning

**For each plugin file to migrate:**

1. **Identify the plugin location**
   ```
   Example: src/prompts/analyze/single-file.ts
   ```

2. **Determine plugin characteristics**
   - [ ] Single-file analysis (has `code`/`filePath` parameters)
   - [ ] Multi-file analysis (has `projectPath`/`files` parameters)  
   - [ ] Generation plugin (generates code/content)
   - [ ] System plugin (utility/management functions)

3. **Identify legacy patterns**
   - [ ] Hardcoded `maxTokens` values (2000, 4000, etc.)
   - [ ] Manual model setup (`llmClient.llm.listLoaded()`)
   - [ ] Custom streaming response collection
   - [ ] Duplicated parameter validation
   - [ ] Legacy `getPrompt()` method implementation
   - [ ] Custom error handling patterns

### Phase 2: Migration Execution

**Step 1: Create backup of original plugin**
```bash
cp src/prompts/[category]/[plugin-name].ts src/prompts/[category]/[plugin-name].ts.backup
```

**Step 2: Copy template as starting point**
```bash
cp src/templates/plugin-template.ts src/prompts/[category]/[plugin-name].ts
```

**Step 3: Replace template placeholders**

Replace these placeholders in the new file:

| Placeholder | Replace With | Example |
|-------------|--------------|---------|
| `TEMPLATE_UniversalPlugin` | Your class name | `SecurityAuditPlugin` |
| `TEMPLATE_function_name` | MCP function name | `security_audit` |
| `analyze` (in category) | Actual category | `multifile` |
| `TEMPLATE_type1`, `TEMPLATE_type2` | Your analysis types | `security`, `performance` |

**Step 4: Preserve original parameter definitions**

Copy the `parameters` object from the original plugin:
```typescript
// From original plugin
parameters = {
  projectPath: { type: 'string', required: true },
  auditDepth: { type: 'string', enum: ['basic', 'comprehensive'] },
  // ... keep your existing parameters
};
```

**Step 5: Implement prompt stages methods**

**For single-file plugins:**
- Implement `getSingleFilePromptStages(params): PromptStages`
- Copy prompt logic from original `getPromptStages()` method

**For multi-file plugins:**  
- Implement `getSingleFilePromptStages(params): PromptStages` (if applicable)
- Implement `getMultiFilePromptStages(params): PromptStages`
- Copy prompt logic from original `getPromptStages()` method

**Step 6: Migrate custom logic**

Preserve any custom logic from the original plugin:
- Custom validation in `validateSecureParams()`
- File discovery logic in `discoverRelevantFiles()` 
- Individual file analysis in `analyzeIndividualFile()`
- Custom helper methods

**Step 7: Update analysis types and extensions**

Update `getFileExtensions()` method with your specific file types:
```typescript
private getFileExtensions(analysisType: string): string[] {
  const extensionMap: Record<string, string[]> = {
    'security': ['.js', '.ts', '.php', '.py'],
    'performance': ['.js', '.ts', '.jsx', '.tsx'],
    'comprehensive': ['.js', '.ts', '.php', '.py', '.java', '.cpp']
  };
  return extensionMap[analysisType] || extensionMap.comprehensive;
}
```

### Phase 3: Testing and Validation

**Step 1: Build test**
```bash
npm run build
```
- Should compile without errors
- Fix any TypeScript issues

**Step 2: Functionality test**
```bash
# Restart Claude Desktop to pick up changes
# Test the migrated function
```

**Step 3: Compare outputs**
- Test with same inputs as original plugin
- Verify outputs are equivalent or better
- Check that caching works (second call should be faster)

**Step 4: Performance validation**
- Monitor token usage - should be dynamic, not hardcoded
- Check context utilization - should use more tokens for larger models
- Verify caching works - repeated calls should hit cache

### Phase 4: Cleanup

**Step 1: Remove legacy `getPrompt()` method**
The new template doesn't need the legacy method since it's automatically handled by the base class.

**Step 2: Clean up imports**
Remove any imports that are now handled by utilities:
```typescript
// Remove these types of imports:
import { readFileContent } from '../shared/helpers.js'; // ✅ Keep this
import { ResponseFactory } from '../../validation/response-factory.js'; // ❌ Remove - handled by utilities
import { withSecurity } from '../../security/integration-helpers.js'; // ✅ Keep this
```

**Step 3: Remove backup file (if migration successful)**
```bash
rm src/prompts/[category]/[plugin-name].ts.backup
```

## Migration Priority Order

Migrate plugins in this recommended order:

### High Priority (Core functionality)
1. **`src/prompts/analyze/single-file.ts`** - Most used plugin
2. **`src/prompts/generate/unit-tests.ts`** - High usage
3. **`src/prompts/generate/documentation.ts`** - High usage

### Medium Priority (Specialized analysis)
4. **`src/prompts/multifile/security-audit.ts`** - Complex multi-file
5. **`src/prompts/multifile/project-documentation.ts`** - Multi-file
6. **`src/prompts/analyze/project-structure.ts`** - Project-level

### Lower Priority (Specialized tools)
7. **`src/prompts/generate/wordpress-plugin.ts`** - Specialized
8. **`src/prompts/generate/typescript-conversion.ts`** - Specialized  
9. **System plugins** - Usually simpler

## Common Migration Issues and Solutions

### Issue: Type errors with ResponseFactory
**Solution:** Utilities handle ResponseFactory calls with proper typing

### Issue: Cache type mismatches  
**Solution:** Ensure your analysis results match the AnalysisResult interface:
```typescript
{
  summary: string;
  findings?: any[];
  data?: any;
}
```

### Issue: Import path errors
**Solution:** Use relative imports correctly:
- From `src/prompts/analyze/`: `import { ... } from '../../utils/plugin-utilities.js'`
- From `src/prompts/multifile/`: `import { ... } from '../../utils/plugin-utilities.js'`

### Issue: Multi-file analysis not working
**Solution:** Check that `getFileExtensions()` returns appropriate extensions for your analysis type

## Validation Checklist

After migration, each plugin should:

- [ ] ✅ Compile without TypeScript errors
- [ ] ✅ Use dynamic token calculation (no hardcoded maxTokens)
- [ ] ✅ Use utilities (ModelSetup, ResponseProcessor, etc.)
- [ ] ✅ Have working cache (second identical call is faster)
- [ ] ✅ Handle both single-file and multi-file scenarios (if applicable)
- [ ] ✅ Produce equivalent or better results than original
- [ ] ✅ Follow security patterns (withSecurity wrapper)
- [ ] ✅ Have clean error handling (via ErrorHandler utility)

## Post-Migration Benefits

After migration, each plugin will have:

1. **🚀 Better Performance**
   - Dynamic token calculation utilizing full model context
   - Intelligent caching reducing repeat analysis time
   - Batch processing for multi-file operations

2. **🔧 Easier Maintenance**  
   - Shared utilities handle common patterns
   - Consistent error handling and validation
   - Single template to reference for patterns

3. **📈 Better Scalability**
   - Automatic adaptation to different model sizes
   - Memory management through caching system
   - Efficient multi-file processing

4. **🛡️ Modern Architecture**
   - Clean separation of concerns
   - Type-safe interfaces
   - Future-ready for prompt caching integration

## Files Changed Per Migration

**Per plugin migration touchpoints:**
- ✅ **1 file replaced:** `src/prompts/[category]/[plugin].ts`
- ✅ **0 utility files changed:** All common code is in shared utilities
- ✅ **0 core system changes:** Uses existing infrastructure

**This keeps migration surgical and low-risk!** 🎯

---

*Use this procedure for systematic migration of all legacy plugins to modern v4.2 architecture.*