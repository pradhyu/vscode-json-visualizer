# Contributing to Medical Claims Timeline Viewer

Thank you for your interest in contributing to the Medical Claims Timeline Viewer! This document provides guidelines and information for contributors.

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Setup](#development-setup)
4. [Contributing Guidelines](#contributing-guidelines)
5. [Testing](#testing)
6. [Documentation](#documentation)
7. [Submitting Changes](#submitting-changes)
8. [Release Process](#release-process)

## Code of Conduct

This project adheres to a code of conduct that we expect all contributors to follow. Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md) to help us maintain a welcoming and inclusive community.

## Getting Started

### Ways to Contribute

- **Bug Reports**: Report bugs and issues you encounter
- **Feature Requests**: Suggest new features and improvements
- **Code Contributions**: Submit bug fixes and new features
- **Documentation**: Improve documentation and examples
- **Testing**: Add test cases and improve test coverage
- **Performance**: Optimize performance for large datasets
- **Accessibility**: Improve accessibility and usability

### Before You Start

1. **Check Existing Issues**: Look through existing issues to see if your bug/feature has already been reported
2. **Read Documentation**: Familiarize yourself with the project by reading the README and User Guide
3. **Try the Extension**: Install and use the extension to understand its functionality
4. **Review Code**: Browse the codebase to understand the architecture and coding style

## Development Setup

### Prerequisites

- **Node.js**: Version 16 or higher
- **npm**: Version 8 or higher
- **VSCode**: Latest stable version
- **Git**: For version control

### Installation

1. **Fork the Repository**
   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/medical-claims-timeline-viewer.git
   cd medical-claims-timeline-viewer
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Build the Extension**
   ```bash
   npm run compile
   ```

4. **Run Tests**
   ```bash
   npm test
   ```

### Development Workflow

1. **Open in VSCode**
   ```bash
   code .
   ```

2. **Start Development Mode**
   - Press `F5` to open a new Extension Development Host window
   - The extension will be loaded and ready for testing

3. **Make Changes**
   - Edit TypeScript files in the `src/` directory
   - Changes will be automatically compiled (if using watch mode)

4. **Test Changes**
   - Use `Ctrl+R` (Cmd+R on Mac) in the Extension Development Host to reload
   - Test your changes with sample JSON files

### Project Structure

```
src/
├── extension.ts           # Main extension entry point
├── claimsParser.ts        # JSON parsing and data transformation
├── timelineRenderer.ts    # Webview management and timeline rendering
├── configManager.ts       # Settings and configuration management
├── errorHandling.ts       # Error handling utilities
├── types.ts              # TypeScript type definitions
└── test/                 # Test files
    ├── integration.test.ts
    ├── performance.test.ts
    └── *.test.ts

samples/                  # Sample JSON files
├── rxTba-sample.json
├── rxHistory-sample.json
├── medHistory-sample.json
└── comprehensive-claims-sample.json

docs/                     # Documentation
├── USER_GUIDE.md
└── API.md
```

## Contributing Guidelines

### Coding Standards

#### TypeScript Style

- Use TypeScript for all new code
- Follow existing code style and conventions
- Use meaningful variable and function names
- Add type annotations for public APIs
- Prefer `const` over `let` when possible

```typescript
// Good
const claimItems: ClaimItem[] = parser.extractClaims(jsonData, config);

// Avoid
let items = parser.extractClaims(jsonData, config);
```

#### Code Organization

- Keep functions small and focused (< 50 lines when possible)
- Use descriptive names for functions and variables
- Group related functionality into classes
- Separate concerns (parsing, rendering, configuration)

```typescript
// Good - Single responsibility
class ClaimsParser {
    parseFile(filePath: string): Promise<TimelineData> {
        // Implementation
    }
    
    validateStructure(json: any): boolean {
        // Implementation
    }
}

// Avoid - Mixed responsibilities
class ClaimsHandler {
    parseFileAndRender(filePath: string): void {
        // Too many responsibilities
    }
}
```

#### Error Handling

- Use custom error types for different error categories
- Provide helpful error messages with recovery suggestions
- Handle edge cases gracefully
- Log errors appropriately

```typescript
// Good
if (!this.validateStructure(jsonData)) {
    throw new StructureValidationError(
        'Invalid JSON structure',
        ['rxTba', 'rxHistory', 'medHistory'],
        ['Add required arrays', 'Check sample files']
    );
}

// Avoid
if (!this.validateStructure(jsonData)) {
    throw new Error('Invalid JSON');
}
```

### Documentation Standards

#### Code Comments

- Add JSDoc comments for public APIs
- Explain complex algorithms and business logic
- Document parameter types and return values
- Include usage examples for complex functions

```typescript
/**
 * Extracts claims from JSON data and transforms them into timeline format
 * @param jsonData Raw JSON data from file
 * @param config Parser configuration with paths and formats
 * @returns Array of transformed claim items
 * @throws {ValidationError} When JSON structure is invalid
 * @throws {DateParseError} When date parsing fails
 * 
 * @example
 * ```typescript
 * const claims = parser.extractClaims(jsonData, config);
 * console.log(`Found ${claims.length} claims`);
 * ```
 */
extractClaims(jsonData: any, config: ParserConfig): ClaimItem[] {
    // Implementation
}
```

#### README and Documentation

- Keep documentation up to date with code changes
- Include practical examples and use cases
- Provide troubleshooting information
- Use clear, concise language

### Testing Requirements

#### Test Coverage

- Aim for 80%+ test coverage
- Write tests for all new features
- Include edge cases and error conditions
- Test both happy path and failure scenarios

#### Test Types

1. **Unit Tests**: Test individual functions and classes
2. **Integration Tests**: Test complete workflows
3. **Performance Tests**: Test with large datasets
4. **Error Handling Tests**: Test error conditions and recovery

```typescript
// Good test structure
describe('ClaimsParser', () => {
    describe('extractClaims', () => {
        it('should extract rxTba claims correctly', () => {
            // Test implementation
        });
        
        it('should handle missing fields gracefully', () => {
            // Test error handling
        });
        
        it('should process large datasets efficiently', () => {
            // Performance test
        });
    });
});
```

### Performance Guidelines

#### Large Dataset Handling

- Optimize for files with 1000+ claims
- Use efficient algorithms (O(n log n) or better)
- Implement progressive loading for very large files
- Monitor memory usage and implement cleanup

#### Timeline Rendering

- Use efficient D3.js patterns
- Implement virtual scrolling for large datasets
- Optimize DOM updates and redraws
- Cache computed values when appropriate

### Accessibility Guidelines

- Ensure keyboard navigation works properly
- Provide appropriate ARIA labels
- Use sufficient color contrast
- Support screen readers
- Test with accessibility tools

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- src/claimsParser.test.ts

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run performance tests
npm test -- src/performance.test.ts
```

### Writing Tests

#### Test Structure

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ComponentName', () => {
    let component: ComponentName;
    
    beforeEach(() => {
        component = new ComponentName();
        vi.clearAllMocks();
    });
    
    describe('methodName', () => {
        it('should handle normal case correctly', () => {
            // Arrange
            const input = createTestInput();
            
            // Act
            const result = component.methodName(input);
            
            // Assert
            expect(result).toEqual(expectedOutput);
        });
        
        it('should handle edge case gracefully', () => {
            // Test edge cases
        });
        
        it('should throw appropriate error for invalid input', () => {
            // Test error conditions
        });
    });
});
```

#### Mock Guidelines

- Mock external dependencies (VSCode API, file system)
- Use realistic mock data
- Reset mocks between tests
- Verify mock interactions when relevant

```typescript
// Good mocking
vi.mock('vscode', () => ({
    window: {
        showErrorMessage: vi.fn(),
        createWebviewPanel: vi.fn(() => mockPanel)
    }
}));

// Verify mock usage
expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
    expect.stringContaining('Expected error message')
);
```

### Test Data

- Use realistic but anonymized test data
- Create reusable test fixtures
- Include edge cases in test data
- Document test data structure

## Documentation

### Types of Documentation

1. **Code Documentation**: JSDoc comments and inline documentation
2. **User Documentation**: README, User Guide, troubleshooting
3. **Developer Documentation**: API docs, architecture overview
4. **Examples**: Sample code and usage examples

### Documentation Standards

- Write for your audience (users vs developers)
- Include practical examples
- Keep documentation current with code changes
- Use clear, concise language
- Provide troubleshooting information

### Updating Documentation

When making changes that affect users:

1. Update relevant documentation files
2. Add examples if introducing new features
3. Update troubleshooting guides for new error conditions
4. Review documentation for accuracy and clarity

## Submitting Changes

### Pull Request Process

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-number-description
   ```

2. **Make Changes**
   - Follow coding standards
   - Add tests for new functionality
   - Update documentation as needed
   - Ensure all tests pass

3. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: add new timeline filtering feature"
   ```

4. **Push to Fork**
   ```bash
   git push origin feature/your-feature-name
   ```

5. **Create Pull Request**
   - Use descriptive title and description
   - Reference related issues
   - Include screenshots for UI changes
   - Request review from maintainers

### Commit Message Format

Use conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `perf`: Performance improvements

**Examples:**
```
feat(parser): add support for custom date formats
fix(timeline): resolve rendering issue with overlapping claims
docs(readme): update installation instructions
test(integration): add end-to-end workflow tests
```

### Pull Request Guidelines

#### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Refactoring

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] Performance impact assessed

## Documentation
- [ ] Code comments updated
- [ ] User documentation updated
- [ ] API documentation updated

## Screenshots (if applicable)
Include screenshots for UI changes

## Related Issues
Closes #123
```

#### Review Criteria

Pull requests will be reviewed for:

- **Functionality**: Does it work as intended?
- **Code Quality**: Is it well-written and maintainable?
- **Testing**: Are there adequate tests?
- **Documentation**: Is documentation updated?
- **Performance**: Does it impact performance?
- **Security**: Are there security implications?

### Getting Your PR Merged

1. **Address Review Feedback**: Respond to reviewer comments promptly
2. **Keep PR Updated**: Rebase or merge with main branch as needed
3. **Maintain Quality**: Ensure tests pass and code quality is maintained
4. **Be Patient**: Reviews take time, especially for large changes

## Release Process

### Version Numbering

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Checklist

1. **Update Version**: Update version in package.json
2. **Update Changelog**: Add release notes to CHANGELOG.md
3. **Run Tests**: Ensure all tests pass
4. **Build Extension**: Create production build
5. **Test Package**: Test the packaged extension
6. **Create Release**: Tag and create GitHub release
7. **Publish**: Publish to VSCode Marketplace

### Release Notes

Each release should include:

- Summary of changes
- New features and improvements
- Bug fixes
- Breaking changes (if any)
- Migration guide (if needed)
- Known issues

## Getting Help

### Communication Channels

- **GitHub Issues**: For bug reports and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Pull Request Comments**: For code review discussions

### Resources

- **VSCode Extension API**: [Official Documentation](https://code.visualstudio.com/api)
- **TypeScript**: [Official Documentation](https://www.typescriptlang.org/docs/)
- **D3.js**: [Official Documentation](https://d3js.org/)
- **Vitest**: [Testing Framework Documentation](https://vitest.dev/)

### Maintainer Contact

For questions about contributing:

1. Check existing issues and discussions first
2. Create a new issue for bugs or feature requests
3. Start a discussion for questions or ideas
4. Mention maintainers in issues if urgent

---

Thank you for contributing to Medical Claims Timeline Viewer! Your contributions help make this tool better for everyone working with medical claims data.