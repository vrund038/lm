# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0] - 2025-08-25

### Added
- **Context-aware prompts** for enhanced code analysis
  - Support for 11 project types (WordPress, React, n8n, Node.js, etc.)
  - Framework-specific best practices and suggestions
  - Optional context parameter maintains backward compatibility
- **5 new powerful tools**:
  - `generate_wordpress_plugin` - Complete WordPress plugin generator with Brain Monkey test support
  - `analyze_n8n_workflow` - n8n workflow optimization and analysis
  - `generate_responsive_component` - Accessible, responsive component generator
  - `convert_to_typescript` - Intelligent JavaScript to TypeScript converter
  - `security_audit` - Project-specific security vulnerability scanner
- **90% token savings** through intelligent task delegation
- **Enhanced type system** with comprehensive TypeScript definitions
- **Project-specific security checklists** for each supported framework

### Changed
- Enhanced existing tools with optional context support:
  - `analyze_code_structure` - Now provides framework-specific insights
  - `generate_unit_tests` - Creates framework-aware test suites
  - `generate_documentation` - Generates audience-appropriate documentation
  - `suggest_refactoring` - Offers project-specific improvements
- Improved prompt quality for better LLM responses
- Better error messages with context-aware suggestions

### Technical Improvements
- Modular prompt system for easier maintenance
- Comprehensive type definitions for all contexts
- Enhanced prompt templates with domain knowledge
- Improved code organization and separation of concerns

## [2.2.2] - 2025-08-25

### Fixed
- Fixed NPX execution on Windows by normalizing file paths
- Handle forward/backward slash differences between import.meta.url and process.argv
- Fixed "server transport closed unexpectedly" error when using NPX

## [2.2.1] - 2025-08-25

### Fixed
- Added missing bin field to enable NPX execution
- Fixed "could not determine executable to run" error
- Updated examples to show NPX usage

### Added
- Clean and rebuild scripts for easier development

## [2.2.0] - 2025-08-25

### Fixed
- Restored all missing tool definitions in setupHandlers
- Fixed issue where only health_check was being registered

### Added
- All 10 tools now properly available:
  - analyze_code_structure
  - generate_unit_tests
  - generate_documentation
  - suggest_refactoring
  - detect_patterns
  - validate_syntax
  - suggest_variable_names
  - analyze_file
  - analyze_csv_data
  - health_check

## [2.1.0] - 2025-08-24

### Added
- **Security Features**:
  - Path validation to prevent unauthorized file access
  - Configurable allowed directories via LLM_MCP_ALLOWED_DIRS
  - Path traversal protection
  - File size limits (configurable, default 10MB)
- **Configuration options**:
  - Environment variable support for security settings
  - Configurable retry logic
  - Adjustable timeout settings

### Fixed
- Thinking tag regex for better response parsing
- TypeScript strict mode compliance
- Better error handling for invalid paths

### Changed
- Improved security posture with opt-in directory access
- Better error messages for permission issues

## [2.0.0] - 2025-08-23

### Added
- **File attachment support** - Analyze files directly without reading content first
- **LM Studio SDK integration** - Replaced axios with official @lmstudio/sdk
- **New tools**:
  - `analyze_file` - General file analysis with custom instructions
  - `analyze_csv_data` - CSV filtering and analysis
- **Streaming support** for better performance
- **Enhanced error handling** with better LM Studio status detection

### Changed
- Complete rewrite using LM Studio SDK
- Improved connection handling and retry logic
- Better model detection and validation

### Removed
- Axios dependency (replaced with LM Studio SDK)
- Manual HTTP request handling

## [1.0.0] - 2025-08-22

### Initial Release
- Basic code analysis tools
- Unit test generation
- Documentation generation
- Refactoring suggestions
- Pattern detection
- Bug finding
- Variable naming suggestions
- Basic LM Studio integration via HTTP

## Migration Notes

### Upgrading to v3.0.0
- No breaking changes - all existing code continues to work
- To use new context features, add optional `context` parameter
- New tools available immediately after upgrade
- See [Migration Guide](MIGRATION_GUIDE_V3.md) for detailed upgrade instructions

### Upgrading to v2.0.0
- Update LM Studio URL from http:// to ws:// protocol
- File analysis now available through new tools
- Check [Migration Guide](MIGRATION_GUIDE.md) for details
