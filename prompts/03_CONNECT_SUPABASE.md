/goal Connect ORI Learning to Supabase safely.

Prerequisites:
- database/schema.sql has already been run manually in Supabase.
- .env.local contains VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.

Implement:
- install official Supabase JS client
- one centralized Supabase client module
- TypeScript-friendly auth/session layer
- session loading state
- auth state change handling
- basic error handling
- no service_role key anywhere
- no direct database credentials
- do not disable RLS

Add a simple development diagnostics view or console-safe check that confirms:
- Supabase client initializes
- session can be read

Do not implement full login/expiry behavior yet.
Run build.
