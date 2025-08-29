# Local LLM MCP - Functional Specification v4.2

*Last Updated: August 2025*  
*Current Version: 4.2.0*  
*Architecture: Modern Plugin System with Security Integration*

## Overview

This document provides comprehensive functional specifications for the Local LLM MCP server v4.2. All functions are fully implemented using the modern plugin architecture with integrated security wrappers, response factory patterns, and dynamic context window management.

**Key Features:**
- **Universal Security**: All functions use `withSecurity` wrapper
- **Consistent Responses**: ResponseFactory for spec-compliant outputs  
- **Context Management**: ThreeStagePromptManager for large operations
- **Dynamic Chunking**: Automatic file and context chunking
- **Modern LM Studio SDK**: Latest streaming patterns and model detection

---

## 1. Analysis Functions

### 1.1 `analyze_single_file`
**Purpose**: Analyze code structure, patterns, and quality for a single file with optional framework-specific context.

#### Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `code` | string | No* | - | Raw code to analyze |
| `filePath` | string | No* | - | Path to file to analyze |
| `language` | string | No | "javascript" | Programming language |
| `analysisDepth` | enum | No | "detailed" | Level of analysis: "basic", "detailed", "comprehensive" |
| `context` | object | No | {} | Framework-specific context |

*Note: Either `code` or `filePath` must be provided

#### Context Object Structure
```typescript
{
  projectType?: "wordpress-plugin" | "wordpress-theme" | "react-app" | "react-component" | 
               "n8n-node" | "node-api" | "html-component" | "generic",
  framework?: string,           // e.g., "WordPress", "React", "Express"
  frameworkVersion?: string,    // e.g., "6.0", "18.2.0"
  environment?: "browser" | "node" | "wordpress" | "hybrid",
  standards?: string[]          // e.g., ["WordPress Coding Standards", "PSR-12"]
}
```

#### Response Structure
```typescript
{
  success: boolean,
  timestamp: string,
  modelUsed: string,
  executionTimeMs: number,
  data: {
    summary: string,
    structure: {
      classes: string[],
      functions: string[],
      imports: string[],
      exports: string[],
      dependencies: string[]
    },
    metrics: {
      linesOfCode: number,
      cyclomaticComplexity: number,
      cognitiveComplexity?: number,
      maintainabilityIndex?: number
    },
    findings: Array<{
      type: "issue" | "suggestion" | "info",
      severity: "critical" | "high" | "medium" | "low",
      message: string,
      line?: number,
      column?: number
    }>,
    patterns: string[],
    suggestions: string[]
  }
}
```

---

### 1.2 `analyze_project_structure`
**Purpose**: Analyze complete project structure and architecture with dependency mapping.

#### Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `projectPath` | string | Yes | - | Absolute path to project root |
| `maxDepth` | number | No | 3 | Maximum directory depth to analyze |
| `focusAreas` | string[] | No | [] | Areas: "architecture", "dependencies", "complexity", "patterns" |

#### Response Structure
```typescript
{
  success: boolean,
  data: {
    overview: {
      totalFiles: number,
      totalDirectories: number,
      languages: { [language: string]: number },
      size: string,
      lastModified: string
    },
    architecture: {
      type: string,
      layers: string[],
      mainComponents: Array<{
        name: string,
        path: string,
        type: string,
        dependencies: string[]
      }>
    },
    dependencies: {
      internal: Array<{
        from: string,
        to: string,
        type: string
      }>,
      external: { [package: string]: string }
    },
    metrics: {
      complexity: {
        average: number,
        highest: { file: string, value: number }
      },
      maintainability: number,
      testCoverage?: number
    },
    patterns: string[],
    issues: Array<{
      type: string,
      severity: string,
      description: string,
      location?: string
    }>,
    recommendations: string[]
  }
}
```

---

### 1.3 `analyze_n8n_workflow`
**Purpose**: Analyze and optimize n8n workflow JSON for efficiency and best practices.

#### Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `workflow` | object | Yes | - | n8n workflow JSON object |
| `optimizationFocus` | enum | No | "all" | Focus: "performance", "error-handling", "maintainability", "all" |
| `includeCredentialCheck` | boolean | No | true | Check for exposed credentials |
| `suggestAlternativeNodes` | boolean | No | true | Suggest alternative node configurations |

#### Response Structure
```typescript
{
  success: boolean,
  data: {
    summary: {
      nodeCount: number,
      connectionCount: number,
      complexity: "simple" | "moderate" | "complex",
      estimatedExecutionTime?: string,
      hasErrorHandling: boolean,
      hasCredentialIssues: boolean
    },
    issues: Array<{
      nodeId: string,
      nodeName: string,
      type: "error" | "warning" | "suggestion",
      category: "performance" | "error-handling" | "security" | "structure",
      message: string,
      fix?: string
    }>,
    optimizations: Array<{
      type: "merge-nodes" | "parallel-execution" | "caching" | "batch-processing",
      description: string,
      nodes: string[],
      estimatedImprovement?: string
    }>,
    alternativeNodes?: Array<{
      currentNode: string,
      suggestedNode: string,
      reason: string
    }>,
    credentials?: {
      exposed: boolean,
      issues: string[]
    }
  }
}
```

---

## 2. Generation Functions

### 2.1 `generate_unit_tests`
**Purpose**: Generate comprehensive unit tests with framework-specific patterns.

#### Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `code` | string | No* | - | Code to test |
| `filePath` | string | No* | - | Path to code file |
| `language` | string | No | "javascript" | Programming language |
| `testFramework` | string | No | "jest" | Testing framework |
| `coverageTarget` | enum | No | "comprehensive" | Target: "basic", "comprehensive", "edge-cases" |
| `context` | object | No | {} | Framework-specific context |

*Note: Either `code` or `filePath` must be provided

#### Context Object Structure
```typescript
{
  projectType?: string,
  testStyle?: "bdd" | "tdd" | "aaa" | "given-when-then",
  mockStrategy?: "minimal" | "comprehensive" | "integration-preferred",
  includeEdgeCases?: boolean,      // Default: true
  includePerformanceTests?: boolean // Default: false
}
```

#### Response Structure
```typescript
{
  success: boolean,
  data: {
    tests: string,
    coverage: {
      functions: string[],
      branches: number,
      lines: number
    },
    testCount: number,
    testTypes: {
      unit: number,
      integration?: number,
      performance?: number,
      edgeCases?: number
    },
    mocks: string[],
    setupRequired: string[]
  }
}
```

---

### 2.2 `generate_documentation`
**Purpose**: Generate documentation with audience-specific formatting.

#### Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `code` | string | No* | - | Code to document |
| `filePath` | string | No* | - | Path to code file |
| `language` | string | No | "javascript" | Programming language |
| `docStyle` | enum | No | "jsdoc" | Style: "jsdoc", "markdown", "docstring", "javadoc", "phpdoc" |
| `includeExamples` | boolean | No | true | Include usage examples |
| `context` | object | No | {} | Documentation context |

#### Response Structure
```typescript
{
  success: boolean,
  data: {
    documentation: string,
    sections: {
      overview?: string,
      installation?: string,
      usage?: string,
      api?: string,
      examples?: string,
      troubleshooting?: string,
      contributing?: string
    },
    metadata: {
      functions: number,
      classes: number,
      totalLines: number,
      docCoverage: number
    }
  }
}
```

---

### 2.3 `suggest_refactoring`
**Purpose**: Analyze code and suggest refactoring improvements.

#### Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `code` | string | No* | - | Code to refactor |
| `filePath` | string | No* | - | Path to code file |
| `language` | string | No | "javascript" | Programming language |
| `focusAreas` | string[] | No | ["readability", "maintainability"] | Focus areas |
| `context` | object | No | {} | Refactoring context |

#### Focus Areas
- `readability`, `performance`, `maintainability`, `testability`
- `security`, `type-safety`, `error-handling`, `logging`, `documentation`

#### Response Structure
```typescript
{
  success: boolean,
  data: {
    suggestions: Array<{
      type: string,
      priority: "high" | "medium" | "low",
      location: { start: number, end: number },
      description: string,
      before: string,
      after: string,
      benefits: string[],
      risks?: string[]
    }>,
    metrics: {
      currentComplexity: number,
      targetComplexity: number,
      improvementScore: number
    },
    refactoredCode?: string
  }
}
```

---

### 2.4 `generate_wordpress_plugin`
**Purpose**: Generate complete WordPress plugin structure.

#### Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `name` | string | Yes | - | Plugin name |
| `description` | string | Yes | - | Plugin description |
| `features` | string[] | Yes | - | List of features to include |
| `prefix` | string | Yes | - | Function/class prefix |
| `textDomain` | string | No | - | Text domain for i18n |
| `wpVersion` | string | No | "6.0" | Minimum WordPress version |
| `phpVersion` | string | No | "7.4" | Minimum PHP version |
| `includeAdmin` | boolean | No | true | Include admin interface |
| `includeDatabase` | boolean | No | false | Include database tables |
| `includeAjax` | boolean | No | false | Include AJAX handlers |
| `includeRest` | boolean | No | false | Include REST API endpoints |
| `includeGutenberg` | boolean | No | false | Include Gutenberg blocks |

#### Response Structure
```typescript
{
  success: boolean,
  data: {
    files: Array<{
      path: string,
      content: string,
      description: string
    }>,
    structure: {
      mainFile: string,
      directories: string[],
      totalFiles: number
    },
    features: {
      implemented: string[],
      hooks: string[],
      shortcodes?: string[],
      blocks?: string[],
      endpoints?: string[]
    },
    instructions: {
      installation: string,
      configuration: string,
      usage: string
    }
  }
}
```

---

### 2.5 `generate_responsive_component`
**Purpose**: Generate responsive, accessible HTML/CSS components.

#### Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `name` | string | Yes | - | Component name |
| `type` | enum | Yes | - | Component type |
| `framework` | enum | No | "vanilla" | Framework to use |
| `responsive` | boolean | No | true | Make component responsive |
| `accessible` | boolean | No | true | Include accessibility features |
| `darkMode` | boolean | No | false | Include dark mode support |
| `animations` | boolean | No | false | Include animations |
| `designSystem` | string | No | "custom" | Design system to follow |

#### Component Types
- `button`, `form`, `card`, `modal`, `navigation`, `layout`, `custom`

#### Frameworks
- `vanilla`, `react`, `vue`, `angular`, `svelte`

#### Response Structure
```typescript
{
  success: boolean,
  data: {
    component: {
      html: string,
      css: string,
      javascript?: string,
      framework?: string
    },
    features: {
      responsive: boolean,
      accessible: boolean,
      darkMode: boolean,
      animations: boolean,
      browserSupport: string[]
    },
    accessibility: {
      ariaAttributes: string[],
      keyboardSupport: string[],
      screenReaderSupport: boolean,
      wcagLevel: string
    },
    usage: string
  }
}
```

---

### 2.6 `convert_to_typescript`
**Purpose**: Convert JavaScript to TypeScript with comprehensive type annotations.

#### Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `code` | string | No* | - | JavaScript code to convert |
| `filePath` | string | No* | - | Path to JavaScript file |
| `strict` | boolean | No | true | Use strict TypeScript mode |
| `target` | string | No | "ES2020" | TypeScript target |
| `module` | string | No | "ESNext" | Module system |
| `preserveComments` | boolean | No | true | Preserve original comments |
| `addTypeGuards` | boolean | No | true | Add type guard functions |
| `useInterfaces` | boolean | No | true | Prefer interfaces over type aliases |
| `useEnums` | boolean | No | true | Use enums for fixed values |

#### Response Structure
```typescript
{
  success: boolean,
  data: {
    typescript: string,
    types: {
      interfaces: string[],
      types: string[],
      enums: string[],
      typeGuards: string[]
    },
    statistics: {
      linesConverted: number,
      typesInferred: number,
      typesExplicit: number,
      anyCount: number,
      unknownCount: number
    },
    issues: Array<{
      type: string,
      line: number,
      message: string,
      suggestion?: string
    }>,
    config: {
      compilerOptions: object
    }
  }
}
```

---

## 3. Multi-File Functions

### 3.1 `security_audit`
**Purpose**: Perform comprehensive security analysis with project-specific vulnerability checks.

#### Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `projectPath` | string | Yes | - | Absolute path to project root |
| `projectType` | enum | Yes | - | Project type for specific checks |
| `auditDepth` | enum | No | "standard" | Depth: "basic", "standard", "comprehensive" |
| `includeOwasp` | boolean | No | true | Include OWASP Top 10 checks |
| `includeDependencies` | boolean | No | false | Audit dependencies for vulnerabilities |
| `focusAreas` | string[] | No | [] | Focus areas: "authentication", "data-flow", "input-validation", "authorization" |
| `customChecks` | string[] | No | [] | Additional custom security checks |

#### Project Types
- `wordpress-plugin`, `wordpress-theme`
- `react-app`, `react-component`
- `node-api`, `browser-extension`
- `cli-tool`, `n8n-node`, `n8n-workflow`
- `html-component`, `generic`

#### Response Structure
```typescript
{
  success: boolean,
  data: {
    summary: {
      riskLevel: "critical" | "high" | "medium" | "low",
      totalVulnerabilities: number,
      criticalCount: number,
      highCount: number,
      mediumCount: number,
      lowCount: number
    },
    vulnerabilities: Array<{
      type: string,
      severity: "critical" | "high" | "medium" | "low",
      description: string,
      location: {
        file?: string,
        line?: number,
        column?: number,
        code?: string
      },
      recommendation: string,
      owaspCategory?: string,
      cwe?: string
    }>,
    dependencies?: {
      vulnerable: Array<{
        package: string,
        version: string,
        vulnerability: string,
        severity: string
      }>
    },
    recommendations: string[],
    passedChecks: string[]
  }
}
```

---

### 3.2 `compare_integration`
**Purpose**: Compare integration between multiple files to identify mismatches.

#### Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `files` | string[] | Yes | - | Array of absolute file paths to analyze |
| `analysisType` | enum | No | "integration" | Type: "integration", "compatibility", "dependencies" |
| `focus` | string[] | No | [] | Focus areas |

#### Focus Areas
- `method_compatibility` - Check method signatures match
- `namespace_dependencies` - Verify namespace/import consistency
- `data_flow` - Track data flow between files
- `missing_connections` - Find unconnected components

#### Response Structure
```typescript
{
  success: boolean,
  data: {
    summary: {
      filesAnalyzed: number,
      issuesFound: number,
      compatibilityScore: number
    },
    integrationIssues: Array<{
      type: string,
      severity: "critical" | "high" | "medium" | "low",
      files: Array<{
        path: string,
        line: number,
        code?: string
      }>,
      description: string,
      fix: {
        description: string,
        code?: string,
        automated: boolean
      }
    }>,
    dependencies: {
      graph: { [file: string]: string[] },
      circular: Array<string[]>,
      missing: Array<{
        file: string,
        import: string
      }>
    },
    suggestions: string[]
  }
}
```

---

### 3.3 `trace_execution_path`
**Purpose**: Trace execution path through multiple files from entry point.

#### Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `entryPoint` | string | Yes | - | Entry like "ClassName::method" or "functionName" |
| `traceDepth` | number | No | 5 | Maximum depth to trace (1-10) |
| `showParameters` | boolean | No | false | Include parameter information |

#### Response Structure
```typescript
{
  success: boolean,
  data: {
    trace: Array<{
      level: number,
      file: string,
      function: string,
      line: number,
      parameters?: string[],
      calls: Array<{
        function: string,
        file: string,
        line: number
      }>
    }>,
    summary: {
      totalCalls: number,
      uniqueFunctions: number,
      filesInvolved: string[],
      maxDepthReached: boolean
    },
    visualization: string
  }
}
```

---

### 3.4 `find_pattern_usage`
**Purpose**: Find usage of specific patterns across multiple files.

#### Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `projectPath` | string | Yes | - | Absolute path to project root |
| `patterns` | string[] | Yes | - | Patterns to search (regex supported) |
| `includeContext` | number | No | 3 | Context lines to include (0-10) |

#### Response Structure
```typescript
{
  success: boolean,
  data: {
    matches: Array<{
      pattern: string,
      file: string,
      line: number,
      column: number,
      match: string,
      context: {
        before: string[],
        after: string[]
      }
    }>,
    statistics: {
      totalMatches: number,
      matchesByPattern: { [pattern: string]: number },
      matchesByFile: { [file: string]: number },
      filesScanned: number
    }
  }
}
```

---

### 3.5 `diff_method_signatures`
**Purpose**: Compare method signatures between caller and callee.

#### Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `callingFile` | string | Yes | - | File containing the method call |
| `calledClass` | string | Yes | - | Class name containing the method |
| `methodName` | string | Yes | - | Name of the method to check |

#### Response Structure
```typescript
{
  success: boolean,
  data: {
    comparison: {
      caller: {
        file: string,
        line: number,
        signature: string,
        parameters: Array<{
          name: string,
          type?: string,
          default?: string
        }>
      },
      callee: {
        file: string,
        line: number,
        signature: string,
        parameters: Array<{
          name: string,
          type?: string,
          required: boolean,
          default?: string
        }>
      }
    },
    mismatches: Array<{
      type: "missing" | "extra" | "type-mismatch" | "order",
      parameter: string,
      description: string
    }>,
    compatible: boolean,
    suggestions: string[]
  }
}
```

---

### 3.6 `generate_project_documentation`
**Purpose**: Generate comprehensive project documentation based on codebase analysis.

#### Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `projectPath` | string | Yes | - | Absolute path to project root |
| `docStyle` | enum | No | "markdown" | Documentation style |
| `focusAreas` | string[] | No | ["api", "architecture", "setup"] | Areas to focus on |
| `includeExamples` | boolean | No | true | Include usage examples |
| `maxDepth` | number | No | 3 | Maximum directory depth |
| `context` | object | No | {} | Additional context |

#### Response Structure
```typescript
{
  success: boolean,
  data: {
    documentation: string,
    sections: {
      overview: string,
      installation: string,
      usage: string,
      api: string,
      architecture: string,
      contributing: string
    },
    metadata: {
      totalFiles: number,
      languages: string[],
      dependencies: string[],
      complexity: string
    }
  }
}
```

---

## 4. System Functions

### 4.1 `find_unused_files`
**Purpose**: Identify genuinely unused TypeScript files with dynamic loading detection.

#### Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `projectPath` | string | Yes | - | Absolute path to project root |
| `entryPoints` | string[] | No | ["index.ts", "main.ts", "app.ts"] | Entry point files |
| `excludePatterns` | string[] | No | ["*.test.ts", "*.spec.ts", "*.d.ts"] | File patterns to exclude |
| `includeDevArtifacts` | boolean | No | false | Flag potential dev artifacts |
| `analyzeComments` | boolean | No | true | Check for commented-out imports |

#### Response Structure
```typescript
{
  success: boolean,
  data: {
    summary: {
      totalFiles: number,
      usedFiles: number,
      unusedCandidates: number,
      confidence: "high" | "medium" | "low"
    },
    usedFiles: {
      static: string[],
      dynamic: string[],
      entry: string[],
      config: string[]
    },
    unusedCandidates: {
      definitelyUnused: string[],
      likelyUnused: string[],
      unclear: string[]
    },
    devArtifacts?: {
      temporary: string[],
      legacy: string[],
      duplicates: string[]
    },
    recommendations: {
      safeToDelete: string[],
      investigateFirst: string[],
      keepForCompatibility: string[]
    }
  }
}
```

---

### 4.2 `health_check`
**Purpose**: Check if LM Studio is running and responding.

#### Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `detailed` | boolean | No | false | Include detailed model information |

#### Response Structure
```typescript
{
  success: boolean,
  data: {
    status: "healthy" | "unhealthy",
    connection: "established" | "failed",
    lmStudioUrl: string,
    timestamp: string,
    error?: string,
    suggestion?: string,
    contextLength?: number,
    details?: {
      loadedModels: Array<{
        path: string,
        identifier: string,
        architecture: string
      }>,
      modelCount: number,
      hasActiveModel: boolean,
      serverInfo: {
        url: string,
        protocol: string
      },
      activeModel?: {
        path: string,
        identifier: string,
        architecture: string
      }
    }
  }
}
```

---

### 4.3 `clear_analysis_cache`
**Purpose**: Clear the multi-file analysis cache.

#### Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `filePath` | string | No | - | Specific file to clear from cache |

#### Response Structure
```typescript
{
  success: boolean,
  data: {
    message: string,
    filesCleared: number,
    memoryFreed: string
  }
}
```

---

### 4.4 `get_cache_statistics`
**Purpose**: Get statistics about the current analysis cache.

#### Parameters
None

#### Response Structure
```typescript
{
  success: boolean,
  data: {
    totalEntries: number,
    memoryUsage: string,
    files: string[],
    oldestEntry: string,
    newestEntry: string,
    hitRate: number,
    statistics: {
      byType: { [type: string]: number },
      bySize: { [range: string]: number }
    }
  }
}
```

---

## 5. Custom Functions

### 5.1 `custom_prompt`
**Purpose**: Execute any custom prompt with optional file context.

#### Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `prompt` | string | Yes | - | The custom prompt/task to send to local LLM |
| `files` | string[] | No | [] | Optional array of file paths to include as context |
| `working_directory` | string | No | - | Working directory context |
| `context` | object | No | {} | Optional structured context object |
| `max_tokens` | number | No | 4000 | Maximum tokens for LLM response |

#### Context Object Structure
```typescript
{
  task_type?: string,
  requirements?: string[],
  constraints?: string[],
  output_format?: string
}
```

#### Response Structure
```typescript
{
  success: boolean,
  data: {
    content: string,
    metadata: {
      functionName: "custom_prompt",
      parsedAt: string,
      responseLength: number,
      filesUsed?: string[],
      contextApplied?: object
    }
  }
}
```

---

## Modern Architecture Features

### Security Integration (v4.2)

All functions use the `withSecurity` wrapper pattern:

```typescript
async execute(params: any, llmClient: any) {
  return await withSecurity(this, params, llmClient, async (secureParams) => {
    // Secure parameter validation and processing
    // Automatic path validation for file operations  
    // Foreign prompt injection prevention
    // Output sanitization
  });
}
```

### Response Management (v4.2)

All functions use `ResponseFactory` for consistent outputs:

```typescript
// Automatic parsing and structuring
return ResponseFactory.parseAndCreateResponse(
  'function_name',
  llmResponse,
  model.identifier || 'unknown'
);

// Comprehensive error handling
return ResponseFactory.createErrorResponse(
  'function_name',
  'ERROR_CODE',
  'Error message',
  { context },
  'unknown'
);
```

### Context Window Management (v4.2)

Large operations use `ThreeStagePromptManager`:

```typescript
const promptManager = new ThreeStagePromptManager(contextLength);
const needsChunking = promptManager.needsChunking(stages);

if (needsChunking) {
  const conversation = promptManager.createChunkedConversation(stages);
  // Process in chunks with automatic context window management
}
```

### Modern LM Studio Integration (v4.2)

Latest SDK patterns with streaming and model detection:

```typescript
const models = await llmClient.llm.listLoaded();
const model = models[0];
const contextLength = await model.getContextLength();

const prediction = model.respond(messages, {
  temperature: 0.2,
  maxTokens: 4000
});

let response = '';
for await (const chunk of prediction) {
  if (chunk.content) response += chunk.content;
}
```

---

## Error Handling

All functions return consistent error responses:

```typescript
{
  success: false,
  timestamp: string,
  modelUsed: string,
  executionTimeMs: number,
  error: {
    code: string,
    message: string,
    details?: any
  }
}
```

Common error codes:
- `EXECUTION_ERROR` - General execution failure
- `PARAMETER_ERROR` - Invalid parameters
- `FILE_ERROR` - File access issues
- `MODEL_ERROR` - LM Studio connection issues
- `SECURITY_ERROR` - Security validation failure
- `PARSING_ERROR` - Response parsing failure

---

## Performance Characteristics

### Token Savings
- **Analysis Functions**: 500-1,000 tokens saved per operation
- **Generation Functions**: 200-5,000 tokens saved per operation  
- **Multi-File Functions**: 1,000-35,000+ tokens saved per operation
- **System Functions**: Minimal token usage

### Response Times
- **Simple Operations**: 1-5 seconds
- **File Analysis**: 2-10 seconds
- **Multi-File Operations**: 5-30 seconds (with chunking)
- **Large Project Analysis**: 30-120 seconds (with intelligent chunking)

### Context Management
- **Automatic Chunking**: Files >80% context limit
- **Smart File Processing**: Priority-based file selection
- **Cache Integration**: Persistent across session
- **Memory Optimization**: Efficient token usage

---

**Version**: 4.2.0  
**Architecture**: Modern Plugin System with Security Integration  
**Last Updated**: August 2025  
**Total Functions**: 17 implemented  
**Status**: Production Ready