/goal Prepare and deploy the existing ORI Learning Vite SPA to Netlify without changing app architecture.

Tasks:
- verify npm run build output
- add correct Netlify SPA redirect configuration
- verify .env.local is not committed
- list production environment variables required:
  VITE_SUPABASE_URL
  VITE_SUPABASE_ANON_KEY
- ensure production code contains no secret key
- provide exact Netlify dashboard steps if authentication cannot be completed automatically
- after deploy, identify the production URL
- specify the exact Supabase Auth URL configuration values that must include the production domain
- browser-test:
  login
  protected route refresh
  logout
  expired route
  vocabulary query

Do not migrate hosting providers.
Do not add paid Netlify services.
