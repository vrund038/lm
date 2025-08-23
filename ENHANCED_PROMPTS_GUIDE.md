# Local LLM MCP - Enhanced Prompts Implementation Guide

## Overview
This guide explains how to implement the enhanced, context-aware prompts for the Local LLM MCP server. The improvements focus on domain-specific knowledge, better output formatting, and framework awareness.

## File Structure
```
src/
├── enhanced-types.ts      # New context-aware type definitions
├── enhanced-prompts.ts    # Improved prompt templates
├── enhanced-config.ts     # Configuration with new prompts (to be created)
└── enhanced-index.ts      # Updated server implementation (to be created)
```

## Key Improvements

### 1. Context-Aware Types
The `enhanced-types.ts` file introduces context objects that capture project-specific information:

```typescript
interface ProjectContext {
  projectType: ProjectType;  // wordpress-plugin, n8n-node, react-app, etc.
  framework?: string;
  standards?: string[];
  targetAudience?: 'developer' | 'end-user' | 'admin';
  // ... more context
}
```

### 2. Enhanced Prompt Templates
Each prompt now accepts context and generates more specific instructions:

```typescript
// Example: Code structure analysis with context
const prompt = createCodeStructurePrompt(content, {
  projectType: 'wordpress-plugin',
  language: 'PHP',
  framework: 'WordPress',
  standards: ['WordPress Coding Standards', 'PSR-12']
});
```

### 3. New Tools Added
- `generate_wordpress_plugin` - Complete plugin scaffolding
- `analyze_n8n_workflow` - Workflow optimization
- `generate_responsive_component` - Accessible HTML/CSS components
- `convert_to_typescript` - JS to TS conversion with proper types
- `security_audit` - Project-specific security analysis

## Implementation Steps

### Step 1: Update Dependencies
```bash
cd C:\MCP\local-llm-mcp
npm install
```

### Step 2: Create Enhanced Configuration
Create `src/enhanced-config.ts`:

```typescript
import { EnhancedConfig, TaskType } from './enhanced-types';
import { enhancedPromptCreators } from './enhanced-prompts';

export const enhancedConfig: EnhancedConfig = {
  // Keep existing config values
  lmStudioUrl: process.env.LM_STUDIO_URL || 'ws://localhost:1234/v1/chat/completions',
  modelName: process.env.MODEL_NAME || 'default',
  temperature: 0.3,
  maxTokens: 4000,
  topP: 0.9,
  timeout: 120000,
  maxFileSize: 200 * 1024 * 1024,
  supportedFileTypes: [/* existing types */],
  
  // Enhanced task prompts
  taskPrompts: {
    [TaskType.CODE_STRUCTURE]: {
      systemPrompt: (context) => `You are an expert ${context?.projectType || 'code'} analyzer.`,
      prompt: enhancedPromptCreators[TaskType.CODE_STRUCTURE],
      validateContext: (context) => true,
    },
    // ... map all other tasks
  },
  
  // Project defaults (can be overridden per request)
  projectDefaults: {
    projectType: 'generic',
    standards: ['clean code principles'],
    targetAudience: 'developer'
  },
  
  // Security configuration
  securityConfig: {
    allowedPaths: ['C:\\MCP', 'C:\\Dev', process.cwd()],
    blockedPatterns: ['node_modules', '.git', '.env'],
    maxRequestsPerMinute: 60
  }
};
```

### Step 3: Update Tool Handlers
Modify the server to accept and use context:

```typescript
// In enhanced-index.ts
async function handleEnhancedCodeAnalysis(params: any): Promise<TaskResponse> {
  const { filePath, content, context } = params;
  
  // Validate context
  if (context && !validateProjectContext(context)) {
    return { success: false, error: 'Invalid project context' };
  }
  
  // Get content
  const codeContent = content || await readFileContent(filePath);
  
  // Create contextual prompt
  const prompt = enhancedPromptCreators[TaskType.CODE_STRUCTURE](
    codeContent,
    context || enhancedConfig.projectDefaults
  );
  
  // Call LLM with enhanced prompt
  const result = await callLMStudio(prompt);
  
  return {
    success: true,
    result,
    metadata: {
      contextApplied: !!context,
      projectType: context?.projectType || 'generic'
    }
  };
}
```

### Step 4: Add New Tool Registrations
Register the new tools in the server:

```typescript
// New tool registrations
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    // Existing tools with enhanced prompts...
    
    // New tools
    case 'generate_wordpress_plugin':
      return handleWordPressPluginGeneration(request.params.arguments);
    
    case 'analyze_n8n_workflow':
      return handleN8nWorkflowAnalysis(request.params.arguments);
    
    case 'generate_responsive_component':
      return handleComponentGeneration(request.params.arguments);
    
    case 'convert_to_typescript':
      return handleTypeScriptConversion(request.params.arguments);
    
    case 'security_audit':
      return handleSecurityAudit(request.params.arguments);
  }
});
```

## Usage Examples

### Example 1: WordPress Plugin Analysis with Context
```typescript
// From Claude
const result = await local_llm.analyze_code_structure({
  filePath: 'C:\\Dev\\wp-plugins\\my-plugin\\my-plugin.php',
  context: {
    projectType: 'wordpress-plugin',
    language: 'PHP',
    framework: 'WordPress',
    frameworkVersion: '6.0',
    standards: ['WordPress Coding Standards']
  }
});
```

### Example 2: Generate WordPress Plugin
```typescript
const plugin = await local_llm.generate_wordpress_plugin({
  pluginRequirements: {
    name: 'Custom Analytics',
    description: 'Track custom events in WordPress',
    features: ['event tracking', 'admin dashboard', 'REST API'],
    prefix: 'ca',
    includeAdmin: true,
    includeRest: true,
    includeDatabase: true
  }
});
```

### Example 3: Security Audit with Context
```typescript
const audit = await local_llm.security_audit({
  filePath: 'C:\\Dev\\api\\auth.js',
  securityContext: {
    projectType: 'node-api',
    auditDepth: 'comprehensive',
    includeOwasp: true,
    includeDependencies: true
  }
});
```

## Testing the Enhanced Implementation

### 1. Test Context Validation
```javascript
// test-enhanced-prompts.js
const testContext = {
  projectType: 'wordpress-plugin',
  language: 'PHP',
  standards: ['WordPress Coding Standards']
};

// Should generate WordPress-specific analysis
const result = await testEnhancedPrompt('CODE_STRUCTURE', testContext);
```

### 2. Test New Tools
```javascript
// Test WordPress plugin generation
const pluginTest = await testTool('generate_wordpress_plugin', {
  name: 'Test Plugin',
  description: 'Test',
  features: ['admin page'],
  prefix: 'tp'
});

// Verify structure includes all required files
assert(pluginTest.includes('class-tp-activator.php'));
```

### 3. Performance Comparison
Compare token usage with and without context:
- Generic prompt: ~500 tokens
- Context-aware prompt: ~300 tokens (due to focused analysis)

## Migration Strategy

### Phase 1: Parallel Implementation
1. Keep existing prompts functional
2. Add enhanced prompts as optional feature
3. Test with real projects

### Phase 2: Gradual Migration
1. Update Claude integration to use context
2. Migrate one tool at a time
3. Monitor quality improvements

### Phase 3: Full Deployment
1. Make context-aware prompts default
2. Deprecate generic prompts
3. Update documentation

## Benefits Achieved

### 1. Better Output Quality
- Domain-specific insights
- Framework-aware suggestions
- Relevant security checks

### 2. Token Efficiency
- Focused prompts = fewer tokens
- Better first-time results
- Less back-and-forth needed

### 3. Developer Experience
- Consistent output format
- Predictable results
- Less prompt engineering needed

## Next Steps

1. **Implement prompt versioning** - Track which prompts work best
2. **Add prompt templates library** - Reusable patterns
3. **Create feedback loop** - Learn from usage patterns
4. **Build context presets** - Quick setup for common projects

## Troubleshooting

### Issue: Context not being applied
- Check context validation
- Verify correct TaskType mapping
- Enable debug logging

### Issue: Prompts too long
- Use context to focus analysis
- Break into multiple smaller tasks
- Increase maxTokens if needed

### Issue: Inconsistent output format
- Enforce output format in prompt
- Add post-processing step
- Use structured output parsing

## Conclusion
The enhanced prompts significantly improve the Local LLM MCP's ability to provide domain-specific, high-quality assistance while preserving Claude's context window. The context-aware approach ensures that routine tasks are handled with the same expertise as if done by a specialist developer.