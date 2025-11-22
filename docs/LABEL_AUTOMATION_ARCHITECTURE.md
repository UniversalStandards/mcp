# Label Automation System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         GitHub Repository                           │
│                                                                     │
│  ┌──────────────┐                                                  │
│  │ Issue / PR   │                                                  │
│  │              │                                                  │
│  │ User adds    │                                                  │
│  │ copilot:*    │                                                  │
│  │ label        │                                                  │
│  └──────┬───────┘                                                  │
│         │                                                          │
│         │ Triggers                                                 │
│         ▼                                                          │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │        GitHub Actions Workflow                              │  │
│  │        (label-task-automation.yml)                          │  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Workflow Execution                           │
│                                                                     │
│  Step 1: Detect Task                                               │
│  ┌─────────────────────────────────────────────────────┐           │
│  │ • Extract label name (e.g., "copilot:fix-issue")   │           │
│  │ • Map to task identifier (e.g., "fix_issue")       │           │
│  │ • Extract issue/PR metadata                         │           │
│  │ • Determine task type (issue vs PR)                 │           │
│  └─────────────────────────────────────────────────────┘           │
│         │                                                          │
│         ▼                                                          │
│  Step 2: Route to Task Handler                                    │
│  ┌─────────────────────────────────────────────────────┐           │
│  │                Task Selection                        │           │
│  │  ┌──────────────────────────────────────────────┐  │           │
│  │  │ if task == "fix_issue"                       │  │           │
│  │  │   → execute-fix-issue job                    │  │           │
│  │  │                                               │  │           │
│  │  │ if task == "review_pull_request"             │  │           │
│  │  │   → execute-review-pr job                    │  │           │
│  │  │                                               │  │           │
│  │  │ if task == "fix_code"                        │  │           │
│  │  │   → execute-fix-code job                     │  │           │
│  │  │                                               │  │           │
│  │  │ ... (and so on for all tasks)                │  │           │
│  │  └──────────────────────────────────────────────┘  │           │
│  └─────────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Task Execution Flow                              │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 1. Post Initial Comment                                      │  │
│  │    "🤖 Task started: Analyzing..."                           │  │
│  └──────────────────────────────────────────────────────────────┘  │
│         │                                                          │
│         ▼                                                          │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 2. Gather Context                                            │  │
│  │    • Fetch issue/PR details                                  │  │
│  │    • Get file diffs (for PRs)                                │  │
│  │    • Analyze code structure                                  │  │
│  │    • Load task prompt template                               │  │
│  └──────────────────────────────────────────────────────────────┘  │
│         │                                                          │
│         ▼                                                          │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 3. AI Processing (OpenAI Codex)                              │  │
│  │    ┌────────────────────────────────────────────┐            │  │
│  │    │ Input:                                     │            │  │
│  │    │ • Task prompt from labels.yml              │            │  │
│  │    │ • Issue/PR context                         │            │  │
│  │    │ • Repository code                          │            │  │
│  │    │                                             │            │  │
│  │    │ Processing:                                │            │  │
│  │    │ • Analyze problem                          │            │  │
│  │    │ • Generate solution                        │            │  │
│  │    │ • Create/modify code                       │            │  │
│  │    │ • Generate tests if needed                 │            │  │
│  │    │                                             │            │  │
│  │    │ Output:                                    │            │  │
│  │    │ • Code changes                             │            │  │
│  │    │ • Review comments                          │            │  │
│  │    │ • Recommendations                          │            │  │
│  │    └────────────────────────────────────────────┘            │  │
│  └──────────────────────────────────────────────────────────────┘  │
│         │                                                          │
│         ▼                                                          │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 4. Apply Changes                                             │  │
│  │    • Create new branch (if needed)                           │  │
│  │    • Commit code changes                                     │  │
│  │    • Push to repository                                      │  │
│  │    • Create/update PR (if applicable)                        │  │
│  │    • Or post review comments (for reviews)                   │  │
│  │    • Or execute merge (for merge tasks)                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
│         │                                                          │
│         ▼                                                          │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 5. Post Results                                              │  │
│  │    "✅ Task completed! [PR created/Comments posted/Merged]"  │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Task Summary                                │
│                                                                     │
│  • Updates issue/PR with completion status                         │
│  • Links to created PRs (if applicable)                            │
│  • Provides summary of actions taken                               │
│  • Logs workflow execution details                                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Task Flow Examples

### Example 1: Fix Issue Task

```
User Action:
┌────────────────────────┐
│ Add label:             │
│ copilot:fix-issue      │
│ to Issue #123          │
└───────────┬────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│ Workflow Triggered                      │
│                                         │
│ Event: issues.labeled                   │
│ Label: copilot:fix-issue                │
│ Task: fix_issue                         │
└───────────┬─────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│ execute-fix-issue Job                   │
│                                         │
│ 1. Comment: "🤖 Analyzing issue..."     │
│                                         │
│ 2. Load context:                        │
│    - Issue title                        │
│    - Issue description                  │
│    - Related files mentioned            │
│                                         │
│ 3. AI Analysis:                         │
│    - Understand problem                 │
│    - Identify root cause                │
│    - Design solution                    │
│                                         │
│ 4. Generate fix:                        │
│    - Create branch: fix/issue-123       │
│    - Modify affected files              │
│    - Add/update tests                   │
│    - Commit changes                     │
│                                         │
│ 5. Create PR:                           │
│    - Title: "Fix: [Issue description]"  │
│    - Body: Explains fix                 │
│    - Links back to issue                │
└───────────┬─────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│ Results Posted                          │
│                                         │
│ Comment on Issue #123:                  │
│ "✅ Fix created in PR #456              │
│  Branch: fix/issue-123                  │
│  Files changed: 3                       │
│  Tests added: 5"                        │
└─────────────────────────────────────────┘
```

### Example 2: Review PR Task

```
User Action:
┌────────────────────────┐
│ Add label:             │
│ copilot:review-pr      │
│ to PR #456             │
└───────────┬────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│ Workflow Triggered                      │
│                                         │
│ Event: pull_request.labeled             │
│ Label: copilot:review-pr                │
│ Task: review_pull_request               │
└───────────┬─────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│ execute-review-pr Job                   │
│                                         │
│ 1. Comment: "🤖 Reviewing PR..."        │
│                                         │
│ 2. Fetch PR diff:                       │
│    - Get all changed files              │
│    - Extract code changes               │
│    - Identify affected areas            │
│                                         │
│ 3. AI Review:                           │
│    - Analyze code quality               │
│    - Check for bugs                     │
│    - Verify best practices              │
│    - Check security                     │
│    - Assess performance                 │
│    - Validate tests                     │
│                                         │
│ 4. Generate feedback:                   │
│    - Overall summary                    │
│    - File-by-file review                │
│    - Inline code comments               │
│    - Suggestions for improvement        │
└───────────┬─────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│ Results Posted                          │
│                                         │
│ Review Comments on PR #456:             │
│                                         │
│ Overall: "Code looks good overall..."   │
│                                         │
│ File: auth.ts, Line 45:                 │
│ "💡 Consider adding null check here"    │
│                                         │
│ File: tests/auth.test.ts:               │
│ "✅ Good test coverage"                 │
│                                         │
│ Summary: "3 suggestions, 2 approvals"   │
└─────────────────────────────────────────┘
```

---

## Component Responsibilities

### 1. Labels Configuration (`labels.yml`)
**Purpose**: Define available automation tasks

**Contents**:
- Label definitions (name, color, description)
- Task mappings
- AI prompt templates
- Task-specific instructions

**Example**:
```yaml
labels:
  - name: "copilot:fix-issue"
    color: "0E8A16"
    description: "Auto-fix issues"
    task: "fix_issue"

tasks:
  fix_issue:
    description: "Analyze and fix issues"
    ai_prompt: |
      Fix this issue: {{issue.title}}
      ...
```

---

### 2. Main Workflow (`label-task-automation.yml`)
**Purpose**: Orchestrate task execution

**Jobs**:
1. **detect-task**: Identify which task to run
2. **execute-{task}**: Task-specific execution
3. **task-summary**: Post-execution reporting

**Key Features**:
- Parallel job execution (only runs relevant task)
- Conditional execution based on label
- Error handling and recovery
- Status reporting

---

### 3. Label Sync Workflow (`sync-labels.yml`)
**Purpose**: Keep repository labels in sync

**Triggers**:
- Push to main (when labels.yml changes)
- Manual workflow dispatch

**Actions**:
- Parse labels.yml
- Compare with existing labels
- Create/update labels as needed
- Report sync status

---

### 4. OpenAI Codex Integration
**Purpose**: AI-powered code analysis and generation

**Configuration**:
```yaml
uses: lemonberrylabs/openai-codex-action@v0.3.0
with:
  model: gpt-4
  provider: openai
  provider_api_key: ${{ secrets.OPENAI_API_KEY }}
  branch_name: feature-branch-name
  prompt: |
    Detailed AI instructions...
```

**Capabilities**:
- Code analysis and understanding
- Bug detection and fixing
- Test generation
- Code refactoring
- Documentation generation
- Security analysis

---

## Data Flow

### Input Sources

```
┌──────────────────────────────────────┐
│ Input Data                           │
├──────────────────────────────────────┤
│ • Issue/PR metadata                  │
│   - Title                            │
│   - Description                      │
│   - Number                           │
│   - Author                           │
│   - Labels                           │
│                                      │
│ • Code context                       │
│   - Changed files (for PRs)          │
│   - File diffs                       │
│   - Repository structure             │
│   - Existing tests                   │
│                                      │
│ • Task configuration                 │
│   - Task type                        │
│   - AI prompt template               │
│   - Task-specific settings           │
└──────────────────────────────────────┘
```

### Processing Pipeline

```
Input → Context Gathering → AI Processing → Action Execution → Output
  │            │                  │               │              │
  │            │                  │               │              │
  │         Enrich            Generate        Apply          Report
  │         with              solution        changes        results
  │         repo                              to repo        to user
  │         data
  │
  └─ Validate label and permissions
```

### Output Types

```
┌──────────────────────────────────────┐
│ Output Actions                       │
├──────────────────────────────────────┤
│ 1. Comments                          │
│    • Status updates                  │
│    • Review feedback                 │
│    • Completion summaries            │
│                                      │
│ 2. Code Changes                      │
│    • New branches                    │
│    • File modifications              │
│    • Commits                         │
│                                      │
│ 3. PRs                               │
│    • New PRs created                 │
│    • Existing PRs updated            │
│                                      │
│ 4. Merges                            │
│    • PR merged to main               │
│    • Branch cleanup                  │
└──────────────────────────────────────┘
```

---

## Security Model

### Authentication & Authorization

```
┌─────────────────────────────────────────────┐
│ Security Layers                             │
├─────────────────────────────────────────────┤
│ Layer 1: GitHub Token                       │
│ • Provided by GitHub Actions                │
│ • Scoped to repository                      │
│ • Permissions: read/write repo              │
│                                             │
│ Layer 2: OpenAI API Key                     │
│ • Stored in GitHub Secrets                  │
│ • Encrypted at rest                         │
│ • Never exposed in logs                     │
│                                             │
│ Layer 3: Workflow Permissions               │
│ • Only triggers on labeled events           │
│ • Validates label format                    │
│ • Checks user permissions                   │
│                                             │
│ Layer 4: Task Validation                    │
│ • Merge tasks check all requirements        │
│ • Branch protection respected               │
│ • Review requirements enforced              │
└─────────────────────────────────────────────┘
```

### Safety Checks

```
For merge operations (copilot:merge-to-main):
┌─────────────────────────────────┐
│ Pre-merge Validation            │
├─────────────────────────────────┤
│ ✓ All status checks pass        │
│ ✓ No merge conflicts            │
│ ✓ Required reviews present      │
│ ✓ Branch is mergeable           │
│ ✓ No failed CI/CD jobs          │
└─────────────────────────────────┘
        │
        ▼
  All pass? → Merge
  Any fail? → Abort with explanation
```

---

## Scalability Considerations

### Concurrent Execution

```
Multiple labels on different issues/PRs:
┌──────────────────────────────────────┐
│ Parallel Workflow Runs               │
├──────────────────────────────────────┤
│ Issue #1 + copilot:fix-issue         │
│ ├─→ Workflow run #101 (independent)  │
│                                      │
│ PR #2 + copilot:review-pr            │
│ ├─→ Workflow run #102 (independent)  │
│                                      │
│ Issue #3 + copilot:security-scan     │
│ ├─→ Workflow run #103 (independent)  │
└──────────────────────────────────────┘

Each runs independently without conflicts
```

### Resource Management

```
┌─────────────────────────────────────┐
│ Resource Limits                     │
├─────────────────────────────────────┤
│ • GitHub Actions minutes            │
│   - Varies by plan                  │
│   - Monitor usage                   │
│                                     │
│ • OpenAI API usage                  │
│   - Per-token billing               │
│   - Set usage limits                │
│   - Monitor costs                   │
│                                     │
│ • Repository rate limits            │
│   - API calls throttled             │
│   - Respect limits                  │
└─────────────────────────────────────┘
```

---

## Extensibility

### Adding New Tasks

```
Step 1: Update labels.yml
┌────────────────────────────┐
│ labels:                    │
│   - name: copilot:my-task  │
│     task: my_task          │
│                            │
│ tasks:                     │
│   my_task:                 │
│     ai_prompt: |           │
│       Task instructions... │
└────────────────────────────┘

Step 2: Add job to workflow
┌────────────────────────────┐
│ execute-my-task:           │
│   if: task == 'my_task'    │
│   steps:                   │
│     - Run custom logic     │
└────────────────────────────┘

Step 3: Sync labels
┌────────────────────────────┐
│ Run sync-labels workflow   │
│ Labels appear in repo      │
└────────────────────────────┘
```

### Custom AI Prompts

Modify prompts in `labels.yml` to:
- Change AI behavior
- Add project-specific context
- Enforce coding standards
- Include custom instructions

---

## Monitoring & Debugging

### Workflow Monitoring

```
GitHub Actions Tab
├─ label-task-automation runs
│  ├─ Run #101: Issue #1 (copilot:fix-issue)
│  │  ├─ detect-task ✓
│  │  ├─ execute-fix-issue ✓
│  │  └─ task-summary ✓
│  │
│  ├─ Run #102: PR #2 (copilot:review-pr)
│  │  ├─ detect-task ✓
│  │  ├─ execute-review-pr ✗ (view logs)
│  │  └─ task-summary -
│  │
│  └─ ...
```

### Debug Information

Available in workflow logs:
- Label detection details
- Task routing decisions
- AI prompt used
- API responses
- Error messages
- Execution time

---

## Integration Points

### External Services

```
┌──────────────────┐
│ GitHub API       │ ← Fetch issues/PRs, create comments
├──────────────────┤
│ OpenAI API       │ ← AI processing
├──────────────────┤
│ GitHub Actions   │ ← Workflow execution
├──────────────────┤
│ Git              │ ← Branch/commit operations
└──────────────────┘
```

### Webhook Events

Supported triggers:
- `issues.labeled`
- `pull_request.labeled`
- `workflow_dispatch` (manual)

---

## Performance Metrics

### Typical Execution Times

```
Task                  Duration    Details
─────────────────────────────────────────
detect-task          10-20s      Fast label detection
execute-fix-issue    2-5 min     AI analysis + code generation
execute-review-pr    1-3 min     Code review generation
execute-merge        30-60s      Validation + merge
sync-labels          20-40s      Label synchronization
```

### Cost Estimates

```
Per Task (with OpenAI GPT-4):
─────────────────────────────
Small fix:    $0.02 - $0.05
Code review:  $0.03 - $0.08
Large refactor: $0.10 - $0.20

Monthly (average usage):
─────────────────────────────
10 tasks/day:  $6 - $15
50 tasks/day:  $30 - $75
100 tasks/day: $60 - $150
```

---

## Summary

The Label Automation System provides a powerful, flexible framework for automating development tasks using AI. Its modular architecture allows easy extension while maintaining security and reliability.

**Key Strengths**:
- Simple user interface (just add a label)
- Powerful AI-driven automation
- Safe execution with validation
- Comprehensive documentation
- Easy to extend and customize

For implementation details, see the [full documentation](LABEL_AUTOMATION.md).
