/goal Perform a focused Phase 1 security and reliability review. Fix only issues found within this scope.

Checklist:
- service_role secret is absent from client and repository
- .env.local is ignored
- all protected tables have RLS enabled
- active user can read permitted published content
- expired user cannot read paid content directly through Supabase queries
- disabled user cannot read paid content
- student cannot read other students' progress
- student cannot modify role/expiry/status
- student cannot access admin data/actions
- admin can perform intended admin actions
- login redirect works
- logout works
- refresh on a protected route works
- malformed/missing data shows safe errors
- no dangerouslySetInnerHTML for educational content
- TypeScript/build pass
- no obvious accessibility blockers on mobile

Produce SECURITY_REVIEW.md with:
- tests run
- findings
- fixes
- remaining risks

Do not widen RLS policies just to make tests pass.
