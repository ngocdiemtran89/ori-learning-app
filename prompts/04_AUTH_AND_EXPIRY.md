/goal Implement real login, protected routes and monthly-expiry access control.

Use Supabase Auth and the profiles table defined in database/schema.sql.

Required behavior:
1. Logged-out user visiting protected route -> /login.
2. Logged-in active student with valid access -> paid modules allowed.
3. Logged-in expired student -> /expired.
4. Disabled student -> /expired or access-denied state.
5. Admin -> can access /admin.
6. Student -> cannot access /admin.
7. Account page shows full name, level, status and exact expiry date.
8. Logout works.

Security:
- UI guard is only UX; database RLS remains source of truth.
- Do not rely on localStorage for authorization.
- Never use service_role key client-side.
- Do not change RLS to permissive policies to make code work.

Handle:
- session loading
- profile loading
- missing profile
- network failure
- expired access

Test the four user states and document how to create/modify them in Supabase.
Run production build and browser verification.
