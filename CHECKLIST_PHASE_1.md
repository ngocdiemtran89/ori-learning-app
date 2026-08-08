# Phase 1 Acceptance Checklist

## Project
- [ ] Git repository exists
- [ ] `.env.local` not committed
- [ ] production build passes

## Auth
- [ ] login works
- [ ] logout works
- [ ] session survives refresh
- [ ] missing profile handled

## Access
- [ ] active student can learn
- [ ] expired student blocked
- [ ] disabled student blocked
- [ ] student cannot open admin
- [ ] admin can open admin

## Database
- [ ] RLS enabled
- [ ] no service role key in frontend
- [ ] student cannot read another user's progress
- [ ] expired user cannot query paid content

## Vocabulary
- [ ] deck list
- [ ] flashcard
- [ ] flip
- [ ] ratings
- [ ] save word
- [ ] review today
- [ ] progress persists

## Grammar
- [ ] lesson
- [ ] quiz
- [ ] explanation
- [ ] attempt saved

## Listening
- [ ] lesson opens
- [ ] questions work
- [ ] scoring works
- [ ] attempt saved

## Reading
- [ ] passage opens
- [ ] questions work
- [ ] scoring works
- [ ] attempt saved

## Dashboard
- [ ] real values
- [ ] expiry date
- [ ] review count
- [ ] recent progress
- [ ] next learning action

## Production
- [ ] Netlify deploy
- [ ] Supabase redirect URLs set
- [ ] production login tested
- [ ] mobile tested
