---
name: ori-learning
description: Implements and reviews features for the ORI TOEIC student learning portal, including authentication, expiring student access, vocabulary, grammar, listening, reading, progress tracking, Supabase RLS, and mobile-first UI.
---

# ORI Learning Skill

## Product priorities
1. Correct access control
2. Student learning flow
3. Mobile usability
4. Simple maintainable architecture
5. Low operating cost

## Required stack
- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Supabase JS

## Implementation process
For every feature:
1. Inspect current repo state.
2. Identify the smallest coherent change.
3. Implement without breaking existing routes.
4. Add loading, empty and error states.
5. Validate TypeScript.
6. Run production build.
7. Use browser verification when available.
8. Report changed files and remaining risks.

## Authentication
- Use Supabase Auth.
- Keep session handling centralized.
- Protected routes must require a session.
- Paid routes additionally require active access.
- Expired users may view account/expired screens, but not paid content.

## Authorization
Never trust client-side role checks alone.
Use Supabase RLS for:
- profiles
- student progress
- attempts
- saved words
- paid content
- admin operations

## Database
Prefer normalized tables for durable entities.
Use JSONB only for naturally nested educational content such as quiz option arrays when it simplifies authoring.

## UI
- Mobile-first
- Large tap targets
- Readable Vietnamese
- Clear learning actions
- Avoid dashboard clutter
- Avoid unnecessary animation
- Preserve learning focus

## Cost
Do not introduce a paid dependency when a reliable free/open-source option already exists.
