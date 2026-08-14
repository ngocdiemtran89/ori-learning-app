// ============================================================
// Phase P3.5G: Part 5 Semantic Learning Classifier Test Suite
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  classifySinglePart5Question,
  exportPart5GptHybridPacket,
  importPart5GptHybridResult,
  Part5ClassificationInput,
} from './part5Classifier';
import { extractLearningUnitsFromV2Package } from './extractLearningUnits';
import { OriToeicV2Package } from './types';

describe('Part 5 Semantic Learning Classifier Engine', () => {
  it('1. Classifies Word Form (noun/adj/adv/verb derived from same stem)', () => {
    const q: Part5ClassificationInput = {
      question_number: 105,
      part: 'part5',
      question_text: 'The company decided to _____ its operations overseas.',
      options: ['(A) expansion', '(B) expand', '(C) expansive', '(D) expansively'],
      correct_answer: 'B',
    };

    const res = classifySinglePart5Question(q);
    expect(res.kind).toBe('grammar');
    expect(res.topic).toBe('word_form');
    expect(res.item_key).toBe('p5_grammar_word_form');
    expect(res.confidence).toBeGreaterThanOrEqual(0.9);
    expect(res.is_auto_approved).toBe(true);
  });

  it('2. Classifies Verb Tense (past/present/future/perfect inflections)', () => {
    const q: Part5ClassificationInput = {
      question_number: 108,
      part: 'part5',
      question_text: 'Mr. Smith _____ the quarterly financial report yesterday.',
      options: ['(A) submit', '(B) submitted', '(C) has submitted', '(D) will submit'],
      correct_answer: 'B',
    };

    const res = classifySinglePart5Question(q);
    expect(res.kind).toBe('grammar');
    expect(res.topic).toBe('verb_tense');
    expect(res.item_key).toBe('p5_grammar_verb_tense');
    expect(res.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('3. Classifies Verb Form (gerund vs infinitive vs participle)', () => {
    const q: Part5ClassificationInput = {
      question_number: 110,
      part: 'part5',
      question_text: 'She recommended _____ the contract before signing.',
      options: ['(A) to review', '(B) reviewing', '(C) review', '(D) reviewed'],
      correct_answer: 'B',
    };

    const res = classifySinglePart5Question(q);
    expect(res.kind).toBe('grammar');
    expect(res.topic).toBe('verb_form');
    expect(res.item_key).toBe('p5_grammar_verb_form');
  });

  it('4. Classifies Pronouns (he/him/his/himself)', () => {
    const q: Part5ClassificationInput = {
      question_number: 102,
      part: 'part5',
      question_text: 'The manager completed the project by _____.',
      options: ['(A) he', '(B) him', '(C) his', '(D) himself'],
      correct_answer: 'D',
    };

    const res = classifySinglePart5Question(q);
    expect(res.kind).toBe('grammar');
    expect(res.topic).toBe('pronoun');
    expect(res.item_key).toBe('p5_grammar_pronoun');
    expect(res.confidence).toBe(0.95);
  });

  it('5. Classifies Relative Clauses (who/whom/whose/which)', () => {
    const q: Part5ClassificationInput = {
      question_number: 115,
      part: 'part5',
      question_text: 'The candidate _____ resume was selected will be interviewed tomorrow.',
      options: ['(A) who', '(B) whom', '(C) whose', '(D) which'],
      correct_answer: 'C',
    };

    const res = classifySinglePart5Question(q);
    expect(res.kind).toBe('grammar');
    expect(res.topic).toBe('relative_clause');
    expect(res.item_key).toBe('p5_grammar_relative_clause');
    expect(res.confidence).toBe(0.95);
  });

  it('6. Classifies Prepositions (in/on/at/during/despite)', () => {
    const q: Part5ClassificationInput = {
      question_number: 103,
      part: 'part5',
      question_text: 'The annual conference will begin _____ 9:00 a.m.',
      options: ['(A) in', '(B) on', '(C) at', '(D) for'],
      correct_answer: 'C',
    };

    const res = classifySinglePart5Question(q);
    expect(res.kind).toBe('grammar');
    expect(res.topic).toBe('preposition');
    expect(res.item_key).toBe('p5_grammar_preposition');
    expect(res.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('7. Classifies Connectors / Conjunctions (although/because/however)', () => {
    const q: Part5ClassificationInput = {
      question_number: 112,
      part: 'part5',
      question_text: '_____ it rained heavily, the outdoor event continued as planned.',
      options: ['(A) Although', '(B) Because', '(C) However', '(D) Therefore'],
      correct_answer: 'A',
    };

    const res = classifySinglePart5Question(q);
    expect(res.kind).toBe('grammar');
    expect(res.topic).toBe('conjunction_connector');
    expect(res.item_key).toBe('p5_grammar_conjunction_connector');
  });

  it('8. Classifies Articles / Determiners / Quantifiers', () => {
    const q: Part5ClassificationInput = {
      question_number: 104,
      part: 'part5',
      question_text: '_____ employee is required to attend the orientation session.',
      options: ['(A) Each', '(B) Every', '(C) All', '(D) Both'],
      correct_answer: 'B',
    };

    const res = classifySinglePart5Question(q);
    expect(res.kind).toBe('grammar');
    expect(res.topic).toBe('quantifier');
  });

  it('9. Classifies Vocabulary Meaning in Context (4 distinct words)', () => {
    const q: Part5ClassificationInput = {
      question_number: 120,
      part: 'part5',
      question_text: 'The new policy is designed to make public transport more _____.',
      options: ['(A) affordable', '(B) eligible', '(C) temporary', '(D) reluctant'],
      correct_answer: 'A',
    };

    const res = classifySinglePart5Question(q);
    expect(res.kind).toBe('vocabulary');
    expect(res.topic).toBe('meaning_in_context');
    expect(res.item_key).toBe('p5_vocab_meaning_in_context');
  });

  it('10. Classifies Fixed Collocation Expressions', () => {
    const q: Part5ClassificationInput = {
      question_number: 125,
      part: 'part5',
      question_text: 'The report was prepared in accordance with company standards.',
      options: ['(A) accordance with', '(B) regard to', '(C) spite of', '(D) terms of'],
      correct_answer: 'A',
    };

    const res = classifySinglePart5Question(q);
    expect(res.kind).toBe('collocation');
    expect(res.topic).toBe('fixed_expression');
    expect(res.item_key).toBe('p5_collocation_fixed_expression');
  });

  it('11. Ambiguous/Uncertain question marked NEEDS_REVIEW and NOT auto-approved', () => {
    const ambiguousQ: Part5ClassificationInput = {
      question_number: 129,
      part: 'part5',
      question_text: 'Xyz alpha beta gamma delta.',
      options: ['foo', 'bar', 'baz', 'qux'],
      correct_answer: 'A',
    };

    const res = classifySinglePart5Question(ambiguousQ);
    expect(res.confidence).toBeLessThan(0.85);
    expect(res.approval_status).toBe('NEEDS_REVIEW');
    expect(res.is_auto_approved).toBe(false);
  });

  it('12. GPT Hybrid export packet generates valid JSON and imports results with provenance = GPT_HYBRID', () => {
    const questions: Part5ClassificationInput[] = [
      {
        question_number: 121,
        part: 'part5',
        question_text: 'Test question text',
        options: ['(A) opt1', '(B) opt2', '(C) opt3', '(D) opt4'],
        correct_answer: 'B',
      },
    ];

    const jsonPacket = exportPart5GptHybridPacket(questions);
    expect(jsonPacket).toContain('ori.toeic.gpt_hybrid.v1');
    expect(jsonPacket).toContain('Test question text');

    const gptMockResponse = JSON.stringify([
      {
        questionNumber: 121,
        kind: 'vocabulary',
        topic: 'business_vocabulary',
        confidence: 0.92,
        reasoning: 'Analyzed by ChatGPT model.',
      },
    ]);

    const imported = importPart5GptHybridResult(gptMockResponse, questions);
    expect(imported.length).toBe(1);
    expect(imported[0].provenance).toBe('GPT_HYBRID');
    expect(imported[0].topic).toBe('business_vocabulary');
    expect(imported[0].approval_status).toBe('SUGGESTED');
  });

  it('13. extractLearningUnitsFromV2Package auto-classifies Part 5 questions when learning_units array is missing', () => {
    const pkg: OriToeicV2Package = {
      schema_version: 'ori.toeic.canonical.v1',
      metadata: { title: 'Test 1' },
      groups: [],
      questions: [
        {
          question_number: 105,
          part: 'P5',
          question_text: 'The company decided to _____ its operations.',
          options: ['(A) expansion', '(B) expand', '(C) expansive', '(D) expansively'],
          correct_answer: 'B',
        },
      ],
    };

    const data = extractLearningUnitsFromV2Package(pkg);
    expect(data.items.length).toBe(1);
    expect(data.items[0].item_key).toBe('p5_grammar_word_form');
    expect(data.links.length).toBe(1);
    expect(data.links[0].question_number).toBe(105);
    expect(data.links[0].item_key).toBe('p5_grammar_word_form');
  });
});
