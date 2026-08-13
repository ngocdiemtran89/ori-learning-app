// ============================================================
// ORI TOEIC Website V2 — Core Draft Adapter
// ============================================================

import { adaptToCanonicalPackage } from './canonicalAdapter';
import { importToeicTestDraft } from '../supabase/adminToeicClassifier';
import { ParsedToeicTestDraft } from '../toeic/classifier/types';
import { supabase } from '../supabase/client';

export function convertV2ToCoreDraftPayload(rawPkg: any): ParsedToeicTestDraft {
  const pkg = adaptToCanonicalPackage(rawPkg);

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
    const mappedGroupKey = q.group_key ? (groupKeyMap.get(q.group_key) || q.group_key) : null;

    return {
      group_temp_key: mappedGroupKey,
      question_number: q.question_number,
      part: q.part,
      question_text: q.question_text || null,
      options: q.options as string[],
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

export async function createCoreDraftFromV2(rawPkg: any): Promise<{
  success: boolean;
  testId?: string;
  error?: string;
}> {
  const pkg = adaptToCanonicalPackage(rawPkg);

  // Check if existing test with same slug is already published -> BLOCK OVERWRITE!
  if (pkg.metadata?.slug) {
    const { data: existing } = await supabase
      .from('toeic_tests')
      .select('id, is_published')
      .eq('slug', pkg.metadata.slug)
      .maybeSingle();

    if (existing && existing.is_published) {
      return {
        success: false,
        error: `Đề thi "${pkg.metadata.title}" đã được xuất bản (Published). Không được phép ghi đè.`,
      };
    }
  }

  const draftPayload = convertV2ToCoreDraftPayload(pkg);
  return importToeicTestDraft(draftPayload);
}
