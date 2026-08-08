/goal Prepare and deploy the existing ORI Learning Vite SPA to Vercel via GitHub without changing app architecture.

Tasks:
- verify npm run build output
- add correct Vercel SPA rewrite configuration (vercel.json)
- verify .env.local is not committed
- list production environment variables required on Vercel:
  VITE_SUPABASE_URL
  VITE_SUPABASE_ANON_KEY
- ensure production code contains no secret key
- provide exact Vercel dashboard steps (GitHub → Vercel → Supabase)
- after deploy, identify the production URL
- specify the exact Supabase Auth URL configuration values that must include the production domain (*.vercel.app)
- browser-test:
  login
  protected route refresh
  logout
  expired route
  vocabulary query

Do not migrate hosting providers away from Vercel.
Do not add paid Vercel services.
