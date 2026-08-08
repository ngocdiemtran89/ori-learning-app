/goal Build one complete Listening lesson flow and one complete Reading lesson flow.

Listening:
- list published listening lessons
- lesson detail
- audio player only when audio_url exists
- question cards
- answer selection
- submit
- score + explanation
- optional transcript revealed only after submission
- save quiz_attempts + progress

Reading:
- list published reading lessons
- passage
- questions
- answer selection
- submit
- score + explanation
- save quiz_attempts + progress

Do not mass-import content.
Make the flow correct using the demo records first.

Security:
- content queries must rely on RLS
- expired users must not receive lesson/question data

Run build and browser tests.
