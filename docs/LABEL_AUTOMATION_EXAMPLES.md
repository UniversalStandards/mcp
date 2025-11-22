# Label Automation - Real-World Examples

This document provides practical, real-world examples of how to use the label-based task automation system.

---

## Example 1: Fixing a Login Bug 🐛

**Scenario**: Users report that login fails when they enter an email with uppercase letters.

### Steps:

1. **Create the Issue**:
   ```
   Title: Bug: Login fails with uppercase email addresses
   
   Description:
   When users enter their email with uppercase letters (e.g., John@Example.com),
   the login fails with "Invalid credentials" even though the password is correct.
   
   Steps to reproduce:
   1. Go to login page
   2. Enter email: John@Example.com
   3. Enter correct password
   4. Click Login
   
   Expected: User logs in successfully
   Actual: "Invalid credentials" error
   
   Technical context:
   - Login handler is in src/auth/login.ts
   - Email validation may be case-sensitive
   ```

2. **Apply the Label**:
   - Go to the issue page
   - Click "Labels" in the right sidebar
   - Select `copilot:fix-issue`

3. **What Happens**:
   - Workflow triggers automatically
   - AI analyzes the issue description
   - AI locates the relevant code files
   - AI identifies the problem: email comparison is case-sensitive
   - AI creates a branch: `fix/issue-123`
   - AI makes the fix: converts email to lowercase before comparison
   - AI creates a PR with the fix and appropriate tests

4. **Review and Merge**:
   - Review the AI-generated PR
   - Verify tests pass
   - Merge the PR

**Time Saved**: 30-60 minutes of debugging and fixing

---

## Example 2: Comprehensive PR Review 👀

**Scenario**: Large PR with multiple changes needs thorough review.

### Steps:

1. **Developer Creates PR**:
   ```
   Title: Add user profile management feature
   
   Description:
   - Adds profile editing page
   - Implements avatar upload
   - Adds settings management
   - Updates API endpoints
   
   Changed Files: 15 files, +450 lines, -50 lines
   ```

2. **Apply the Label**:
   - On the PR page, add label `copilot:review-pr`

3. **What Happens**:
   - AI fetches the PR diff
   - Analyzes all changed files
   - Reviews for:
     * Code quality and style
     * Potential bugs
     * Security issues
     * Performance concerns
     * Test coverage
     * Documentation
   - Posts detailed review comments on specific lines
   - Provides overall feedback summary

4. **Example Review Comments**:
   ```
   File: src/profile/avatar-upload.ts, Line 45
   💡 Security: File type validation should also check file content,
   not just extension. Consider using magic numbers.
   
   File: src/api/profile.ts, Line 120
   ⚠️ Performance: This query might be slow for large datasets.
   Consider adding an index on user_id.
   
   File: tests/profile.test.ts
   ✅ Good test coverage for happy path. Consider adding tests for:
   - Large file uploads (>10MB)
   - Invalid file types
   - Concurrent profile updates
   ```

5. **Developer Addresses Feedback**:
   - Makes recommended changes
   - Adds suggested tests
   - Updates PR

**Time Saved**: 45-90 minutes of manual review

---

## Example 3: Security Audit Before Release 🔒

**Scenario**: Ready to release v2.0, need security check.

### Steps:

1. **Create Security Audit Issue**:
   ```
   Title: Security audit for v2.0 release
   
   Description:
   Pre-release security audit needed for version 2.0.
   
   Areas of concern:
   - New authentication system in src/auth/
   - Payment processing in src/payments/
   - New API endpoints in src/api/v2/
   - Third-party dependencies
   
   Please scan for vulnerabilities and fix critical issues.
   ```

2. **Apply Label**: `copilot:security-scan`

3. **What Happens**:
   - AI runs npm audit for dependency vulnerabilities
   - Scans code for common security issues:
     * SQL injection
     * XSS vulnerabilities
     * CSRF tokens
     * Insecure authentication
     * Data exposure
   - Creates report of findings
   - Creates PR with fixes for critical issues
   - Documents medium/low issues for manual review

4. **Example Findings**:
   ```
   🔴 CRITICAL: SQL Injection vulnerability in src/api/v2/users.ts
   Fixed: Implemented parameterized queries
   
   🟠 HIGH: Authentication token stored in localStorage
   Fixed: Moved to httpOnly cookie
   
   🟡 MEDIUM: Missing rate limiting on /api/v2/login
   Note: Requires infrastructure changes, documented for follow-up
   
   🟢 Dependencies: 3 vulnerabilities found and updated
   - jsonwebtoken: 8.5.1 → 9.0.2
   - lodash: 4.17.19 → 4.17.21
   - axios: 0.21.1 → 1.6.2
   ```

5. **Review and Deploy**:
   - Review security fixes
   - Test thoroughly
   - Merge security PR
   - Deploy with confidence

**Time Saved**: 2-4 hours of manual security audit

---

## Example 4: Adding Test Coverage 🧪

**Scenario**: New feature lacks proper test coverage.

### Steps:

1. **Create Issue or Comment on PR**:
   ```
   Title: Add tests for payment processing module
   
   Description:
   The new payment processing module in src/payments/ needs comprehensive tests.
   
   Files to test:
   - src/payments/stripe-processor.ts
   - src/payments/payment-validator.ts
   - src/payments/refund-handler.ts
   
   Test scenarios needed:
   - Successful payment processing
   - Failed payments
   - Refund flows
   - Edge cases (zero amount, negative, very large amounts)
   - Error handling
   ```

2. **Apply Label**: `copilot:add-tests`

3. **What Happens**:
   - AI analyzes the target files
   - Identifies functions and methods needing tests
   - Generates comprehensive test suite
   - Follows existing test patterns in the repo
   - Creates PR with tests

4. **Example Generated Tests**:
   ```typescript
   // tests/payments/stripe-processor.test.ts
   
   describe('StripeProcessor', () => {
     describe('processPayment', () => {
       it('should process successful payment', async () => {
         // Test implementation
       });
       
       it('should handle declined card', async () => {
         // Test implementation
       });
       
       it('should validate amount is positive', async () => {
         // Test implementation
       });
       
       it('should handle network errors gracefully', async () => {
         // Test implementation
       });
     });
     
     describe('processRefund', () => {
       it('should process full refund', async () => {
         // Test implementation
       });
       
       it('should process partial refund', async () => {
         // Test implementation
       });
       
       it('should reject refund for already-refunded payment', async () => {
         // Test implementation
       });
     });
   });
   ```

5. **Coverage Report**:
   ```
   Before: 45% coverage
   After:  87% coverage
   
   New tests: 24 test cases
   All tests passing ✓
   ```

**Time Saved**: 3-5 hours of test writing

---

## Example 5: Automated Merge for Dependency Updates 🔀

**Scenario**: Dependabot creates PR for dependency update, all checks pass.

### Steps:

1. **Dependabot Creates PR**:
   ```
   Title: Bump axios from 1.6.0 to 1.6.2
   
   Bumps axios from 1.6.0 to 1.6.2.
   
   Changelog:
   - Security fixes
   - Bug fixes
   
   All checks passed ✓
   ```

2. **Validate PR**:
   - Check changelog for breaking changes (none)
   - Verify tests pass
   - No merge conflicts

3. **Apply Label**: `copilot:merge-to-main`

4. **What Happens**:
   - AI validates:
     * ✓ All status checks pass
     * ✓ No merge conflicts
     * ✓ PR is in mergeable state
     * ✓ Required approvals present (if configured)
   - Executes merge (squash merge)
   - Posts confirmation comment
   - PR automatically closed

5. **Result**:
   ```
   ✅ Successfully merged to main!
   
   Merge details:
   - Method: Squash merge
   - Commit: abc123d
   - Checks: 8/8 passed
   - Merged at: 2024-01-15 14:30:00 UTC
   ```

**Time Saved**: 5-10 minutes per dependency update

---

## Example 6: Documentation Update After API Changes 📚

**Scenario**: REST API changes made, documentation needs updating.

### Steps:

1. **Create Issue on API PR**:
   ```
   Title: Update API documentation for v2 endpoints
   
   Description:
   The following API changes need documentation:
   
   New endpoints:
   - POST /api/v2/users/profile
   - PUT /api/v2/users/settings
   - DELETE /api/v2/users/avatar
   
   Modified endpoints:
   - GET /api/v2/users/:id (added new fields: bio, location)
   
   Files to update:
   - docs/API.md
   - README.md (API section)
   - OpenAPI spec in docs/openapi.yaml
   ```

2. **Apply Label**: `copilot:update-docs`

3. **What Happens**:
   - AI analyzes the API changes
   - Reviews existing documentation structure
   - Updates API documentation
   - Generates examples for new endpoints
   - Updates OpenAPI specification
   - Creates PR with documentation updates

4. **Example Documentation Generated**:
   ````markdown
   ## Update User Profile
   
   Updates the authenticated user's profile information.
   
   **Endpoint**: `POST /api/v2/users/profile`
   
   **Authentication**: Required (Bearer token)
   
   **Request Body**:
   ```json
   {
     "bio": "Software developer passionate about AI",
     "location": "San Francisco, CA",
     "website": "https://example.com"
   }
   ```
   
   **Response**:
   ```json
   {
     "id": "user123",
     "bio": "Software developer passionate about AI",
     "location": "San Francisco, CA",
     "website": "https://example.com",
     "updated_at": "2024-01-15T14:30:00Z"
   }
   ```
   
   **Error Responses**:
   - `400 Bad Request`: Invalid input data
   - `401 Unauthorized`: Missing or invalid token
   - `422 Unprocessable Entity`: Validation errors
   ````

**Time Saved**: 1-2 hours of documentation writing

---

## Example 7: Performance Optimization ⚡

**Scenario**: Dashboard page loads slowly with many users.

### Steps:

1. **Create Performance Issue**:
   ```
   Title: Optimize dashboard loading performance
   
   Description:
   Dashboard page takes 3-5 seconds to load for users with many projects.
   
   Problem areas identified:
   - src/dashboard/data-loader.ts - loads all projects at once
   - src/dashboard/stats-calculator.ts - recalculates on every render
   - Multiple unnecessary API calls
   
   Current: ~4s load time
   Target: <1s load time
   
   Suggestions:
   - Implement pagination
   - Add caching for stats
   - Lazy load project details
   - Optimize database queries
   ```

2. **Apply Label**: `copilot:optimize`

3. **What Happens**:
   - AI analyzes the problem areas
   - Identifies optimization opportunities
   - Implements improvements:
     * Adds pagination to project list
     * Implements memoization for expensive calculations
     * Adds caching layer
     * Optimizes database queries
     * Lazy loads non-critical data
   - Creates PR with optimizations
   - Includes performance metrics

4. **Results**:
   ```
   Performance Improvements:
   
   Before:
   - Initial load: 4.2s
   - API calls: 12 requests
   - Data transferred: 2.5MB
   
   After:
   - Initial load: 0.8s (81% faster)
   - API calls: 3 requests (75% reduction)
   - Data transferred: 150KB (94% reduction)
   
   Optimizations Applied:
   ✓ Added pagination (50 items per page)
   ✓ Implemented React.memo for expensive components
   ✓ Added Redis caching for stats
   ✓ Optimized SQL queries with indexes
   ✓ Lazy load project details on expand
   ```

**Time Saved**: 4-6 hours of performance profiling and optimization

---

## Example 8: Code Refactoring ♻️

**Scenario**: Legacy authentication module needs refactoring.

### Steps:

1. **Create Refactoring Issue**:
   ```
   Title: Refactor authentication module
   
   Description:
   The auth module (src/auth/) needs refactoring:
   
   Issues:
   - 500+ line functions
   - Repeated code across login/register/reset
   - Poor error handling
   - Hard to test
   - No separation of concerns
   
   Goals:
   - Break into smaller, focused functions
   - Remove code duplication
   - Improve error handling
   - Make testable
   - Apply clean code principles
   ```

2. **Apply Label**: `copilot:refactor`

3. **What Happens**:
   - AI analyzes the current code structure
   - Identifies code smells and anti-patterns
   - Applies refactoring:
     * Extracts common logic into utilities
     * Breaks large functions into smaller ones
     * Implements proper error handling
     * Improves naming
     * Adds appropriate abstractions
   - Ensures all tests still pass
   - Creates PR with refactored code

4. **Refactoring Summary**:
   ```
   Refactoring Applied:
   
   ✓ Extracted common validation logic to auth-validators.ts
   ✓ Split large functions:
     - processLogin (520 lines) → 5 focused functions
     - handleRegistration (380 lines) → 4 functions
   ✓ Created AuthService class for better organization
   ✓ Improved error handling with custom error types
   ✓ Reduced code duplication by 45%
   ✓ All 47 tests passing
   
   Code Quality Metrics:
   Before:
   - Cyclomatic complexity: 28
   - Maintainability index: 42
   - Code duplication: 35%
   
   After:
   - Cyclomatic complexity: 8
   - Maintainability index: 78
   - Code duplication: 12%
   ```

**Time Saved**: 6-8 hours of careful refactoring

---

## Best Practices from These Examples

### 1. **Provide Clear Context**
Good issue descriptions help AI understand the problem better:
- Explain what's wrong
- Include relevant file paths
- Add reproduction steps
- Specify expected behavior

### 2. **Be Specific About Scope**
Define what needs to be done:
- List specific files to work on
- Mention related test files
- Include any constraints or requirements

### 3. **Review AI Output**
Always review AI-generated code:
- Check logic correctness
- Verify test coverage
- Ensure it follows project patterns
- Test thoroughly before merging

### 4. **Use Labels Sequentially**
Don't apply multiple task labels at once:
```
❌ Bad: Apply fix-code + add-tests + review-pr simultaneously
✅ Good: Apply fix-code → wait → apply add-tests → wait → apply review-pr
```

### 5. **Combine with Manual Review**
AI is a tool to assist, not replace:
- Use AI for initial implementation
- Human review for correctness
- AI for test generation
- Human review for test quality

---

## Measuring Success

Track improvements from automation:

```
Metric                    Before    After    Improvement
-------------------------------------------------------
Time to fix bugs          2-3 hrs   30 min   75% faster
PR review time            1-2 hrs   15 min   87% faster
Test coverage             55%       85%      +30 points
Documentation lag         1 week    1 day    86% faster
Security audit frequency  Quarterly Weekly   4x increase
```

---

## Common Patterns

### Pattern 1: Bug Fix → Tests → Review
```
1. Label: copilot:fix-issue (creates PR with fix)
2. Label: copilot:add-tests (adds tests to PR)
3. Label: copilot:review-pr (reviews combined changes)
4. Manual review and merge
```

### Pattern 2: Feature → Docs → Security
```
1. Develop feature manually
2. Label: copilot:update-docs (documents feature)
3. Label: copilot:security-scan (security check)
4. Label: copilot:merge-to-main (auto-merge if clean)
```

### Pattern 3: Refactor → Test → Optimize
```
1. Label: copilot:refactor (improve code structure)
2. Label: copilot:add-tests (ensure coverage)
3. Label: copilot:optimize (performance improvements)
4. Manual validation and merge
```

---

## Conclusion

The label-based automation system significantly accelerates development workflows while maintaining code quality. Use these examples as templates for your own automation needs!

For more details, see the [full documentation](LABEL_AUTOMATION.md).
