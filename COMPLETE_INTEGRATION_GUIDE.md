// Complete integration guide for updating index.ts with enhanced prompts
// This shows ALL the changes needed, including existing tools

// 1. Add imports at the top of index.ts:
import { enhancedToolDefinitions } from './enhanced-tool-definitions.js';
import { 
  createCodeStructurePrompt,
  createUnitTestPrompt,
  createDocumentationPrompt,
  createRefactoringPrompt,
  createWordPressPluginPrompt,
  createN8nWorkflowAnalysisPrompt,
  createResponsiveComponentPrompt,
  createTypeScriptConversionPrompt,
  createSecurityAuditPrompt
} from './enhanced-prompts.js';

// 2. Replace the tool registration section (around line 98-340) with:
// Instead of manually defining each tool, use the enhanced definitions
enhancedToolDefinitions.forEach(toolDef => {
  this.server.addTool(toolDef);
});

// 3. Update the request handler (starting around line 350) to handle ALL tools:
this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    switch (name) {
      // ENHANCED EXISTING TOOLS (with context support)
      case 'analyze_code_structure': {
        const { code, filePath, language, analysisDepth, context } = args;
        const content = code || await this.readFileContent(filePath);
        
        // Use enhanced prompt if context provided
        let prompt: string;
        if (context) {
          prompt = createCodeStructurePrompt(content, {
            ...context,
            language: language || context.language
          });
        } else {
          // Fallback to existing prompt for backward compatibility
          prompt = this.config.taskPrompts[TaskType.CODE_STRUCTURE].prompt(
            content,
            language
          );
        }
        
        const result = await this.callLMStudio(prompt);
        return { content: [{ type: 'text', text: result }] };
      }
      
      case 'generate_unit_tests': {
        const { code, filePath, language, testFramework, coverageTarget, context } = args;
        const content = code || await this.readFileContent(filePath);
        
        let prompt: string;
        if (context) {
          prompt = createUnitTestPrompt(content, {
            projectType: context.projectType || 'generic',
            testFramework: testFramework || 'jest',
            coverageTarget: coverageTarget === 'basic' ? 60 : 
                           coverageTarget === 'comprehensive' ? 80 : 90,
            ...context
          });
        } else {
          // Fallback to existing prompt
          prompt = this.config.taskPrompts[TaskType.GENERATE_TESTS].prompt(
            content,
            language,
            { framework: testFramework }
          );
        }
        
        const result = await this.callLMStudio(prompt);
        return { content: [{ type: 'text', text: result }] };
      }
      
      case 'generate_documentation': {
        const { code, filePath, language, docStyle, includeExamples, context } = args;
        const content = code || await this.readFileContent(filePath);
        
        let prompt: string;
        if (context) {
          prompt = createDocumentationPrompt(content, {
            projectType: context.projectType || 'generic',
            docStyle: docStyle || 'jsdoc',
            detailLevel: context.detailLevel || 'standard',
            includeExamples: includeExamples !== false,
            audience: context.audience || 'developer',
            ...context
          });
        } else {
          // Fallback to existing prompt
          prompt = this.config.taskPrompts[TaskType.DOCUMENT_FUNCTION].prompt(
            content,
            language,
            { docStyle }
          );
        }
        
        const result = await this.callLMStudio(prompt);
        return { content: [{ type: 'text', text: result }] };
      }
      
      case 'suggest_refactoring': {
        const { code, filePath, language, focusAreas, context } = args;
        const content = code || await this.readFileContent(filePath);
        
        let prompt: string;
        if (context) {
          prompt = createRefactoringPrompt(content, {
            projectType: context.projectType || 'generic',
            focusAreas: focusAreas || ['readability', 'maintainability'],
            ...context
          });
        } else {
          // Fallback to existing prompt
          prompt = this.config.taskPrompts[TaskType.SUGGEST_REFACTOR].prompt(
            content,
            language
          );
        }
        
        const result = await this.callLMStudio(prompt);
        return { content: [{ type: 'text', text: result }] };
      }
      
      // EXISTING TOOLS (unchanged, but still need to be handled)
      case 'detect_patterns': {
        const { code, filePath, language, patternTypes } = args;
        const content = code || await this.readFileContent(filePath);
        const prompt = this.config.taskPrompts[TaskType.CHECK_PATTERNS].prompt(
          content,
          language
        );
        const result = await this.callLMStudio(prompt);
        return { content: [{ type: 'text', text: result }] };
      }
      
      case 'validate_syntax': {
        const { code, filePath, language, strictMode } = args;
        const content = code || await this.readFileContent(filePath);
        const prompt = this.config.taskPrompts[TaskType.FIND_BUGS].prompt(
          content,
          language
        );
        const result = await this.callLMStudio(prompt);
        return { content: [{ type: 'text', text: result }] };
      }
      
      case 'suggest_variable_names': {
        const { code, filePath, language, namingConvention } = args;
        const content = code || await this.readFileContent(filePath);
        const prompt = this.config.taskPrompts[TaskType.VARIABLE_NAMES].prompt(
          content,
          language,
          { namingConvention }
        );
        const result = await this.callLMStudio(prompt);
        return { content: [{ type: 'text', text: result }] };
      }
      
      case 'analyze_file': {
        return this.handleFileAnalysis(args);
      }
      
      case 'analyze_csv_data': {
        return this.handleCsvAnalysis(args);
      }
      
      case 'health_check': {
        return this.handleHealthCheck(args);
      }
      
      // NEW TOOLS (from enhanced implementation)
      case 'generate_wordpress_plugin': {
        const prompt = createWordPressPluginPrompt(args);
        const result = await this.callLMStudio(prompt);
        return { content: [{ type: 'text', text: result }] };
      }
      
      case 'analyze_n8n_workflow': {
        const { workflow, optimizationFocus } = args;
        const prompt = createN8nWorkflowAnalysisPrompt(workflow);
        const result = await this.callLMStudio(prompt);
        return { content: [{ type: 'text', text: result }] };
      }
      
      case 'generate_responsive_component': {
        const prompt = createResponsiveComponentPrompt(args);
        const result = await this.callLMStudio(prompt);
        return { content: [{ type: 'text', text: result }] };
      }
      
      case 'convert_to_typescript': {
        const { code, filePath, ...tsContext } = args;
        const content = code || await this.readFileContent(filePath);
        const prompt = createTypeScriptConversionPrompt(content, tsContext);
        const result = await this.callLMStudio(prompt);
        return { content: [{ type: 'text', text: result }] };
      }
      
      case 'security_audit': {
        const { code, filePath, ...securityContext } = args;
        const content = code || await this.readFileContent(filePath);
        const prompt = createSecurityAuditPrompt(content, securityContext);
        const result = await this.callLMStudio(prompt);
        return { content: [{ type: 'text', text: result }] };
      }
      
      default: {
        throw new Error(`Unknown tool: ${name}`);
      }
    }
  } catch (error) {
    console.error(`Error in tool ${name}:`, error);
    return {
      content: [{
        type: 'text',
        text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }]
    };
  }
});

// 4. Existing helper methods remain unchanged:
// - handleFileAnalysis
// - handleCsvAnalysis  
// - handleHealthCheck
// - readFileContent
// - callLMStudio
// etc.
