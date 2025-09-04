# Houtini LM - Custom Prompting Guide
*Master the art of flexible AI prompting with unlimited local processing*

## Overview

The custom prompting function is your Swiss Army knife - a universal tool that handles any task when the specialized functions don't quite fit your needs. It's the bridge between Houtini's structured functions and your unique requirements.

**Key Benefits**:
- **Complete flexibility** - Any prompt, any task, any analysis
- **Context-aware** - Automatically includes file contents when needed
- **Token unlimited** - No API costs for experimentation
- **Multi-file support** - Analyse entire projects or specific files

## The `custom_prompt` Function

### Basic Syntax
```bash
local-llm:custom_prompt prompt="Your custom task description here"
```

### Full Parameter Set
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `prompt` | string | Yes | - | Your custom instruction or question |
| `filePath` | string | No | - | Single file to include as context |
| `projectPath` | string | No | - | Project directory for multi-file context |
| `files` | array | No | - | Specific files to include |
| `code` | string | No | - | Code snippet to analyse |
| `context` | object | No | {} | Additional structured context |
| `analysisDepth` | string | No | "detailed" | Analysis depth: basic, detailed, comprehensive |
| `maxDepth` | number | No | 3 | Directory traversal depth (1-5) |

## Prompt Engineering Best Practices

### 1. **Be Specific About Your Goal**
❌ Vague: "Look at this code"
✅ Specific: "Identify potential security vulnerabilities in this authentication system, focusing on input validation and session management"

### 2. **Specify Output Format**
❌ Generic: "Analyse this project"
✅ Structured: "Create a bulleted list of architectural improvements, ranked by impact and implementation difficulty"

### 3. **Include Context and Constraints**
❌ No context: "Optimize this function"
✅ With context: "Optimize this React component for a high-traffic e-commerce site, considering SEO and accessibility requirements"

### 4. **Request Confidence Scoring**
Add phrases like:
- "Rate your confidence in each recommendation from 1-10"
- "Indicate which suggestions are high-priority vs nice-to-have"
- "Mark any assumptions you're making about the codebase"

## Common Use Cases & Examples

### 1. **Custom Code Analysis**
```bash
local-llm:custom_prompt prompt="Analyse this TypeScript codebase for potential performance bottlenecks, especially around database queries and API calls. Provide specific line numbers and optimization suggestions." projectPath="C:/my-api-project"
```

### 2. **Architecture Assessment**
```bash
local-llm:custom_prompt prompt="Review this microservices architecture and identify potential single points of failure. Consider scalability, fault tolerance, and monitoring gaps." projectPath="C:/microservices-app" analysisDepth="comprehensive"
```

### 3. **Documentation Gap Analysis**
```bash
local-llm:custom_prompt prompt="Identify which functions and classes lack proper documentation. Create a prioritised list based on code complexity and public API usage." filePath="C:/project/src/main-service.ts"
```

### 4. **Framework Migration Planning**
```bash
local-llm:custom_prompt prompt="Create a migration plan for converting this jQuery application to React. Identify reusable components, potential challenges, and step-by-step conversion approach." projectPath="C:/legacy-webapp"
```

### 5. **Custom Security Audit**
```bash
local-llm:custom_prompt prompt="Perform a WordPress-specific security audit focusing on custom post types, meta queries, and user capability checks. Flag any potential privilege escalation vectors." projectPath="C:/wp-plugin"
```

### 6. **Performance Analysis**
```bash
local-llm:custom_prompt prompt="Analyse this React application for unnecessary re-renders and prop drilling. Suggest state management improvements and component optimization strategies." projectPath="C:/react-dashboard"
```

### 7. **Code Style Consistency**
```bash
local-llm:custom_prompt prompt="Review coding standards consistency across this team project. Identify style variations, naming convention deviations, and suggest linting rules." projectPath="C:/team-project" maxDepth=4
```

### 8. **API Design Review**
```bash
local-llm:custom_prompt prompt="Evaluate this REST API design for RESTful principles, error handling consistency, and developer experience. Suggest improvements for API versioning and documentation." filePath="C:/api/routes/users.js"
```

## Advanced Prompting Techniques

### 1. **Multi-Step Analysis**
Break complex tasks into steps within your prompt:

```bash
local-llm:custom_prompt prompt="
Step 1: Identify all database queries in this codebase
Step 2: Categorise them by complexity and frequency of execution  
Step 3: Suggest specific optimisations for the top 5 slowest queries
Step 4: Estimate performance impact of each optimisation
" projectPath="C:/database-heavy-app"
```

### 2. **Role-Based Prompting**
Frame your request from a specific perspective:

```bash
local-llm:custom_prompt prompt="As a senior DevOps engineer, review this application's deployment configuration. Focus on container security, resource limits, and CI/CD pipeline improvements. What would you change before deploying to production?" projectPath="C:/app-deployment"
```

### 3. **Comparative Analysis**
Ask for comparisons and trade-offs:

```bash
local-llm:custom_prompt prompt="Compare the current authentication implementation with OAuth 2.0 and JWT approaches. Create a pros/cons table focusing on security, scalability, and development complexity." filePath="C:/auth/current-auth.js"
```

### 4. **Scenario-Based Analysis**
Present specific scenarios:

```bash
local-llm:custom_prompt prompt="If this application needs to handle 10x current traffic within 6 months, what are the top 5 architectural changes needed? Consider database scaling, caching strategies, and infrastructure requirements." projectPath="C:/startup-app"
```

## Working with Different File Types

### **JavaScript/TypeScript Projects**
```bash
local-llm:custom_prompt prompt="Analyse this Node.js API for async/await best practices, error handling patterns, and potential memory leaks" projectPath="C:/node-api"
```

### **WordPress/PHP Projects**
```bash
local-llm:custom_prompt prompt="Review this WordPress plugin for compliance with coding standards, security best practices, and performance optimization opportunities" projectPath="C:/wp-plugin"
```

### **Configuration Files**
```bash
local-llm:custom_prompt prompt="Audit this Docker Compose configuration for production readiness, security hardening, and performance optimization" filePath="C:/project/docker-compose.yml"
```

### **Documentation Files**
```bash
local-llm:custom_prompt prompt="Review this API documentation for completeness, clarity, and developer experience. Identify missing examples, unclear explanations, and suggest improvements" filePath="C:/docs/api-guide.md"
```

## Context Enhancement Strategies

### 1. **Structured Context Objects**
Provide additional context for better analysis:

```bash
local-llm:custom_prompt prompt="Optimise this component for mobile performance" filePath="C:/components/DataTable.tsx" context='{
  "target_devices": "iOS/Android",
  "performance_budget": "< 3s load time",
  "constraints": ["limited bandwidth", "touch interface"],
  "framework": "React Native"
}'
```

### 2. **Project-Specific Requirements**
Include business context:

```bash
local-llm:custom_prompt prompt="Review this e-commerce checkout flow for conversion optimization" projectPath="C:/checkout-app" context='{
  "business_goals": ["reduce cart abandonment", "increase average order"],
  "target_audience": "mobile-first shoppers",
  "compliance": ["PCI DSS", "GDPR"]
}'
```

## Output Formatting Techniques

### 1. **Request Specific Formats**
```bash
local-llm:custom_prompt prompt="Create a markdown checklist of security improvements for this API, grouped by priority level (Critical, High, Medium, Low)" filePath="C:/api/auth.js"
```

### 2. **Ask for Templates**
```bash
local-llm:custom_prompt prompt="Generate a pull request template for this project based on the codebase structure and apparent coding standards" projectPath="C:/team-project"
```

### 3. **Request Actionable Outputs**
```bash
local-llm:custom_prompt prompt="Create a step-by-step refactoring plan with estimated time requirements and risk levels for modernising this legacy component" filePath="C:/legacy/OldWidget.js"
```

## Troubleshooting Common Issues

### **Vague or Unhelpful Responses**
- **Make prompts more specific** - Add context about your goals
- **Include examples** of what you're looking for
- **Specify the output format** you need

### **Analysis Too Surface-Level**
- **Increase `analysisDepth`** to "comprehensive"
- **Add specific technical constraints** to your prompt
- **Request line-by-line analysis** for critical files

### **Missing Important Files**
- **Use `files` parameter** to specify exactly which files to analyse
- **Increase `maxDepth`** for complex project structures
- **Combine multiple calls** for very large projects

### **Context Not Relevant**
- **Be specific about your role** and requirements
- **Include business constraints** and technical requirements
- **Mention the target audience** for your analysis

## Integration with Other Functions

### **Use Custom Prompt to Plan**
1. `custom_prompt` - "What security issues should I look for in this API?"
2. `security_audit` - Comprehensive automated audit
3. `custom_prompt` - "Create implementation plan for fixing the identified issues"

### **Use Custom Prompt to Refine**
1. `analyze_single_file` - Get structured analysis
2. `custom_prompt` - "Focus specifically on the performance concerns from the previous analysis"
3. `suggest_refactoring` - Get specific improvement suggestions

### **Use Custom Prompt for Follow-up**
1. `generate_unit_tests` - Create test suite
2. `custom_prompt` - "Review these generated tests for edge cases I might have missed"

## Performance Optimization

### **For Large Projects**
- Start with `maxDepth=2` to get overview, then drill down
- Use specific file paths rather than entire projects when possible
- Break complex analysis into multiple focused prompts

### **For Better Response Quality**
- Use `analysisDepth="comprehensive"` for critical analysis
- Include relevant technical constraints in your context
- Ask for confidence levels and assumptions in responses

### **For Faster Iteration**
- Save effective prompts as templates
- Build up context gradually rather than trying to include everything at once
- Use the structured `context` parameter for consistent formatting

## Best Practices Summary

### **Do**
✅ Be specific about your goals and constraints
✅ Include relevant business or technical context
✅ Request structured outputs with confidence levels
✅ Break complex analysis into focused questions
✅ Specify output formats (markdown, lists, tables)
✅ Include file paths when relevant to the analysis

### **Don't**
❌ Use vague prompts like "analyse this code"
❌ Try to analyse massive projects in single calls
❌ Forget to specify the technical stack or framework
❌ Assume the AI knows your business requirements
❌ Skip context about performance requirements or constraints

---

## Examples Repository

For more examples and templates, check out our [examples repository](https://github.com/houtini-ai/examples) with real-world custom prompting scenarios.

*The custom_prompt function is your gateway to unlimited analysis possibilities. Master it, and you'll be able to tackle any development challenge with AI assistance.*
