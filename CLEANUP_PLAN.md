# Local LLM MCP Cleanup Plan

## Files to KEEP (Essential for MCP Server)

### Root Directory
- `.git/` (Git repository)
- `.gitignore`
- `package.json` (NPM configuration)
- `package-lock.json` (NPM lock file)
- `tsconfig.json` (TypeScript configuration)
- `README.md` (Documentation)
- `LICENSE`
- `CHANGELOG.md`
- `add-shebang.js` (Build script)

### Source Code (src/)
- `index.ts` (Main entry point)
- `config.ts`
- `types.ts`
- `security-config.ts`
- `enhanced-prompts.ts`
- `enhanced-tool-definitions.ts`
- `enhanced-tool-definitions-multifile.ts`
- `enhanced-types.ts`

### Core Modules (src/core/)
- `FileContextManager.ts`
- `MultiFileAnalysis.ts`
- `ResponseFormatter.ts`

### Utils (src/utils/)
- `streamHandler.ts`

### Distribution (dist/)
- Keep entire directory (compiled output)

### Node Modules
- `node_modules/` (Dependencies - can be regenerated with npm install)

### Tests (Essential for validation)
- `tests/core.test.ts`
- `tests/integration.test.mjs`
- `tests/tools.test.mjs`
- `jest.config.js`

### Diagnostics (Useful for troubleshooting)
- `diagnostics/run-diagnostics.mjs`
- `diagnostics/check-claude-processes.mjs`

## Files to REMOVE (Not essential for MCP operation)

### Documentation/Notes (Move to separate docs folder or archive)
- `CORRECTED_CONFIG_AND_USAGE.md`
- `CREATE_GITHUB_RELEASE.md`
- `FIX_STREAMING_COMPLETE.md`
- `GETTING_STARTED.md`
- `HANDOVER_FIX_STARTUP_CRASH.md`
- `HANDOVER_TO_NEW_THREAD.md`
- `MIGRATION_GUIDE.md`
- `MIGRATION_GUIDE_V3.md`
- `PRIVATE_INSTALLATION.md`
- `QUICK_REFERENCE.md`
- `RELEASE_NOTES_v3.0.3.md`
- `RELEASE_NOTES_v3.0.4.md`
- `RELEASE_NOTES_v3.0.5.md`
- `SECURITY_CONFIG.md`
- `TROUBLESHOOTING.md`
- `WEEK1_COMPLETE.md`
- `WEEK1_VALIDATION_WEEK2_PLAN.md`
- `new-requirements_raw.txt`

### Old/Backup Files
- `fix-index.md`
- `handleLLMTool-fix.ts`
- `diagnostic-report.json`
- `test-fix-confirmation.ps1`
- `src/index-original.ts`
- `src/index.ts.backup`
- `src/enhanced-index.ts`
- `src/enhanced-integration-example.ts`
- `src/enhanced-prompts-helper.ts`

### Test Files (Not core tests)
- `test-connection.mjs`
- `test-llm-streaming.mjs`
- `test-multifile.mjs`
- `test-response-quality.mjs`
- `test-streaming-fix.mjs`
- `test-files/` directory

### Example Configuration
- `claude_config_example.json`

### GitHub Actions (unless actively using CI/CD)
- `.github/` directory
- `.npmignore` (if not publishing to NPM)

## Recommended Actions

1. Create an `archive` folder and move all documentation files there
2. Remove old test files and backups
3. Keep only essential source files
4. Run `npm run build` to ensure everything still compiles
5. Test the MCP server to verify it works after cleanup

## Directory Structure After Cleanup

```
local-llm-mcp/
├── .git/
├── node_modules/
├── dist/
├── src/
│   ├── core/
│   │   ├── FileContextManager.ts
│   │   ├── MultiFileAnalysis.ts
│   │   └── ResponseFormatter.ts
│   ├── utils/
│   │   └── streamHandler.ts
│   ├── index.ts
│   ├── config.ts
│   ├── types.ts
│   ├── security-config.ts
│   ├── enhanced-prompts.ts
│   ├── enhanced-tool-definitions.ts
│   ├── enhanced-tool-definitions-multifile.ts
│   └── enhanced-types.ts
├── tests/
│   ├── core.test.ts
│   ├── integration.test.mjs
│   └── tools.test.mjs
├── diagnostics/
│   ├── run-diagnostics.mjs
│   └── check-claude-processes.mjs
├── .gitignore
├── package.json
├── package-lock.json
├── tsconfig.json
├── jest.config.js
├── add-shebang.js
├── README.md
├── LICENSE
└── CHANGELOG.md
```

## Total Files Reduction
- Before: ~50+ files
- After: ~25 essential files
- Removed: 25+ documentation/test/backup files
