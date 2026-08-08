-- Sample protected content.
insert into public.vocabulary_decks (slug, title, description, level, is_published, sort_order)
values
('foundation-office', 'Foundation — Office', 'Từ vựng văn phòng nền tảng', 'foundation', true, 1)
on conflict (slug) do nothing;

insert into public.vocabulary_items (
  deck_id, word, ipa, part_of_speech, meaning_vi,
  example_en, example_vi, topic, toeic_parts, collocations,
  common_mistake, is_published, sort_order
)
select
  d.id,
  'appointment',
  '/əˈpɔɪntmənt/',
  'noun',
  'cuộc hẹn; lịch hẹn',
  'I have an appointment with the manager at 10 a.m.',
  'Tôi có lịch hẹn với quản lý lúc 10 giờ sáng.',
  'office',
  array['part3','part5','part7'],
  array['make an appointment','schedule an appointment','cancel an appointment'],
  'Không dùng “do an appointment”.',
  true,
  1
from public.vocabulary_decks d
where d.slug = 'foundation-office'
and not exists (
  select 1 from public.vocabulary_items v
  where v.deck_id = d.id and v.word = 'appointment'
);

insert into public.grammar_lessons (
  slug, title, level, summary, lesson_content, is_published, sort_order
)
values (
  'present-simple-foundation',
  'Present Simple — Hiện tại đơn',
  'foundation',
  'Nền tảng cách dùng hiện tại đơn trong ngữ cảnh TOEIC.',
  '{
    "sections":[
      {"heading":"Khi nào dùng?","body":"Dùng cho thói quen, lịch trình và sự thật."},
      {"heading":"Ví dụ","examples":["The office opens at 8 a.m.","She works in customer service."]}
    ],
    "quiz":[
      {
        "question":"The office ___ at 8 a.m.",
        "options":["open","opens","opening","opened"],
        "answer":"opens",
        "explanation":"Chủ ngữ số ít “The office” dùng động từ thêm -s."
      }
    ]
  }'::jsonb,
  true,
  1
)
on conflict (slug) do nothing;

insert into public.learning_lessons (
  kind, slug, title, level, toeic_part, transcript, audio_url, is_published, sort_order
)
values (
  'listening',
  'listening-part2-demo',
  'Listening Part 2 — Demo',
  'foundation',
  'part2',
  'When is your appointment with the manager?',
  null,
  true,
  1
)
on conflict (slug) do nothing;

insert into public.learning_lessons (
  kind, slug, title, level, toeic_part, passage, is_published, sort_order
)
values (
  'reading',
  'reading-part5-demo',
  'Reading Part 5 — Demo',
  'foundation',
  'part5',
  'Mr. Lee has scheduled an appointment with the sales manager.',
  true,
  1
)
on conflict (slug) do nothing;
