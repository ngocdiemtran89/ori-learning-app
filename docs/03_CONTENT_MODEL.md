# Content Model

## Vocabulary
Các field tối thiểu:
- id
- word
- ipa
- part_of_speech
- meaning_vi
- example_en
- example_vi
- level
- topic
- toeic_parts
- collocations
- common_mistake
- audio_url
- is_published
- sort_order

## Vocabulary deck
- id
- slug
- title
- description
- level
- is_published

## Grammar
- id
- slug
- title
- level
- summary
- lesson_content
- examples
- is_published
- sort_order

## Listening
- lesson
- audio
- transcript
- questions
- options
- correct_answer
- explanation
- TOEIC part

## Reading
- lesson
- passage
- questions
- options
- correct_answer
- explanation
- TOEIC part

## Nội dung nên liên kết bằng tags
Ví dụ vocabulary `appointment`:
- topic: office
- level: foundation
- toeic_parts: ["part3", "part5", "part7"]

Sau này recommendation engine có thể tái sử dụng cùng tag.
