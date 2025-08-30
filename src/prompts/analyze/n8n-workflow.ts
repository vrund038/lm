/**
 * n8n Workflow Analysis Plugin
 * Analyzes and optimizes n8n workflow JSON for efficiency and best practices
 */

import { BasePlugin } from '../../plugins/base-plugin.js';
import { IPromptPlugin } from '../../plugins/types.js';
import { ResponseFactory } from '../../validation/response-factory.js';
import { withSecurity } from '../../security/integration-helpers.js';
import { PromptStages } from '../../types/prompt-stages.js';

// Type definitions for n8n workflow analysis
interface N8nAnalysisContext {
  optimizationFocus?: string;
  includeCredentialCheck?: boolean;
  suggestAlternativeNodes?: boolean;
}

export class N8nWorkflowAnalyzer extends BasePlugin implements IPromptPlugin {
  name = 'analyze_n8n_workflow';
  category = 'analyze' as const;
  description = 'Analyze and optimize n8n workflow JSON for efficiency, error handling, and best practices';
  
  parameters = {
    workflow: {
      type: 'object' as const,
      description: 'n8n workflow JSON object',
      required: true
    },
    optimizationFocus: {
      type: 'string' as const,
      description: 'Primary optimization focus',
      required: false,
      enum: ['performance', 'error-handling', 'maintainability', 'all'],
      default: 'all'
    },
    includeCredentialCheck: {
      type: 'boolean' as const,
      description: 'Check for exposed credentials',
      required: false,
      default: true
    },
    suggestAlternativeNodes: {
      type: 'boolean' as const,
      description: 'Suggest alternative node configurations',
      required: false,
      default: true
    }
  };

  async execute(params: any, llmClient: any) {
    return await withSecurity(this, params, llmClient, async (secureParams) => {
      // Validate workflow is provided
      if (!secureParams.workflow) {
        throw new Error('workflow object is required');
      }
      
      // Prepare context
      const context: N8nAnalysisContext = {
        optimizationFocus: secureParams.optimizationFocus || 'all',
        includeCredentialCheck: secureParams.includeCredentialCheck !== false,
        suggestAlternativeNodes: secureParams.suggestAlternativeNodes !== false
      };
      
      try {
        // Get the loaded model from LM Studio
        const models = await llmClient.llm.listLoaded();
        if (models.length === 0) {
          throw new Error('No model loaded in LM Studio. Please load a model first.');
        }
        
        // Use the first loaded model
        const model = models[0];
        
        // Get 3-stage prompt
        const stages = this.getPromptStages({ workflow: secureParams.workflow, context });
        
        // Call the model with proper LM Studio SDK pattern
        const prediction = model.respond([
          {
            role: 'system',
            content: stages.systemAndContext
          },
          {
            role: 'user', 
            content: stages.dataPayload
          },
          {
            role: 'user',
            content: stages.outputInstructions
          }
        ], {
          temperature: 0.2,
          maxTokens: 4000
        });
        
        // Stream the response
        let response = '';
        for await (const chunk of prediction) {
          if (chunk.content) {
            response += chunk.content;
          }
        }
        
        // Use ResponseFactory for consistent, spec-compliant output
        ResponseFactory.setStartTime();
        return ResponseFactory.parseAndCreateResponse(
          'analyze_n8n_workflow',
          response,
          model.identifier || 'unknown'
        );
        
      } catch (error: any) {
        return ResponseFactory.createErrorResponse(
          'analyze_n8n_workflow',
          'MODEL_ERROR',
          `Failed to analyze n8n workflow: ${error.message}`,
          { originalError: error.message },
          'unknown'
        );
      }
    });
  }

  getPromptStages(params: any): PromptStages {
    const workflow = params.workflow;
    const context = params.context || {};
    
    const optimizationFocus = context.optimizationFocus || 'all';
    const includeCredentialCheck = context.includeCredentialCheck !== false;
    const suggestAlternativeNodes = context.suggestAlternativeNodes !== false;

    // STAGE 1: System instructions and context
    const systemAndContext = `You are an expert n8n workflow analyst specializing in workflow optimization and best practices.

Analysis Context:
- Optimization Focus: ${optimizationFocus}
- Credential Check: ${includeCredentialCheck ? 'Enabled' : 'Disabled'}
- Alternative Node Suggestions: ${suggestAlternativeNodes ? 'Enabled' : 'Disabled'}

Your expertise covers:
- Performance optimization and bottleneck identification
- Error handling patterns and resilience
- Security best practices and credential management
- Node efficiency and workflow structure
- Alternative node recommendations

Focus on providing actionable, practical recommendations with clear implementation steps.`;

    // STAGE 2: Data payload (the workflow JSON)
    const dataPayload = `n8n Workflow to Analyze:

\`\`\`json
${JSON.stringify(workflow, null, 2)}
\`\`\``;

    // STAGE 3: Output instructions
    const outputInstructions = `Analyze this n8n workflow and provide a comprehensive optimization report in the following structured format:

## Workflow Analysis Summary
- Overall complexity assessment
- Node count and flow efficiency
- Primary optimization opportunities

## Detailed Analysis

### 1. Efficiency Issues
- Redundant nodes or operations
- Duplicate API calls that could be consolidated
- Unnecessary data transformations
- Node consolidation opportunities

### 2. Error Handling Review
- Missing error handling (Error Trigger nodes)
- Proper try-catch pattern implementation
- Retry configurations and strategies
- Error notification setup

### 3. Performance Optimization
- Bottlenecks and synchronous operations
- Parallel processing opportunities
- API rate limiting considerations
- Memory usage with large datasets

${includeCredentialCheck ? `
### 4. Security Assessment
- Exposed credentials or API keys
- Sensitive data in logs
- Webhook authentication security
- Input sanitization validation
` : ''}

### 5. Maintainability Improvements
- Node naming conventions
- Workflow organization and grouping
- Sub-workflow opportunities
- Documentation completeness

${suggestAlternativeNodes ? `
### 6. Alternative Node Suggestions
- More efficient node alternatives
- Built-in vs custom code nodes
- Community node recommendations
- Simpler implementation approaches
` : ''}

## Implementation Recommendations
1. Priority changes (high impact, low effort)
2. Performance improvements with expected metrics
3. Step-by-step implementation guide
4. Risk assessment for proposed changes

## Optimized Workflow Structure
If applicable, suggest key structural improvements to the workflow design.

${this.getAdditionalInstructions(optimizationFocus)}

Be specific with node names and provide actionable recommendations with clear business impact.`;

    return {
      systemAndContext,
      dataPayload,
      outputInstructions
    };
  }

  private getAdditionalInstructions(focus: string): string {
    const instructions: Record<string, string> = {
      'performance': `
**Performance Focus Instructions:**
- Prioritize execution speed improvements
- Identify memory optimization opportunities
- Focus on API call efficiency
- Suggest parallel processing where possible
- Provide performance metrics estimates`,

      'error-handling': `
**Error Handling Focus Instructions:**
- Examine every failure point in the workflow
- Recommend comprehensive error recovery strategies
- Suggest proper retry logic configurations
- Focus on workflow resilience and reliability
- Include alerting and monitoring recommendations`,

      'maintainability': `
**Maintainability Focus Instructions:**
- Assess code complexity in function nodes
- Review workflow organization and structure
- Focus on documentation and clarity
- Suggest modularization opportunities
- Consider long-term maintenance implications`,

      'all': `
**Comprehensive Analysis Instructions:**
- Balance all aspects: performance, reliability, maintainability
- Prioritize recommendations by impact and implementation effort
- Consider scalability and future requirements
- Provide holistic optimization strategy`
    };

    return instructions[focus] || instructions['all'];
  }

  getPrompt(params: any): string {
    const stages = this.getPromptStages(params);
    return `${stages.systemAndContext}\n\n${stages.dataPayload}\n\n${stages.outputInstructions}`;
  }
}

export default N8nWorkflowAnalyzer;
