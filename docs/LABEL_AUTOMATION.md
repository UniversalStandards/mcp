# Label-Based Task Automation

## Overview

This repository implements a sophisticated label-based task automation system that allows you to trigger AI-powered actions on issues and pull requests by simply applying specific labels. When you add a label with the `copilot:` prefix, GitHub Actions will automatically execute the corresponding task using GitHub Copilot or OpenAI Codex.

## Available Labels and Tasks

### 🔧 `copilot:fix-issue`
**Purpose**: Automatically analyze and fix reported issues

**When to use**:
- Bug reports that need investigation and fixing
- Issues with clear problem descriptions
- Technical debt items that can be automated

**What it does**:
1. Analyzes the issue description
2. Identifies the root cause
3. Implements a minimal fix
4. Adds tests if needed
5. Creates a PR with the proposed solution

**Example**:
```
Issue: "Application crashes when processing empty arrays"
→ Add label: copilot:fix-issue
→ AI analyzes the code, finds the bug, and creates a PR with the fix
```

---

### 👀 `copilot:review-pr`
**Purpose**: Perform comprehensive automated code review

**When to use**:
- PRs that need thorough review
- Complex changes requiring multiple perspectives
- When you want AI-powered code quality analysis

**What it does**:
1. Analyzes all changed files
2. Reviews code quality, style, and best practices
3. Identifies potential bugs and security issues
4. Checks performance considerations
5. Validates test coverage
6. Posts detailed review comments

**Review aspects**:
- Code quality and consistency
- Logic correctness and edge cases
- Performance and scalability
- Security vulnerabilities
- Test coverage
- Documentation completeness

---

### 🐛 `copilot:fix-code`
**Purpose**: Fix specific code issues and bugs

**When to use**:
- PRs with known issues that need fixing
- Code with failing tests
- Quality issues identified by linters or reviewers

**What it does**:
1. Identifies code issues in the context
2. Fixes bugs and errors
3. Improves error handling
4. Addresses edge cases
5. Enhances code quality
6. Updates or creates a PR with fixes

---

### 🔀 `copilot:merge-to-main`
**Purpose**: Automatically merge PR to main after validation

**When to use**:
- PRs that have passed all checks
- Changes that are approved and ready
- Automated releases or deployments

**What it does**:
1. Validates all status checks pass
2. Confirms required approvals are present
3. Checks for merge conflicts
4. Performs the merge (squash merge by default)
5. Posts confirmation comment

**Safety checks**:
- ✅ All CI/CD checks must pass
- ✅ No merge conflicts
- ✅ PR must be in mergeable state
- ⚠️ Note: This is a powerful action - use carefully!

---

### 📚 `copilot:update-docs`
**Purpose**: Automatically update documentation

**When to use**:
- After feature implementations
- API changes that need documentation
- Missing or outdated documentation

**What it does**:
1. Analyzes code changes
2. Updates README if needed
3. Updates API documentation
4. Adds/improves code comments
5. Creates usage examples
6. Updates CHANGELOG if present

**Updates**:
- README.md
- API documentation
- Inline code comments
- Usage examples
- Changelog entries

---

### 🔒 `copilot:security-scan`
**Purpose**: Comprehensive security analysis and fixes

**When to use**:
- Before production releases
- After adding new dependencies
- When security is a concern
- Periodic security audits

**What it does**:
1. Scans for known vulnerabilities
2. Checks dependencies for security issues
3. Identifies code injection risks
4. Reviews authentication/authorization
5. Checks for data exposure risks
6. Fixes critical and high-severity issues

**Security checks**:
- Dependency vulnerabilities (npm audit)
- SQL/XSS/Command injection
- Authentication and authorization
- Sensitive data exposure
- Cryptography implementation

---

### ♻️ `copilot:refactor`
**Purpose**: Improve code quality and maintainability

**When to use**:
- Technical debt reduction
- Code that needs reorganization
- Improving code readability
- Applying design patterns

**What it does**:
1. Analyzes code structure
2. Improves organization and modularity
3. Applies design patterns
4. Removes code duplication (DRY)
5. Improves naming and clarity
6. Optimizes where beneficial

**Improvements**:
- Code organization
- Design pattern application
- DRY principles
- Better naming conventions
- Performance optimization
- Enhanced maintainability

---

### 🧪 `copilot:add-tests`
**Purpose**: Generate comprehensive test coverage

**When to use**:
- New features without tests
- Low test coverage areas
- Missing edge case tests
- Integration testing needs

**What it does**:
1. Analyzes the codebase
2. Identifies untested code paths
3. Generates unit tests
4. Creates integration tests
5. Adds edge case coverage
6. Tests error conditions

**Test types**:
- Unit tests for functions/methods
- Integration tests for components
- Edge case and boundary tests
- Error condition tests
- Happy path validation

---

### ⚡ `copilot:optimize`
**Purpose**: Optimize code performance

**When to use**:
- Performance bottlenecks
- Slow operations
- High resource usage
- Scalability concerns

**What it does**:
1. Profiles code performance
2. Identifies bottlenecks
3. Optimizes algorithms
4. Reduces memory usage
5. Improves database queries
6. Adds caching where appropriate

**Optimization areas**:
- Algorithm time complexity
- Memory footprint
- Database query efficiency
- API call reduction
- Lazy loading implementation
- Parallel processing

---

### 🚀 `copilot:deploy`
**Purpose**: Trigger deployment pipeline

**When to use**:
- Ready for production deployment
- Staging environment updates
- Automated releases

**What it does**:
1. Runs pre-deployment checks
2. Builds artifacts
3. Executes deployment
4. Verifies deployment success
5. Performs post-deployment validation

---

## How to Use

### Basic Usage

1. **Create or find an issue/PR** that needs automated action

2. **Apply the appropriate label** from the list above
   - Go to the issue or PR
   - Click "Labels" in the right sidebar
   - Select the `copilot:*` label that matches your need

3. **Wait for automation** to complete
   - The workflow triggers automatically
   - You'll see a comment indicating the task started
   - AI will analyze and execute the task
   - Results are posted as comments or PRs

### Example Workflow

```
1. Create issue: "Bug: Users can't login with email"
2. Add label: copilot:fix-issue
3. AI analyzes the issue
4. AI creates PR with fix: "Fix login validation for email format"
5. Review and merge the PR
```

### Manual Trigger

You can also manually trigger tasks via workflow dispatch:

1. Go to Actions → Label-Based Task Automation
2. Click "Run workflow"
3. Select the task type
4. Enter the issue/PR number
5. Run the workflow

---

## Configuration

### Label Configuration

Labels are defined in `.github/labels.yml`:

```yaml
labels:
  - name: "copilot:fix-issue"
    color: "0E8A16"
    description: "Instructs Copilot to analyze and automatically fix the reported issue"
    task: "fix_issue"
```

### Task Prompts

Each task has a detailed AI prompt that guides the automation. These are defined in the `tasks` section of `.github/labels.yml`.

### Syncing Labels

Labels are automatically synced to the repository when `.github/labels.yml` is updated on the main branch. You can also manually trigger the sync:

1. Go to Actions → Sync Repository Labels
2. Click "Run workflow"
3. The labels will be created/updated in the repository

---

## Requirements

### For Full Functionality

1. **OpenAI API Key**: Set `OPENAI_API_KEY` in repository secrets
   - Required for Codex-powered tasks
   - Without it, tasks will run in limited mode

2. **GitHub Token**: Automatically provided by GitHub Actions
   - Used for creating comments, PRs, and merges

3. **Permissions**: Repository must have Actions enabled
   - Write access to create PRs and comments
   - Admin access for merge operations

### Optional Enhancements

- **GitHub Copilot**: For enhanced code suggestions
- **Code scanning tools**: For security-scan task
- **Custom AI models**: Can be configured in workflow files

---

## Workflow Details

### Trigger Events

The automation triggers on:
- `issues.labeled` - When a label is added to an issue
- `pull_request.labeled` - When a label is added to a PR
- `workflow_dispatch` - Manual trigger with parameters

### Workflow Structure

1. **Detect Task**: Identifies which label was added and extracts task info
2. **Execute Task**: Runs the appropriate task-specific job
3. **Post Results**: Comments on the issue/PR with results
4. **Create PR** (if applicable): Creates a PR with changes

### Task Isolation

Each task runs in an isolated job, so:
- Multiple tasks can run concurrently
- Task failures don't affect each other
- Clear separation of concerns

---

## Best Practices

### 1. Clear Descriptions
Provide detailed issue/PR descriptions for better AI analysis:
```
❌ Bad: "Fix the bug"
✅ Good: "Application crashes when user submits form with empty email field. 
         Expected: Show validation error. Actual: 500 error"
```

### 2. One Task at a Time
Apply one automation label at a time:
```
❌ Bad: Apply copilot:fix-issue + copilot:add-tests + copilot:review-pr
✅ Good: Apply copilot:fix-issue, wait for completion, then copilot:add-tests
```

### 3. Review AI Changes
Always review AI-generated changes:
- Check the logic is correct
- Verify tests pass
- Ensure no unintended side effects
- The AI is a tool, not a replacement for human judgment

### 4. Security Labels
Use `copilot:security-scan` cautiously:
- Only on trusted branches
- Review all security fixes manually
- Don't auto-merge security PRs without review

### 5. Merge Automation
The `copilot:merge-to-main` label is powerful:
- Only use when you're confident
- Ensure all checks are configured properly
- Have a rollback plan

---

## Monitoring and Debugging

### View Workflow Runs

1. Go to Actions tab in repository
2. Select "Label-Based Task Automation"
3. View individual run details

### Check Task Status

- Each task posts a comment when it starts
- Final status is posted when complete
- Errors are logged in workflow output

### Common Issues

**Issue**: Task doesn't trigger
- **Solution**: Check label name matches exactly (case-sensitive)
- **Solution**: Verify workflow file is on default branch

**Issue**: Task fails with API error
- **Solution**: Check OPENAI_API_KEY is set correctly
- **Solution**: Verify API quota/limits

**Issue**: PR not created
- **Solution**: Check GitHub token permissions
- **Solution**: Verify branch protection rules allow bot PRs

---

## Extending the System

### Adding New Labels

1. Edit `.github/labels.yml`
2. Add new label definition:
```yaml
- name: "copilot:custom-task"
  color: "FFFFFF"
  description: "My custom task"
  task: "custom_task"
```

3. Add task definition:
```yaml
tasks:
  custom_task:
    description: "Custom task description"
    ai_prompt: |
      Your detailed AI prompt here...
```

4. Edit `.github/workflows/label-task-automation.yml`
5. Add new job for the task:
```yaml
execute-custom-task:
  name: Execute Custom Task
  needs: detect-task
  if: needs.detect-task.outputs.task == 'custom_task'
  # ... job steps
```

### Customizing AI Prompts

Edit the prompts in `.github/labels.yml` to:
- Change AI behavior
- Add specific instructions
- Enforce coding standards
- Include project-specific context

---

## Security Considerations

### Token Security
- Never expose OPENAI_API_KEY in logs
- Use GitHub Secrets for sensitive data
- Rotate tokens regularly

### Code Review
- Always review AI-generated code
- Don't auto-merge without human oversight
- Be especially careful with security changes

### Access Control
- Limit who can apply automation labels
- Use branch protection rules
- Require reviews for sensitive operations

### Audit Trail
- All actions are logged in workflow runs
- Comments provide task history
- GitHub audit log tracks label changes

---

## Cost Management

### OpenAI API Costs
- Each task uses OpenAI API (if configured)
- Monitor usage in OpenAI dashboard
- Consider setting usage limits
- Use tasks judiciously on large codebases

### GitHub Actions Minutes
- Each task consumes Actions minutes
- Monitor usage in repository settings
- Consider self-hosted runners for cost savings

---

## FAQ

**Q: Can I use this without OpenAI API?**
A: Some tasks will work in limited mode, but full functionality requires OpenAI API access.

**Q: Will AI changes always be correct?**
A: No, always review AI-generated changes. The AI is a helpful assistant, not infallible.

**Q: Can I apply multiple labels?**
A: Yes, but they'll run as separate workflow instances. One at a time is recommended.

**Q: How do I disable a specific task?**
A: Remove or comment out the corresponding job in the workflow file.

**Q: Can I use different AI models?**
A: Yes, edit the workflow file to change the `model` parameter.

**Q: What happens if a task fails?**
A: The workflow logs the error, and a comment is posted to the issue/PR.

---

## Support and Contributions

- **Issues**: Report bugs or request features via GitHub Issues
- **Discussions**: Ask questions in GitHub Discussions
- **Contributing**: Submit PRs to improve the automation system
- **Documentation**: Help improve these docs

---

## Version History

- **v1.0.0** (2024): Initial release with 10 automation tasks
  - Basic label-based task execution
  - Integration with OpenAI Codex
  - Comprehensive documentation

---

## License

This automation system is part of the Universal MCP Hub project and follows the same MIT license.
