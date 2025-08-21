# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

---

## Upcoming Features

### [2.1.0] - Planned
- Unit test coverage
- Streaming response support activation
- Caching mechanism for repeated queries
- Rate limiting implementation

### [3.0.0] - Future
- Multi-model support
- Custom prompt templates
- Web UI for configuration
- Plugin system for extensibility
