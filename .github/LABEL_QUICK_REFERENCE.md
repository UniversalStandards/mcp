# Label Automation Quick Reference

## 🚀 Quick Start

1. **Find an issue or PR** that needs automation
2. **Add a label** from the list below
3. **Watch the magic happen** - AI will automatically process the task
4. **Review the results** - Check comments and any PRs created

---

## 📋 Available Labels

| Label | Purpose | Use When | Result |
|-------|---------|----------|--------|
| `copilot:fix-issue` | Auto-fix bugs | Bug reports, issues needing fixes | Creates PR with fix |
| `copilot:review-pr` | Comprehensive review | PRs needing detailed review | Posts review comments |
| `copilot:fix-code` | Fix code issues | Failing tests, code quality issues | Creates/updates PR with fixes |
| `copilot:merge-to-main` | Auto-merge to main | Ready PRs with passing checks | Merges PR to main |
| `copilot:update-docs` | Update documentation | After features, API changes | Creates PR with doc updates |
| `copilot:security-scan` | Security analysis | Before releases, dependency updates | Scans and fixes vulnerabilities |
| `copilot:refactor` | Improve code quality | Technical debt, code smells | Creates PR with refactoring |
| `copilot:add-tests` | Generate tests | Missing test coverage | Creates PR with tests |
| `copilot:optimize` | Performance boost | Slow operations, bottlenecks | Creates PR with optimizations |
| `copilot:deploy` | Trigger deployment | Ready for production | Runs deployment pipeline |

---

## 💡 Usage Examples

### Fix a Bug
```
Issue: "App crashes when clicking submit button"
Action: Add label "copilot:fix-issue"
Result: AI analyzes, finds root cause, creates PR with fix
```

### Review Pull Request
```
PR: Large code changes needing review
Action: Add label "copilot:review-pr"
Result: AI performs comprehensive review, posts detailed feedback
```

### Merge When Ready
```
PR: All checks passed, ready to merge
Action: Add label "copilot:merge-to-main"
Result: Validates checks, safely merges to main
```

---

## ⚠️ Important Notes

- **Review AI Changes**: Always review AI-generated code before merging
- **One Label at a Time**: Apply labels sequentially for best results
- **OpenAI API Required**: Most tasks need OPENAI_API_KEY configured
- **Use Merge Carefully**: `copilot:merge-to-main` is powerful - use with caution

---

## 🔗 Resources

- 📖 **Full Documentation**: [docs/LABEL_AUTOMATION.md](../docs/LABEL_AUTOMATION.md)
- 🏷️ **Label Configuration**: [.github/labels.yml](labels.yml)
- ⚙️ **Workflow Details**: [.github/workflows/label-task-automation.yml](workflows/label-task-automation.yml)

---

## 🆘 Need Help?

1. Check the [full documentation](../docs/LABEL_AUTOMATION.md)
2. View workflow runs in the Actions tab
3. Open an issue if something isn't working
4. Review workflow logs for debugging

---

*🤖 Powered by GitHub Copilot & OpenAI Codex*
