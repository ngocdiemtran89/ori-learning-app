// ============================================================
// ORI TOEIC Website V2 — Canonical Package Adapter
// ============================================================

import {
  CanonicalToeicImportPackage,
  CanonicalToeicQuestion,
  CanonicalToeicGroup,
  ToeicPart,
  CorrectAnswer,
} from './types';
import { normalizeToeicOptions } from './optionNormalizer';

/**
 * Maps raw or legacy part strings ('part1', 'Part 1', 'P1', etc.) to canonical ToeicPart
 */
export function normalizePartName(partStr: string | undefined | null, questionNumber?: number): ToeicPart {
  if (!partStr) {
    if (questionNumber) {
      if (questionNumber <= 6) return 'P1';
      if (questionNumber <= 31) return 'P2';
      if (questionNumber <= 70) return 'P3';
      if (questionNumber <= 100) return 'P4';
      if (questionNumber <= 130) return 'P5';
      if (questionNumber <= 146) return 'P6';
      return 'P7';
    }
    return 'P1';
  }

  const clean = partStr.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (clean === 'p1' || clean === 'part1' || clean === '1') return 'P1';
  if (clean === 'p2' || clean === 'part2' || clean === '2') return 'P2';
  if (clean === 'p3' || clean === 'part3' || clean === '3') return 'P3';
  if (clean === 'p4' || clean === 'part4' || clean === '4') return 'P4';
  if (clean === 'p5' || clean === 'part5' || clean === '5') return 'P5';
  if (clean === 'p6' || clean === 'part6' || clean === '6') return 'P6';
  if (clean === 'p7' || clean === 'part7' || clean === '7') return 'P7';

  return 'P1';
}

/**
 * Seamlessly adapts ANY input JSON (Import Studio OriToeicPackageV1, V2 JSON, or raw GPT JSON)
 * into ONE canonical internal model: CanonicalToeicImportPackage
 */
export function adaptToCanonicalPackage(rawPayload: any): CanonicalToeicImportPackage {
  if (!rawPayload || typeof rawPayload !== 'object') {
    throw new Error('Gói dữ liệu JSON không hợp lệ.');
  }

  // CASE 1: Import Studio V1 Package (OriToeicPackageV1)
  if (rawPayload.schema_version === 'ori.toeic.package.v1' || rawPayload.test) {
    const testMeta = rawPayload.test || {};
    const title = testMeta.title || 'Đề thi TOEIC Import Studio';

    const groupMap = new Map<number, CanonicalToeicGroup>();
    const rawGroups: any[] = Array.isArray(rawPayload.groups) ? rawPayload.groups : [];

    rawGroups.forEach((g) => {
      const idx = g.group_index ?? 0;
      const part = normalizePartName(g.part, g.start_question);
      const groupKey = `grp_${idx}`;

      groupMap.set(idx, {
        group_key: groupKey,
        part,
        title: g.title || null,
        instruction: g.instruction_vi || null,
        passage: g.passage || null,
        transcript: g.transcript || null,
        audio_url: g.audio_url || null,
        image_url: g.image_url || null,
        documents: g.documents || [],
        question_range: [g.start_question || 0, g.end_question || 0],
      });
    });

    // Map answer key if present in rawPayload.answers
    const answerKeyMap = new Map<number, CorrectAnswer>();
    if (Array.isArray(rawPayload.answers)) {
      rawPayload.answers.forEach((ans: any) => {
        if (ans.question_number && ans.correct_answer) {
          answerKeyMap.set(ans.question_number, ans.correct_answer as CorrectAnswer);
        }
      });
    }

    const rawQuestions: any[] = Array.isArray(rawPayload.questions) ? rawPayload.questions : [];
    const questions: CanonicalToeicQuestion[] = rawQuestions.map((q) => {
      const qNum = q.question_number;
      const part = normalizePartName(q.part, qNum);
      const groupKey = q.group_index != null ? `grp_${q.group_index}` : null;

      // Extract options text
      let optsInput: string[] = [];
      if (Array.isArray(q.options)) {
        optsInput = q.options.map((o: any) => (typeof o === 'object' ? `${o.label || ''} ${o.text || ''}` : String(o)));
      }

      const normOptions = normalizeToeicOptions(optsInput, part);
      const ansKey = q.correct_answer || answerKeyMap.get(qNum) || 'A';

      return {
        question_number: qNum,
        part,
        question_text: q.question_text || null,
        options: normOptions,
        correct_answer: (String(ansKey).toUpperCase().trim() as CorrectAnswer) || 'A',
        explanation: q.explanation || null,
        group_key: groupKey,
        audio_url: q.audio_url || null,
        image_url: q.image_url || null,
        translation_vi: q.translation_vi || null,
      };
    });

    return {
      schema_version: 'ori.toeic.canonical.v1',
      metadata: {
        title,
        slug: testMeta.slug,
        test_code: testMeta.test_code,
        description: testMeta.description || 'Imported via ORI Import Studio V1',
        test_type: 'full',
        is_published: false,
        status: 'draft',
      },
      groups: Array.from(groupMap.values()),
      questions,
    };
  }

  // CASE 2: V2 Package / Raw GPT JSON
  const meta = rawPayload.metadata || {};
  const rawQuestions: any[] = Array.isArray(rawPayload.questions) ? rawPayload.questions : [];
  const rawGroups: any[] = Array.isArray(rawPayload.groups) ? rawPayload.groups : [];

  const groups: CanonicalToeicGroup[] = rawGroups.map((g, idx) => {
    const rawKey = g.group_key || `grp_${idx + 1}`;
    const part = normalizePartName(g.part, g.question_range?.[0]);
    return {
      group_key: rawKey,
      part,
      title: g.title || null,
      instruction: g.instruction || null,
      passage: g.passage || null,
      transcript: g.transcript || null,
      audio_url: g.audio_url || null,
      image_url: g.image_url || null,
      documents: g.documents || [],
      question_range: g.question_range,
    };
  });

  const questions: CanonicalToeicQuestion[] = rawQuestions.map((q) => {
    const qNum = q.question_number;
    const part = normalizePartName(q.part, qNum);
    const normOptions = normalizeToeicOptions(q.options, part);

    return {
      question_number: qNum,
      part,
      question_text: q.question_text || null,
      options: normOptions,
      correct_answer: (String(q.correct_answer || 'A').toUpperCase().trim() as CorrectAnswer) || 'A',
      explanation: q.explanation || null,
      group_key: q.group_key || null,
      audio_url: q.audio_url || null,
      image_url: q.image_url || null,
      cue_target: q.cue_target || null,
      translation_vi: q.translation_vi || null,
      learning_units: q.learning_units || [],
    };
  });

  return {
    schema_version: 'ori.toeic.canonical.v1',
    metadata: {
      title: meta.title || 'Đề thi TOEIC V2',
      slug: meta.slug,
      test_code: meta.test_code,
      description: meta.description || 'Imported via ORI TOEIC V2 Importer',
      test_type: meta.test_type === 'mini' ? 'mini' : 'full',
      is_published: false,
      status: 'draft',
    },
    groups,
    questions,
    learning_units: rawPayload.learning_units || [],
  };
}
