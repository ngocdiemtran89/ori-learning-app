/goal Build the Vocabulary MVP using protected Supabase data.

Read schema.sql and Content Model first.

Features:
- Vocabulary deck list.
- Open a deck.
- Fetch only published content available under RLS.
- Flashcard front: word, IPA, part of speech, audio button if audio_url exists.
- Flashcard back: Vietnamese meaning, English example, Vietnamese translation, collocations, common mistake.
- Flip card.
- Previous / Next.
- Again / Hard / Good / Easy.
- Save / Unsave word.
- “Ôn hôm nay” view based on next_review_at.
- Basic deck progress.

SRS MVP rules:
- Again -> next review very soon / same day.
- Hard -> short interval.
- Good -> normal increasing interval.
- Easy -> longer interval.
Keep algorithm understandable and encapsulated in a pure function so it can be upgraded later.

Data:
- write review state to vocabulary_reviews.
- write saved words to saved_words.
- do not put the full paid deck into a public source JSON file.

UX:
- optimized for phone
- thumb-friendly controls
- clear loading/error/empty states

Verification:
- active user can read deck
- expired user cannot query deck because of RLS
- saved word persists across reload
- review state persists
- build passes
