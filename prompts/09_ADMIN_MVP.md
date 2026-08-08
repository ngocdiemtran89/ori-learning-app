/goal Build a minimal secure Admin Student Management screen.

Scope:
- admin-only route
- list student profiles
- search by name/email if feasible from available data
- show level
- status
- access_start_at
- access_expires_at
- update level
- update expiry date
- activate/disable

Important:
- student must not be able to update these fields
- authorization must be enforced by RLS, not just hidden UI
- no service_role key in frontend
- do not build content CMS yet
- require confirmation before disabling a student

Add clear success/error feedback.
Run RLS-oriented tests and production build.
