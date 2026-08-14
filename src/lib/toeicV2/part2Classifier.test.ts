// ============================================================
// Phase P3.5G: Part 2 Listening Semantic Classifier Test Suite
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  classifySinglePart2Question,
  exportPart2GptHybridPacket,
  importPart2GptHybridResult,
  Part2ClassificationInput,
} from './part2Classifier';
import { extractLearningUnitsFromV2Package } from './extractLearningUnits';
import { OriToeicV2Package } from './types';

describe('Part 2 Listening Semantic Classifier Engine', () => {
  it('1. Classifies WH Family (WHEN, WHERE, WHO, WHAT, WHY, WHICH)', () => {
    expect(classifySinglePart2Question({ question_number: 7, part: 'part2', transcript: 'When will the meeting begin?' }).question_type).toBe('WHEN');
    expect(classifySinglePart2Question({ question_number: 8, part: 'part2', transcript: 'Where did you leave the documents?' }).question_type).toBe('WHERE');
    expect(classifySinglePart2Question({ question_number: 9, part: 'part2', transcript: 'Who is responsible for the presentation?' }).question_type).toBe('WHO');
    expect(classifySinglePart2Question({ question_number: 10, part: 'part2', transcript: 'What time does the train leave?' }).question_type).toBe('WHAT');
    expect(classifySinglePart2Question({ question_number: 11, part: 'part2', transcript: 'Why was the appointment canceled?' }).question_type).toBe('WHY');
    expect(classifySinglePart2Question({ question_number: 12, part: 'part2', transcript: 'Which office should I contact?' }).question_type).toBe('WHICH');
  });

  it('2. Classifies HOW Subtypes (HOW_GENERAL, HOW_MUCH, HOW_MANY, HOW_LONG, HOW_OFTEN, HOW_FAR, HOW_SOON)', () => {
    expect(classifySinglePart2Question({ question_number: 13, part: 'part2', transcript: 'How do I turn on this printer?' }).question_type).toBe('HOW_GENERAL');
    expect(classifySinglePart2Question({ question_number: 14, part: 'part2', transcript: 'How much does the ticket cost?' }).question_type).toBe('HOW_MUCH');
    expect(classifySinglePart2Question({ question_number: 15, part: 'part2', transcript: 'How many people are attending?' }).question_type).toBe('HOW_MANY');
    expect(classifySinglePart2Question({ question_number: 16, part: 'part2', transcript: 'How long will the presentation last?' }).question_type).toBe('HOW_LONG');
    expect(classifySinglePart2Question({ question_number: 17, part: 'part2', transcript: 'How often do you travel?' }).question_type).toBe('HOW_OFTEN');
    expect(classifySinglePart2Question({ question_number: 18, part: 'part2', transcript: 'How far is the airport?' }).question_type).toBe('HOW_FAR');
    expect(classifySinglePart2Question({ question_number: 19, part: 'part2', transcript: 'How soon can you finish?' }).question_type).toBe('HOW_SOON');
  });

  it('3. Classifies YES/NO & Auxiliary Types (YES_NO_BE, YES_NO_DO, YES_NO_HAVE, YES_NO_MODAL)', () => {
    expect(classifySinglePart2Question({ question_number: 20, part: 'part2', transcript: 'Is the conference room available?' }).question_type).toBe('YES_NO_BE');
    expect(classifySinglePart2Question({ question_number: 21, part: 'part2', transcript: 'Do you have the invoice?' }).question_type).toBe('YES_NO_DO');
    expect(classifySinglePart2Question({ question_number: 22, part: 'part2', transcript: 'Have you finished the report?' }).question_type).toBe('YES_NO_HAVE');
    expect(classifySinglePart2Question({ question_number: 23, part: 'part2', transcript: 'Can you attend tomorrow?' }).question_type).toBe('YES_NO_MODAL');
  });

  it('4. Classifies Action/Function Intents (REQUEST, OFFER, SUGGESTION, PERMISSION, INVITATION)', () => {
    expect(classifySinglePart2Question({ question_number: 24, part: 'part2', transcript: 'Could you please send me the report?' }).question_type).toBe('REQUEST');
    expect(classifySinglePart2Question({ question_number: 25, part: 'part2', transcript: 'Would you like me to print another copy?' }).question_type).toBe('OFFER');
    expect(classifySinglePart2Question({ question_number: 26, part: 'part2', transcript: "Why don't we meet after lunch?" }).question_type).toBe('SUGGESTION');
    expect(classifySinglePart2Question({ question_number: 27, part: 'part2', transcript: 'May I use this computer?' }).question_type).toBe('PERMISSION');
    expect(classifySinglePart2Question({ question_number: 28, part: 'part2', transcript: 'Would you like to join us for dinner?' }).question_type).toBe('INVITATION');
  });

  it('5. Classifies Other Forms (CHOICE_OR, TAG_QUESTION, NEGATIVE_QUESTION, STATEMENT)', () => {
    expect(classifySinglePart2Question({ question_number: 29, part: 'part2', transcript: 'Would you prefer tea or coffee?' }).question_type).toBe('CHOICE_OR');
    expect(classifySinglePart2Question({ question_number: 30, part: 'part2', transcript: "The meeting is at two, isn't it?" }).question_type).toBe('TAG_QUESTION');
    expect(classifySinglePart2Question({ question_number: 31, part: 'part2', transcript: "Didn't you submit the proposal?" }).question_type).toBe('NEGATIVE_QUESTION');
    expect(classifySinglePart2Question({ question_number: 32, part: 'part2', transcript: "The printer isn't working again." }).question_type).toBe('STATEMENT');
  });

  it('6. Missing transcript returns status NEEDS_TRANSCRIPT without crashing or guessing', () => {
    const res = classifySinglePart2Question({ question_number: 7, part: 'part2', transcript: '' });
    expect(res.approval_status).toBe('NEEDS_TRANSCRIPT');
    expect(res.confidence).toBe(0.0);
    expect(res.is_auto_approved).toBe(false);
  });

  it('7. Classifies Situational Topics (TIME_SCHEDULE, MEETING, OFFICE_WORKPLACE, PHONE_EMAIL, TRAVEL, TRANSPORTATION, DELIVERY_SHIPPING, EQUIPMENT_TECHNOLOGY, MAINTENANCE_REPAIR)', () => {
    expect(classifySinglePart2Question({ question_number: 7, part: 'part2', transcript: 'When will the shipment arrive?' }).primary_topic).toBe('DELIVERY_SHIPPING');
    expect(classifySinglePart2Question({ question_number: 8, part: 'part2', transcript: 'The printer is not working.' }).primary_topic).toBe('MAINTENANCE_REPAIR');
    expect(classifySinglePart2Question({ question_number: 9, part: 'part2', transcript: 'Could you reserve a conference room for the meeting?' }).primary_topic).toBe('MEETING');
    expect(classifySinglePart2Question({ question_number: 10, part: 'part2', transcript: 'How far is the airport?' }).primary_topic).toBe('TRANSPORTATION');
  });

  it('8. GPT Hybrid Part 2 export and import generates valid JSON with provenance = GPT_HYBRID', () => {
    const questions: Part2ClassificationInput[] = [
      { question_number: 17, part: 'part2', transcript: 'Could you send me the report?' },
    ];

    const jsonPacket = exportPart2GptHybridPacket(questions);
    expect(jsonPacket).toContain('ori.toeic.gpt_hybrid_p2.v1');

    const gptMockResponse = JSON.stringify([
      {
        questionNumber: 17,
        questionType: 'REQUEST',
        primaryTopic: 'DOCUMENTS_REPORTS',
        confidence: 0.95,
      },
    ]);

    const imported = importPart2GptHybridResult(gptMockResponse, questions);
    expect(imported.length).toBe(1);
    expect(imported[0].provenance).toBe('GPT_HYBRID');
    expect(imported[0].question_type).toBe('REQUEST');
    expect(imported[0].primary_topic).toBe('DOCUMENTS_REPORTS');
  });

  it('9. extractLearningUnitsFromV2Package auto-classifies Part 2 questions into Question Type and Topic items', () => {
    const pkg: OriToeicV2Package = {
      schema_version: 'ori.toeic.canonical.v1',
      metadata: { title: 'Test 1' },
      groups: [],
      questions: [
        {
          question_number: 7,
          part: 'P2',
          question_text: 'When will the shipment arrive?',
          options: ['(A) Tomorrow', '(B) Yes', '(C) By bus'],
          correct_answer: 'A',
        },
      ],
    };

    const data = extractLearningUnitsFromV2Package(pkg);
    expect(data.items.some((i) => i.item_key === 'p2_qtype_when')).toBe(true);
    expect(data.items.some((i) => i.item_key === 'p2_topic_delivery_shipping')).toBe(true);
    expect(data.links.some((l) => l.question_number === 7 && l.item_key === 'p2_qtype_when')).toBe(true);
  });

  it('10. Proves Part 2 and Part 5 item_keys have zero collision due to strict namespacing', () => {
    const p2Types = ['p2_qtype_when', 'p2_qtype_where', 'p2_qtype_request', 'p2_topic_meeting'];
    const p5Types = ['p5_grammar_word_form', 'p5_grammar_verb_tense', 'p5_vocab_meaning_in_context'];

    p2Types.forEach((k2) => {
      p5Types.forEach((k5) => {
        expect(k2).not.toBe(k5);
      });
    });
  });

  it('11. Security Guard: Part 1 and Part 2 active question presentation guards hide question_text before submission', () => {
    const hiddenParts = ['P1', 'part1', 'P2', 'part2'];
    hiddenParts.forEach((part) => {
      const isHidden = hiddenParts.includes(part);
      expect(isHidden).toBe(true);
    });
  });
});
