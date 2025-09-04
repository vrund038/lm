# Complete User Guide

**Your comprehensive guide to mastering Houtini LM**

This guide covers everything you need to know to get the most out of Houtini LM, from basic setup to advanced workflows that will transform how you develop software.

## Quick Start - Your First 5 Minutes

### What Houtini LM Actually Does

Houtini LM **saves your Claude context window** by handling routine analysis tasks locally. Think of it as your **intelligent coding assistant** that never runs out of tokens:

- **Houtini LM**: Handles analysis, scaffolding, documentation, repetitive tasks
- **Claude**: Focuses on architecture, strategy, complex problem-solving  
- **Perfect together**: Unlimited analysis + strategic thinking

### Prerequisites Checklist

Before you begin, ensure you have:

- ✅ **LM Studio installed** and running at `ws://127.0.0.1:1234`
- ✅ **Model loaded** (13B+ recommended for professional results)
- ✅ **Claude Desktop configured** with Houtini LM MCP server
- ✅ **Desktop Commander MCP** installed (essential for file operations)
- ✅ **Node.js 24.6.0+** installed

### Your First Commands

Test everything works with these simple prompts:

```
Check if houtini-lm is working with a health check
```

```
Use houtini-lm to analyse this file: C:/your-project/src/main.js
```

```
Generate a project overview using houtini-lm for C:/your-project
```

## Understanding the Function Categories

### 🔍 Analysis Functions (17 functions)

**Purpose**: Understand your codebase, identify issues, make informed decisions

**When to use**: 
- New project assessment
- Code quality reviews  
- Security audits
- Technical debt identification
- Architecture analysis

**Most useful functions**:
- `analyze_single_file` - Deep code analysis
- `count_files` - Project structure overview
- `security_audit` - Vulnerability detection
- `find_unused_files` - Dead code identification

### 🛠️ Generation Functions (10 functions)

**Purpose**: Create production-ready code, tests, documentation, complete applications

**When to use**:
- Test suite creation
- Documentation generation  
- Code modernization
- Component development
- WordPress development

**Most useful functions**:
- `generate_unit_tests` - Comprehensive test creation
- `generate_documentation` - Professional docs
- `convert_to_typescript` - JavaScript modernization
- `generate_wordpress_plugin` - Complete plugin creation

### 🎮 Creative Functions (3 functions)

**Purpose**: Build games, art, and interactive experiences whilst learning

**When to use**:
- Learning advanced CSS techniques
- Creating portfolio pieces
- Building interactive demos
- Exploring game development concepts

**Functions available**:
- `css_art_generator` - Pure CSS art creation
- `arcade_game` - Playable HTML5 games  
- `create_text_adventure` - Interactive fiction

### ⚙️ System Functions (5 functions)

**Purpose**: Maintain, troubleshoot, and optimize your Houtini LM installation

**When to use**:
- System health monitoring
- Function discovery
- Troubleshooting issues
- Performance optimization

**Essential functions**:
- `health_check` - System verification
- `list_functions` - Function discovery
- `resolve_path` - Path analysis

## Core Workflow Philosophies

### The Perfect Partnership Model

**Context Window Conservation**:
Instead of burning 10,000+ tokens on project analysis, use 500 tokens for strategic decisions:

1. `houtini-lm:count_files` → Get project overview (local processing)
2. `houtini-lm:security_audit` → Identify vulnerabilities (local processing)
3. **Claude**: Strategic planning based on findings (context preserved)
4. `houtini-lm:generate_unit_tests` → Create test suites (local processing)
5. **Desktop Commander**: Write files to disk

### Smart Function Selection

**Analysis-First Approach**:
Always understand before you generate:
```
1. Use houtini-lm to analyze my project structure
2. Use houtini-lm to audit security vulnerabilities  
3. Now suggest an architecture improvement strategy
4. Use houtini-lm to generate the refactored components
```

**Generation-Heavy Workflows**:
For rapid development and scaffolding:
```
1. Use houtini-lm to generate a WordPress plugin foundation
2. Use houtini-lm to create comprehensive unit tests
3. Use houtini-lm to generate user documentation
4. Review the architecture and suggest improvements
```

## Practical Usage Patterns

### Daily Development Integration

**Morning Startup Routine**:
```
1. Check houtini-lm health status
2. Use houtini-lm to analyze yesterday's code changes
3. Plan today's development priorities
```

**Before Coding**:
```
1. Use houtini-lm to analyze the file I'm about to modify
2. Understanding context and potential issues
3. Code with full awareness of implications
```

**Before Commits**:
```
1. Use houtini-lm security audit on changed files
2. Use houtini-lm to suggest refactoring improvements  
3. Commit with confidence in code quality
```

### Weekly Practices

**Monday: Project Health**:
```
1. Use houtini-lm to generate project structure overview
2. Identify areas needing attention this week
```

**Wednesday: Code Quality**:
```
1. Use houtini-lm to find unused files for cleanup
2. Run security audits on recent changes
```

**Friday: Documentation**:
```
1. Use houtini-lm to generate documentation for new features
2. Create user guides for completed work
```

### Project Milestone Workflows

**Project Start**:
```
1. Use houtini-lm comprehensive project structure analysis
2. Use houtini-lm security audit to establish baseline
3. Strategic planning session with Claude
4. Use houtini-lm to generate initial scaffolding
```

**Mid-Development**:
```
1. Use houtini-lm to analyze code quality trends
2. Use houtini-lm to identify technical debt accumulation
3. Refactoring strategy planning with Claude
4. Use houtini-lm to generate improved implementations
```

**Pre-Release**:
```
1. Use houtini-lm comprehensive security audit
2. Use houtini-lm to generate complete test coverage
3. Use houtini-lm to create deployment documentation
4. Final quality assurance with Claude
```

## Advanced Usage Techniques

### Multi-Function Workflows

**Legacy Code Modernization**:
```
1. houtini-lm:analyze_single_file → Understand current state
2. houtini-lm:suggest_refactoring → Identify improvements
3. houtini-lm:convert_to_typescript → Add type safety
4. houtini-lm:generate_unit_tests → Ensure reliability
5. Claude: Strategic migration planning
```

**WordPress Development Pipeline**:
```
1. houtini-lm:generate_wordpress_plugin → Create foundation
2. houtini-lm:audit_wordpress_plugin → Security review
3. houtini-lm:generate_unit_tests → Add testing
4. houtini-lm:generate_documentation → User guides
5. Claude: Business logic and UX review
```

**Frontend Component Development**:
```
1. houtini-lm:generate_responsive_component → Create base
2. houtini-lm:css_art_generator → Add visual elements
3. houtini-lm:generate_unit_tests → Ensure functionality
4. Claude: User experience optimization
```

### Parameter Optimization

**Getting Professional Results**:

**Use appropriate depth**:
- `"basic"` - Quick overview, large projects
- `"detailed"` - Standard professional analysis
- `"comprehensive"` - Mission-critical, showcase work

**Include context information**:
```json
{
  "context": {
    "framework": "React",
    "typescript": true,
    "focus": "security",
    "audience": "external_developers"
  }
}
```

**Specify constraints**:
```json
{
  "context": {
    "accessibility": "WCAG_2.1_AA",
    "browser_support": "modern",
    "performance": "mobile_first"
  }
}
```

## Troubleshooting Common Issues

### Connection Problems

**Symptom**: "Cannot connect to LM Studio"
**Diagnosis**:
```
Run detailed houtini-lm health check to identify the issue
```
**Solutions**:
1. Verify LM Studio is running at correct port
2. Check model is loaded and ready
3. Restart LM Studio if necessary
4. Verify firewall settings

### Performance Issues

**Symptom**: Functions running slowly
**Diagnosis**:
```
Check houtini-lm cache statistics for performance data
```
**Solutions**:
1. Clear analysis cache if memory usage high
2. Verify model is fully loaded (not still loading)
3. Use "basic" depth for large projects initially
4. Ensure adequate system memory (32GB recommended)

### Poor Output Quality

**Symptom**: Generic or low-quality analysis/generation
**Solutions**:
1. Increase `analysisDepth` to "comprehensive"
2. Add specific `context` information
3. Use larger model (13B+ parameters)
4. Include framework and technology details
5. Specify your exact requirements

### File Access Problems

**Symptom**: "Cannot access file" or permission errors
**Diagnosis**:
```
Use houtini-lm to analyze this path and suggest correct usage: C:/your/path
```
**Solutions**:
1. Use absolute paths only
2. Verify paths are within `LLM_MCP_ALLOWED_DIRS`
3. Check file and directory permissions
4. Ensure Desktop Commander MCP is installed

## Performance Optimization

### System Requirements for Best Results

**Recommended Hardware**:
- **CPU**: 8-core or better for local LLM processing
- **RAM**: 32GB (24GB for model, 8GB for development)
- **Storage**: SSD with 100GB+ free space
- **Model**: 13B+ parameters (Qwen2.5-Coder-14B-Instruct recommended)

**Configuration Optimization**:
- Keep LM Studio model loaded and ready
- Configure `LLM_MCP_ALLOWED_DIRS` appropriately
- Use SSD storage for model files
- Monitor memory usage during heavy analysis

### Token Efficiency Strategies

**Smart Function Selection**:
- Use analysis functions to understand problems
- Use generation functions to create solutions
- Reserve Claude for strategic thinking
- Combine multiple houtini-lm operations before consulting Claude

**Batch Operations**:
```
1. Use houtini-lm for multiple file analysis in sequence
2. Use houtini-lm for multiple generation tasks
3. Single Claude consultation for strategic overview
4. More houtini-lm operations based on strategy
```

## Integration with Development Tools

### Essential MCP Companions

**Desktop Commander** (Essential):
- File operations: Read, write, create files and directories
- Process management: Run builds, tests, and commands
- System integration: Complete development workflows

**Browser MCP** (Recommended):
- Live testing: Test generated components in browser
- Web scraping: Analyze live websites for inspiration
- Screenshot capture: Document your work

**GitHub MCP** (Team Development):
- Repository management: Push code, create issues
- Collaboration: Team workflows and code reviews
- Release management: Automated deployments

### IDE Integration Strategies

**VS Code Workflow**:
1. Use houtini-lm for analysis and generation
2. Desktop Commander writes files to workspace
3. VS Code provides editing and debugging
4. Git integration for version control

**Cursor IDE Workflow**:
1. Cursor for real-time coding assistance
2. Houtini-lm for comprehensive project analysis
3. Claude for architectural decisions
4. Perfect hybrid approach

## Security and Privacy

### Data Protection

**Local Processing Benefits**:
- All analysis happens on your machine
- No code sent to external APIs
- Full control over your intellectual property
- Offline capability for sensitive projects

**Best Practices**:
1. Keep LM Studio and models updated
2. Configure allowed directories restrictively
3. Review generated code before deployment
4. Use security audit functions regularly

### Compliance Considerations

**For Enterprise Use**:
- All processing remains on internal network
- No external API dependencies for analysis
- Full audit trail of operations
- Compliance with data governance policies

## Extending and Customizing

### Custom Workflows

**Creating Your Own Patterns**:
1. Identify repetitive analysis/generation sequences
2. Document the step-by-step process
3. Create templates for common scenarios
4. Share successful patterns with your team

**Example Custom Workflow Template**:
```
New Feature Development:
1. houtini-lm:analyze_single_file → Understand integration points
2. houtini-lm:generate_unit_tests → Create test foundation
3. Claude: Feature architecture planning
4. houtini-lm:generate_responsive_component → Build UI
5. houtini-lm:generate_documentation → Document usage
```

### Advanced Configuration

**Model Selection**:
- **13B+ models**: Professional development work
- **7B models**: Quick analysis, learning, experimentation
- **Specialized models**: Domain-specific analysis (code, security, etc.)

**Performance Tuning**:
- Adjust context window size based on model
- Configure temperature for consistent results
- Monitor token usage and optimize prompts

## Getting Maximum Value

### Strategic Usage

**Daily Habits That Transform Productivity**:
1. **Morning**: Health check and project status
2. **Before coding**: Analyze files you'll modify
3. **During development**: Generate tests and documentation
4. **Before commits**: Security and quality checks
5. **Weekly**: Comprehensive project health assessment

**Long-term Benefits**:
- Consistent code quality across projects
- Reduced technical debt accumulation
- Enhanced security posture
- Comprehensive documentation culture
- Faster development cycles

### Measuring Success

**Key Performance Indicators**:
- Reduced time spent on repetitive analysis tasks
- Improved code quality scores
- Faster development cycles
- Better documentation coverage
- Enhanced security compliance

**Tracking Your Improvement**:
- Document analysis insights before and after
- Measure time saved on documentation generation
- Track security issue detection rates
- Monitor code quality trend improvements

---

*With this comprehensive guide, you're ready to transform your development workflow. Start with simple prompts, build confidence with regular usage, and gradually incorporate advanced techniques. Houtini LM becomes more valuable the more you integrate it into your daily development practice.*

**Remember**: Use Houtini LM for detailed analysis and generation, save Claude for strategic thinking and complex problem-solving. Together, they're an unstoppable development team.*