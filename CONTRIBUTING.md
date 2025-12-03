# Contributing to Universal MCP Hub

First off, thank you for considering contributing to Universal MCP Hub! It's people like you that make this project better for everyone.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Workflow](#development-workflow)
- [Style Guidelines](#style-guidelines)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)

---

## Code of Conduct

This project and everyone participating in it is governed by our commitment to creating a welcoming, inclusive environment. By participating, you are expected to uphold this commitment.

### Our Standards

- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

---

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- Git
- A GitHub account

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:

```bash
git clone https://github.com/YOUR_USERNAME/mcp.git
cd mcp
```

3. Add the upstream repository:

```bash
git remote add upstream https://github.com/UniversalStandards/mcp.git
```

### Setup Development Environment

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
# You'll need at least GITHUB_TOKEN and AI_API_KEY

# Build the project
npm run build

# Run tests
npm test

# Start development server with hot reload
npm run dev
```

---

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When creating a bug report, include:

- **Clear descriptive title**
- **Exact steps to reproduce**
- **Expected behavior**
- **Actual behavior**
- **Screenshots** (if applicable)
- **Environment details** (OS, Node version, etc.)

Use the bug report template when available.

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- **Use a clear descriptive title**
- **Provide detailed description** of the suggested enhancement
- **Explain why this enhancement would be useful**
- **List examples** of how it would be used

### Your First Code Contribution

Unsure where to begin? Look for issues labeled:

- `good first issue` - Good for newcomers
- `help wanted` - Extra attention needed
- `beginner friendly` - Simple tasks to get started

### Pull Requests

- Fill in the pull request template
- Follow the style guidelines
- Include tests for new functionality
- Update documentation as needed
- Ensure all tests pass

---

## Development Workflow

### Branching Strategy

- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/*` - New features
- `bugfix/*` - Bug fixes
- `hotfix/*` - Emergency fixes for production

### Creating a Feature Branch

```bash
# Update your fork
git fetch upstream
git checkout main
git merge upstream/main

# Create feature branch
git checkout -b feature/my-new-feature
```

### Making Changes

1. Make your changes
2. Write or update tests
3. Ensure tests pass: `npm test`
4. Lint your code: `npm run lint`
5. Build: `npm run build`

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test -- tests/unit/cache-manager.test.ts

# Run with coverage
npm test -- --coverage
```

### Linting

```bash
# Lint all files
npm run lint

# Lint and auto-fix
npm run lint -- --fix
```

---

## Style Guidelines

### TypeScript Style

- Use TypeScript for all new code
- Enable strict mode
- Provide types for all parameters and return values
- Use interfaces for object shapes
- Prefer `const` over `let`, avoid `var`
- Use meaningful variable names

```typescript
// Good
interface UserCredential {
  userId: string;
  service: string;
  token: string;
}

function storeCredential(credential: UserCredential): void {
  // Implementation
}

// Avoid
function store(c: any) {
  // Implementation
}
```

### Code Organization

- One component per file
- Group related functionality
- Keep functions small and focused
- Use meaningful names
- Add comments for complex logic only

### File Naming

- Use kebab-case for files: `cache-manager.ts`
- Use PascalCase for classes: `CacheManager`
- Use camelCase for functions: `getCached`
- Test files: `*.test.ts` or `*.spec.ts`

### Documentation

- Add JSDoc comments for public APIs
- Update README.md for user-facing changes
- Update API.md for endpoint changes
- Add inline comments for complex logic

```typescript
/**
 * Retrieves a cached value by key
 * @param key - The cache key to lookup
 * @returns The cached value or null if not found or expired
 */
export function getCached(key: string): any {
  // Implementation
}
```

---

## Commit Guidelines

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `ci`: CI/CD changes

### Examples

```
feat(cache): add TTL support for cache entries

Implement time-to-live functionality for cached items.
Expired entries are automatically cleaned up.

Closes #123
```

```
fix(auth): resolve encryption key derivation issue

Use proper SHA-256 hash for key derivation instead
of direct string conversion.

Fixes #456
```

### Rules

- Use present tense: "add feature" not "added feature"
- Use imperative mood: "move cursor" not "moves cursor"
- Capitalize first letter
- No period at the end of subject
- Limit subject to 72 characters
- Separate subject from body with blank line
- Wrap body at 72 characters
- Reference issues and PRs in footer

---

## Pull Request Process

### Before Submitting

1. **Update your branch**
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Ensure quality**
   - All tests pass
   - Code is linted
   - Build succeeds
   - Documentation updated

3. **Review your changes**
   ```bash
   git diff upstream/main
   ```

### Submitting

1. Push your branch:
   ```bash
   git push origin feature/my-new-feature
   ```

2. Open a pull request on GitHub

3. Fill in the PR template completely

4. Link related issues

### PR Review Process

- Maintainers will review your PR
- Address any requested changes
- Keep discussion focused and professional
- Once approved, maintainers will merge

### After Merge

1. Delete your feature branch:
   ```bash
   git branch -d feature/my-new-feature
   git push origin --delete feature/my-new-feature
   ```

2. Update your main branch:
   ```bash
   git checkout main
   git pull upstream main
   ```

---

## Testing Guidelines

### Writing Tests

- Write tests for all new functionality
- Include happy path and error cases
- Test edge cases
- Keep tests focused and isolated
- Use descriptive test names

```typescript
describe('Cache Manager', () => {
  describe('getCached', () => {
    test('should return cached value for valid key', () => {
      // Test implementation
    });

    test('should return null for expired entry', () => {
      // Test implementation
    });

    test('should return null for non-existent key', () => {
      // Test implementation
    });
  });
});
```

### Test Structure

- Use `describe` for grouping related tests
- Use `test` or `it` for individual tests
- Setup: `beforeEach`, `beforeAll`
- Teardown: `afterEach`, `afterAll`

---

## Security

### Reporting Security Issues

**DO NOT** open public issues for security vulnerabilities.

Instead, email: security@universalstandards.dev

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Security Best Practices

- Never commit secrets or credentials
- Use environment variables for sensitive data
- Validate all user inputs
- Keep dependencies updated
- Follow principle of least privilege

---

## Documentation

### What to Document

- Public APIs and functions
- Configuration options
- Environment variables
- Deployment procedures
- Troubleshooting guides

### Where to Document

- `README.md` - Getting started, overview
- `docs/API.md` - API reference
- `docs/DEPLOYMENT.md` - Deployment guide
- Inline comments - Complex logic
- JSDoc comments - Public APIs

---

## Community

### Getting Help

- **GitHub Discussions**: For questions and discussions
- **GitHub Issues**: For bugs and feature requests
- **Email**: support@universalstandards.dev

### Stay Updated

- Watch the repository for notifications
- Check GitHub Discussions regularly
- Follow project updates

---

## Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes
- Project website (when available)

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Universal MCP Hub! 🎉
