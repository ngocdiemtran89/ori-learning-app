---
trigger: always_on
---

# ORI Learning Workspace Rule

You are working on ORI Learning, a production-oriented student learning portal.

Always:
- Read docs/01_PRODUCT_SPEC.md and docs/02_ARCHITECTURE.md before architecture changes.
- Use React + TypeScript + Vite + Tailwind unless explicitly changed by the owner.
- Use Supabase for Auth/Postgres/RLS.
- Treat paid learning content as protected data.
- Never expose service-role secrets to the browser.
- Never disable RLS just to make a query work.
- Prefer small, testable changes.
- Run typecheck/build after meaningful implementation steps.
- Preserve existing working features.
- Mobile-first UI.
- Use Vietnamese student-facing copy unless the content itself is English learning material.
- Keep ORI design clean: bright blue, white, restrained accent colors.
- Do not add paid third-party services without explicit approval.
- Do not add AI APIs during Phase 1.
- Do not rewrite unrelated files during bug fixes.
- Before schema changes, explain migration impact.
- After changes, summarize files changed and tests performed.
