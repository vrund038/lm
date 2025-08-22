# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.2.0] - 2024-08-22

### Added
- Comprehensive troubleshooting guide (TROUBLESHOOTING.md)
- Connection test script (test-connection.js) for easy LM Studio verification
- NPM vs Local installation comparison in README
- Environment variables documentation table
- Quick start section in README
- Debugging tools section in troubleshooting guide
- Complete example configurations with all required environment variables

### Changed
- Updated claude_config_example.json to include LM_STUDIO_URL and LLM_MCP_ALLOWED_DIRS
- Improved README structure with clearer installation methods
- Enhanced configuration examples with proper environment variables
- Updated package.json to include new documentation files
- Added test:connection script for easy testing

### Fixed
- Documentation now correctly shows WebSocket URL format (ws:// not http://)
- Configuration examples now include all required environment variables
- Clarified localhost vs network address configuration

### Documentation
- Added comprehensive troubleshooting for common issues
- Included step-by-step debugging procedures
- Added quick fixes checklist
- Improved error message explanations

## [2.1.0] - 2024-08-21

### Added
- Security features with path validation and configurable directory access
- Path traversal protection
- Configurable allowed directories via LLM_MCP_ALLOWED_DIRS
- Fixed thinking tag regex for better response parsing
- TypeScript strict mode improvements

### Security
- Implemented path validation to prevent unauthorized file access
- Added configurable directory whitelist
- Enhanced security configuration documentation

## [2.0.0] - 2024-08-21

### Added
- LM Studio SDK integration for native file attachment support
- `analyze_file` tool for general file analysis with custom instructions
- `analyze_csv_data` tool for filtering and analysing CSV files
- Comprehensive documentation (Complete Guide and Getting Started Guide)
- Support for streaming responses (implemented but not yet used)
- File validation for size (200MB limit) and type restrictions
- Detailed error handling with specific error codes

### Changed
- **BREAKING**: Migrated from axios to @lmstudio/sdk
- **BREAKING**: Changed internal API structure
- Improved file handling to use native SDK attachment methods
- Enhanced error messages for better debugging
- Updated TypeScript types for better type safety

### Fixed
- Model response parsing for various LLM outputs
- Handling of thinking tags in model responses
- File path resolution issues

### Security
- Added file size validation (200MB maximum)
- Implemented file type whitelist for security
- Local processing only (no external API calls)

## [1.0.0] - 2024-07-01

### Added
- Initial release with axios-based implementation
- Basic code analysis tools
- MCP server implementation
- Support for 10 different task types
- Basic documentation