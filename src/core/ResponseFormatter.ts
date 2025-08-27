/**
 * ResponseFormatter - Ensures all responses are structured, actionable JSON
 */

export interface ActionItem {
  file: string;
  line: number;
  operation: 'replace' | 'insert' | 'delete';
  code: string;
  validated: boolean;
  reason?: string;
}

export interface VerificationStep {
  command: string;
  expectedOutput?: string;
  description?: string;
}

export interface FormattedResponse {
  summary: string;
  confidence: number;
  
  actions: {
    critical: ActionItem[];
    recommended: ActionItem[];
    optional: ActionItem[];
  };
  
  verification?: {
    commands: string[];
    expectedOutput?: string;
    testCases?: string[];
  };
  
  metadata: {
    filesAnalyzed: number;
    tokensSaved: number;
    executionTime: number;
    timestamp: string;
  };
  
  details?: any;
  warnings?: string[];
  errors?: string[];
}

export class ResponseFormatter {
  private startTime: number;
  
  constructor() {
    this.startTime = Date.now();
  }
  
  /**
   * Format a response ensuring it's always actionable JSON
   */
  format(
    data: {
      summary?: string;
      confidence?: number;
      critical?: ActionItem[];
      recommended?: ActionItem[];
      optional?: ActionItem[];
      verification?: any;
      filesAnalyzed?: number;
      details?: any;
      warnings?: string[];
      errors?: string[];
      rawResponse?: string;
    }
  ): FormattedResponse {
    const executionTime = (Date.now() - this.startTime) / 1000;
    
    // Parse raw LLM response if provided
    if (data.rawResponse && !data.summary) {
      const parsed = this.parseRawResponse(data.rawResponse);
      data = { ...data, ...parsed };
    }
    
    // Ensure all action items are validated
    const critical = this.validateActions(data.critical || []);
    const recommended = this.validateActions(data.recommended || []);
    const optional = this.validateActions(data.optional || []);
    
    // Calculate token savings
    const tokensSaved = this.calculateTokenSavings(data);
    
    return {
      summary: data.summary || 'Analysis complete',
      confidence: data.confidence || 0.8,
      
      actions: {
        critical,
        recommended,
        optional
      },
      
      verification: data.verification ? {
        commands: Array.isArray(data.verification) ? data.verification : [data.verification],
        expectedOutput: data.verification?.expectedOutput,
        testCases: data.verification?.testCases
      } : undefined,
      
      metadata: {
        filesAnalyzed: data.filesAnalyzed || 1,
        tokensSaved,
        executionTime,
        timestamp: new Date().toISOString()
      },
      
      details: data.details,
      warnings: data.warnings,
      errors: data.errors
    };
  }
  
  /**
   * Parse raw LLM text response into structured format
   */
  private parseRawResponse(rawResponse: string): any {
    const result: any = {
      summary: '',
      critical: [],
      recommended: [],
      optional: []
    };
    
    try {
      // Try to parse as JSON first
      const jsonMatch = rawResponse.match(/```json\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      
      // Extract summary (first paragraph or line)
      const lines = rawResponse.split('\n');
      result.summary = lines[0].replace(/^#+\s*/, '').trim();
      
      // Look for action items
      const actionRegex = /(?:FIX|CHANGE|ADD|UPDATE|REPLACE|INSERT|DELETE).*?(?:line|Line)\s*(\d+).*?:(.*?)(?=\n(?:FIX|CHANGE|ADD|UPDATE|REPLACE|INSERT|DELETE)|$)/gs;
      let match;
      
      while ((match = actionRegex.exec(rawResponse)) !== null) {
        const action: ActionItem = {
          file: 'unknown', // Would need context to determine
          line: parseInt(match[1]),
          operation: this.detectOperation(match[0]),
          code: match[2].trim(),
          validated: false
        };
        
        // Categorize by keywords
        if (match[0].toLowerCase().includes('critical') || match[0].toLowerCase().includes('error')) {
          result.critical.push(action);
        } else if (match[0].toLowerCase().includes('should') || match[0].toLowerCase().includes('recommended')) {
          result.recommended.push(action);
        } else {
          result.optional.push(action);
        }
      }
      
      // Extract confidence if mentioned
      const confidenceMatch = rawResponse.match(/confidence[:\s]+(\d+(?:\.\d+)?)/i);
      if (confidenceMatch) {
        result.confidence = parseFloat(confidenceMatch[1]);
        if (result.confidence > 1) result.confidence /= 100; // Convert percentage
      }
      
    } catch (error) {
      console.error('Error parsing raw response:', error);
    }
    
    return result;
  }
  
  /**
   * Detect operation type from text
   */
  private detectOperation(text: string): 'replace' | 'insert' | 'delete' {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('delete') || lowerText.includes('remove')) {
      return 'delete';
    } else if (lowerText.includes('add') || lowerText.includes('insert')) {
      return 'insert';
    } else {
      return 'replace';
    }
  }
  
  /**
   * Validate action items have required fields
   */
  private validateActions(actions: ActionItem[]): ActionItem[] {
    return actions.map(action => ({
      file: action.file || 'unknown',
      line: action.line || 0,
      operation: action.operation || 'replace',
      code: action.code || '',
      validated: action.validated !== false,
      reason: action.reason
    }));
  }
  
  /**
   * Calculate approximate tokens saved
   */
  private calculateTokenSavings(data: any): number {
    // Rough estimation: 
    // - Each file analyzed saves ~500 tokens vs Claude reading it
    // - Each action item saves ~100 tokens vs describing the fix
    
    const filesAnalyzed = data.filesAnalyzed || 1;
    const totalActions = 
      (data.critical?.length || 0) + 
      (data.recommended?.length || 0) + 
      (data.optional?.length || 0);
    
    return (filesAnalyzed * 500) + (totalActions * 100);
  }
  
  /**
   * Format for specific output types
   */
  formatAsMarkdown(response: FormattedResponse): string {
    let md = `# ${response.summary}\n\n`;
    md += `**Confidence:** ${(response.confidence * 100).toFixed(0)}%\n\n`;
    
    if (response.actions.critical.length > 0) {
      md += `## Critical Actions\n\n`;
      for (const action of response.actions.critical) {
        md += `- **${action.file}:${action.line}** - ${action.operation}\n`;
        md += `  \`\`\`\n  ${action.code}\n  \`\`\`\n`;
      }
    }
    
    if (response.actions.recommended.length > 0) {
      md += `## Recommended Actions\n\n`;
      for (const action of response.actions.recommended) {
        md += `- **${action.file}:${action.line}** - ${action.operation}\n`;
        md += `  \`\`\`\n  ${action.code}\n  \`\`\`\n`;
      }
    }
    
    if (response.verification) {
      md += `## Verification\n\n`;
      for (const cmd of response.verification.commands) {
        md += `- \`${cmd}\`\n`;
      }
    }
    
    md += `\n---\n`;
    md += `*Analyzed ${response.metadata.filesAnalyzed} files in ${response.metadata.executionTime}s*\n`;
    md += `*Saved approximately ${response.metadata.tokensSaved} tokens*\n`;
    
    return md;
  }
  
  /**
   * Format as executable script
   */
  formatAsScript(response: FormattedResponse, scriptType: 'bash' | 'powershell' | 'node'): string {
    const scripts: string[] = [];
    
    if (scriptType === 'bash') {
      scripts.push('#!/bin/bash');
      scripts.push('# Auto-generated fix script');
      scripts.push(`# ${response.summary}`);
      scripts.push('');
      
      for (const action of response.actions.critical) {
        if (action.operation === 'replace') {
          scripts.push(`# Fix: ${action.file}:${action.line}`);
          scripts.push(`sed -i '${action.line}s/.*/${action.code}/' ${action.file}`);
        }
      }
    } else if (scriptType === 'powershell') {
      scripts.push('# Auto-generated fix script');
      scripts.push(`# ${response.summary}`);
      scripts.push('');
      
      for (const action of response.actions.critical) {
        if (action.operation === 'replace') {
          scripts.push(`# Fix: ${action.file}:${action.line}`);
          scripts.push(`(Get-Content ${action.file})[${action.line - 1}] = '${action.code}'`);
        }
      }
    }
    
    return scripts.join('\n');
  }
}

/**
 * Singleton instance for easy access
 */
export const responseFormatter = new ResponseFormatter();
