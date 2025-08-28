/**
 * n8n Workflow Analysis Plugin
 * Analyzes and optimizes n8n workflow JSON for efficiency and best practices
 */

import { BasePlugin } from '../../plugins/base-plugin.js';
import { IPromptPlugin } from '../../plugins/types.js';

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
    // Validate workflow is provided
    if (!params.workflow) {
      throw new Error('workflow object is required');
    }
    
    // Prepare context
    const context: N8nAnalysisContext = {
      optimizationFocus: params.optimizationFocus || 'all',
      includeCredentialCheck: params.includeCredentialCheck !== false,
      suggestAlternativeNodes: params.suggestAlternativeNodes !== false
    };
    
    // Generate prompt
    const prompt = this.getPrompt({ workflow: params.workflow, context });
    
    // Execute and return
    const response = await llmClient.complete(prompt);
    
    // Format response
    return {
      content: response,
      metadata: {
        workflowNodes: params.workflow.nodes?.length || 0,
        optimizationFocus: context.optimizationFocus,
        checksPerformed: {
          credentials: context.includeCredentialCheck,
          alternativeNodes: context.suggestAlternativeNodes
        }
      }
    };
  }

  getPrompt(params: any): string {
    const workflow = params.workflow;
    const context = params.context || {};
    
    const optimizationFocus = context.optimizationFocus || 'all';
    const includeCredentialCheck = context.includeCredentialCheck !== false;
    const suggestAlternativeNodes = context.suggestAlternativeNodes !== false;
    
    return `Analyze this n8n workflow for optimization and best practices:

Workflow Data:
${JSON.stringify(workflow, null, 2)}

Optimization Focus: ${optimizationFocus}

Analysis Requirements:

1. **Efficiency Analysis**:
   - Identify redundant nodes or operations
   - Find duplicate API calls that could be consolidated
   - Detect unnecessary data transformations
   - Suggest node consolidation opportunities
   - Identify loops that could be optimized

2. **Error Handling Review**:
   - Check for proper error catching (Error Trigger nodes)
   - Identify nodes without error handling
   - Suggest try-catch patterns for critical operations
   - Review error notification setup
   - Validate retry configurations

3. **Performance Optimization**:
   - Identify potential bottlenecks (synchronous operations that could be parallel)
   - Check for large data processing without pagination
   - Review API rate limiting considerations
   - Suggest batch processing where applicable
   - Memory usage concerns with large datasets

4. **Security Assessment**:
   ${includeCredentialCheck ? `- Flag exposed credentials or API keys in code nodes
   - Check for sensitive data in logs
   - Review webhook security (authentication)
   - Identify data exposure risks
   - Validate input sanitization` : '- Security check skipped'}

5. **Maintainability Improvements**:
   - Suggest better node naming conventions
   - Recommend grouping related nodes
   - Identify complex flows that could be sub-workflows
   - Suggest documentation nodes (Sticky Notes)
   - Review variable naming in code nodes

6. **Best Practices Compliance**:
   - Use of proper node types (Code vs Function nodes)
   - Consistent data structure throughout workflow
   - Proper use of expressions vs static values
   - Environment variable usage for configuration
   - Webhook response handling

${suggestAlternativeNodes ? `
7. **Alternative Node Suggestions**:
   - More efficient node types for operations
   - Built-in nodes vs custom code
   - Community nodes that could help
   - Newer node versions with better features
   - Simpler approaches to achieve same result` : ''}

Provide:
1. **Optimization Summary**: Key improvements with impact assessment
2. **Refactored Workflow**: Updated JSON with improvements (if applicable)
3. **Implementation Guide**: Step-by-step changes needed
4. **Risk Assessment**: Potential issues with current setup
5. **Performance Metrics**: Expected improvements

Focus on practical improvements that enhance reliability and performance.

Additional Checks by Focus:
${this.getAdditionalChecks(optimizationFocus)}`;
  }

  private getAdditionalChecks(focus: string): string {
    const checks: Record<string, string> = {
      'performance': `
Performance-Specific Checks:
- Node execution time analysis
- Memory consumption patterns
- Database query optimization
- API call batching opportunities
- Parallel processing potential
- Caching strategies`,

      'error-handling': `
Error Handling-Specific Checks:
- Recovery strategies for each failure point
- Retry logic configuration
- Dead letter queue implementation
- Alert mechanism completeness
- Rollback procedures
- Data consistency checks`,

      'maintainability': `
Maintainability-Specific Checks:
- Code complexity in function nodes
- Documentation completeness
- Variable naming consistency
- Workflow modularity
- Version control friendliness
- Testing approach`,

      'all': `
Comprehensive Analysis:
- All performance optimizations
- Complete error handling review
- Full maintainability assessment
- Security audit
- Best practices compliance
- Future scalability considerations`
    };

    return checks[focus] || checks['all'];
  }
}

export default N8nWorkflowAnalyzer;
