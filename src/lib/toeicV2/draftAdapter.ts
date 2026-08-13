// ============================================================
// ORI TOEIC Website V2 — Core Draft Adapter
// ============================================================

import { OriToeicV2Package } from './types';
import { normalizeToeicOptions } from './optionNormalizer';
import { importToeicTestDraft } from '../supabase/adminToeicClassifier';
import { ParsedToeicTestDraft } from '../toeic/classifier/types';

export function convertV2ToCoreDraftPayload(pkg: OriToeicV2Package): ParsedToeicTestDraft {
  const title = pkg.metadata?.title || 'Đề thi TOEIC V2';
  const slugBase = (pkg.metadata?.slug || title)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'toeic-v2-test';
  
  const slug = `${slugBase}-${Date.now().toString(36)}`;

  // Group key mapping to grp_ format if needed
  const groupKeyMap = new Map<string, string>();
  (pkg.groups || []).forEach((g, idx) => {
    const rawKey = g.group_key || `grp_${idx + 1}`;
    const cleanKey = rawKey.startsWith('grp_') ? rawKey : `grp_${rawKey}`;
    groupKeyMap.set(rawKey, cleanKey);
  });

  const coreGroups = (pkg.groups || []).map((g, idx) => {
    const tempKey = groupKeyMap.get(g.group_key) || `grp_${idx + 1}`;
    return {
      group_temp_key: tempKey,
      part: g.part,
      group_type: g.part.toLowerCase(),
      title: g.title || null,
      instruction: g.instruction || null,
      passage: g.passage || null,
      transcript: g.transcript || null,
      audio_url: g.audio_url || null,
      image_url: g.image_url || null,
      documents: g.documents || [],
    };
  });

  const coreQuestions = (pkg.questions || []).map((q) => {
    const normOptions = normalizeToeicOptions(q.options, q.part);
    const mappedGroupKey = q.group_key ? (groupKeyMap.get(q.group_key) || q.group_key) : null;

    return {
      group_temp_key: mappedGroupKey,
      question_number: q.question_number,
      part: q.part,
      question_text: q.question_text || null,
      options: normOptions,
      correct_answer: q.correct_answer || 'A',
      explanation: q.explanation || null,
      audio_url: q.audio_url || null,
      image_url: q.image_url || null,
    };
  });

  const testType: 'full' | 'mini' = pkg.metadata?.test_type === 'mini' ? 'mini' : 'full';

  return {
    metadata: {
      title,
      slug,
      test_code: pkg.metadata?.test_code || '',
      description: pkg.metadata?.description || 'Imported via ORI TOEIC V2 Studio',
      test_type: testType,
    },
    groups: coreGroups,
    questions: coreQuestions,
    issues: [],
    summary: {
      detectedQuestions: coreQuestions.length,
      partCounts: {},
      missingNumbers: [],
      duplicateNumbers: [],
      answersFound: coreQuestions.length,
    },
  };
}

export async function createCoreDraftFromV2(pkg: OriToeicV2Package): Promise<{
  success: boolean;
  testId?: string;
  error?: string;
}> {
  const draftPayload = convertV2ToCoreDraftPayload(pkg);
  return importToeicTestDraft(draftPayload);
}
