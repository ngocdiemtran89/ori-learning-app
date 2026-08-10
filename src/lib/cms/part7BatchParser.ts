/**
 * Part 7 Multi-Group Batch Parser & Patch Builder
 * Parses unstructured English & Vietnamese multi-group text blocks into canonical Part 7 drafts.
 */

import { buildPart7BilingualUnits, Part7BilingualUnit } from '../toeic/part7BilingualAligner';

export interface Part7DocumentDraft {
  type?: string;
  title?: string;
  content: string;
  title_vi?: string;
  content_vi?: string;
}

export interface Part7QuestionDraft {
  id?: string;
  question_number: number;
  question_text: string;
  translation_vi: string;
  options: [string, string, string, string];
  options_vi: [string, string, string, string];
}

export interface Part7GroupDraft {
  groupId: string;
  expectedQuestionNumbers: number[];
  rangeLabel: string;
  groupType: 'single_passage' | 'double_passage' | 'triple_passage';
  documents: Part7DocumentDraft[];
  documents_vi?: Part7DocumentDraft[];
  questions: Part7QuestionDraft[];
  units: Part7BilingualUnit[];
  isComplete: boolean;
  validationError?: string;
  existingDataWarning?: boolean;
}

export interface Part7ParseResult {
  groups: Part7GroupDraft[];
  warnings: string[];
  rejectedBlocks: string[];
}

/**
 * Normalizes options into 4 clean strings.
 */
function normalize4Options(rawOpts: any): [string, string, string, string] {
  const result: [string, string, string, string] = ['', '', '', ''];
  if (!rawOpts) return result;

  if (Array.isArray(rawOpts)) {
    for (let i = 0; i < Math.min(4, rawOpts.length); i++) {
      const item = rawOpts[i];
      if (typeof item === 'string') result[i] = item.trim();
      else if (item && typeof item === 'object' && typeof item.text === 'string') result[i] = item.text.trim();
    }
    return result;
  }

  if (typeof rawOpts === 'object') {
    const keys = ['A', 'B', 'C', 'D'];
    for (let i = 0; i < 4; i++) {
      const k = keys[i];
      if (k in rawOpts && typeof rawOpts[k] === 'string') {
        result[i] = rawOpts[k].trim();
      }
    }
    return result;
  }

  return result;
}

/**
 * Parses raw text block into question drafts.
 */
function parseQuestionsFromBlock(blockText: string): Part7QuestionDraft[] {
  const questions: Part7QuestionDraft[] = [];

  // Match question numbers like 147. What is the purpose of the email?
  const qRegex = /(?:^|\n)(\d{3})\.\s*([\s\S]*?)(?=(?:\n\d{3}\.|$))/gi;
  let match: RegExpExecArray | null;

  while ((match = qRegex.exec(blockText)) !== null) {
    const qNum = parseInt(match[1], 10);
    if (qNum < 147 || qNum > 200) continue;

    const body = match[2].trim();

    // Extract options (A) ... (B) ... (C) ... (D) ...
    const optRegex = /\(([A-D])\)\s*([\s\S]*?)(?=\([A-D]\)|$)/gi;
    let stem = body;
    const opts: [string, string, string, string] = ['', '', '', ''];

    const optMatches = Array.from(body.matchAll(optRegex));
    if (optMatches.length >= 4) {
      const firstOptIndex = body.indexOf(optMatches[0][0]);
      if (firstOptIndex !== -1) {
        stem = body.substring(0, firstOptIndex).trim();
      }

      for (const m of optMatches) {
        const letter = m[1].toUpperCase();
        const text = m[2].trim();
        const idx = letter === 'A' ? 0 : letter === 'B' ? 1 : letter === 'C' ? 2 : 3;
        opts[idx] = text;
      }
    }

    questions.push({
      question_number: qNum,
      question_text: stem,
      translation_vi: '',
      options: opts,
      options_vi: ['', '', '', ''],
    });
  }

  return questions;
}

/**
 * Extracts documents (passage content) from group block text.
 */
function parseDocumentsFromBlock(blockText: string): Part7DocumentDraft[] {
  // Strip out questions section first
  const firstQIndex = blockText.search(/(?:^|\n)\d{3}\./);
  const docSection = firstQIndex !== -1 ? blockText.substring(0, firstQIndex).trim() : blockText.trim();

  // Strip header line like "QUESTIONS 147-150" or "CÂU 147-150"
  const cleanDocText = docSection.replace(/^(?:QUESTIONS|CÂU|CAU)\s*\d{3}\s*[-–]\s*\d{3}.*$/im, '').trim();

  if (!cleanDocText) return [];

  // Split multi-document sets by [DOCUMENT 1], [EMAIL], [NOTICE], etc.
  const docBlocks = cleanDocText.split(/(?=\[\s*(?:DOCUMENT|DOC|EMAIL|LETTER|NOTICE|ADVERTISEMENT|ARTICLE|WEBPAGE|CHAT|SCHEDULE|FORM)\b)/i).map(b => b.trim()).filter(Boolean);

  const docs: Part7DocumentDraft[] = [];

  for (const b of docBlocks) {
    let type = 'single_passage';
    let title = '';
    let content = b;

    const headerMatch = b.match(/^\[\s*([A-Z0-9_\-\s]+)\s*\](?:\s*([^\n]+))?/i);
    if (headerMatch) {
      type = headerMatch[1].trim().toLowerCase();
      if (headerMatch[2]) {
        title = headerMatch[2].trim();
      }
      content = b.substring(headerMatch[0].length).trim();
    } else {
      // Split title line if present
      const lines = b.split(/\r?\n/);
      if (lines.length > 1 && lines[0].length <= 100 && !lines[0].endsWith('.')) {
        title = lines[0].trim();
        content = lines.slice(1).join('\n').trim();
      }
    }

    docs.push({
      type,
      title,
      content: content || b,
    });
  }

  return docs;
}

/**
 * Main Deterministic Multi-Group Batch Parser for Part 7.
 */
export function parsePart7BatchBlock(
  textEn: string,
  textVi: string,
  existingGroups: any[],
  existingQuestions: any[]
): Part7ParseResult {
  const warnings: string[] = [];
  const rejectedBlocks: string[] = [];
  const groupDrafts: Part7GroupDraft[] = [];

  const part7Groups = (existingGroups || []).filter(g => {
    const isP7 = g.part === 'part7' || (typeof g.part === 'string' && g.part.toLowerCase() === 'part7');
    return isP7 && g.is_active !== false;
  });

  const part7Questions = (existingQuestions || []).filter(q => {
    const isP7 = q.part === 'part7' || (typeof q.part === 'string' && q.part.toLowerCase() === 'part7');
    return isP7 && q.is_active !== false;
  });

  if (part7Groups.length === 0 || part7Questions.length === 0) {
    return {
      groups: [],
      warnings: ['Không tìm thấy cấu trúc Part 7 trong hệ thống.'],
      rejectedBlocks: [],
    };
  }

  // Map questions to groups
  const groupMap = new Map<string, { group: any; questions: any[] }>();
  for (const g of part7Groups) {
    const gQuestions = part7Questions
      .filter(q => q.group_id === g.id)
      .sort((a, b) => a.question_number - b.question_number);
    if (gQuestions.length > 0) {
      groupMap.set(g.id, { group: g, questions: gQuestions });
    }
  }

  // Split textEn into group blocks using header "QUESTIONS X-Y"
  const enBlocks = textEn.split(/(?=(?:^|\n)\s*(?:QUESTIONS|CÂU|CAU)\s*\d{3}\s*[-–]\s*\d{3})/i).map(b => b.trim()).filter(Boolean);
  const viBlocks = (textVi || '').split(/(?=(?:^|\n)\s*(?:QUESTIONS|CÂU|CAU)\s*\d{3}\s*[-–]\s*\d{3})/i).map(b => b.trim()).filter(Boolean);

  for (const enB of enBlocks) {
    const headerMatch = enB.match(/(?:QUESTIONS|CÂU|CAU)\s*(\d{3})\s*[-–]\s*(\d{3})/i);
    if (!headerMatch) {
      // Fallback: search question numbers in block
      const parsedQ = parseQuestionsFromBlock(enB);
      if (parsedQ.length === 0) continue;
      const qStart = parsedQ[0].question_number;
      const qEnd = parsedQ[parsedQ.length - 1].question_number;

      // Find matching DB group containing these question numbers
      const matchedGroupEntry = Array.from(groupMap.values()).find(entry => {
        return entry.questions.some(q => q.question_number >= qStart && q.question_number <= qEnd);
      });

      if (matchedGroupEntry) {
        processGroupDraft(matchedGroupEntry, enB, viBlocks, groupDrafts, warnings, rejectedBlocks);
      }
      continue;
    }

    const startNum = parseInt(headerMatch[1], 10);
    const endNum = parseInt(headerMatch[2], 10);

    const matchedGroupEntry = Array.from(groupMap.values()).find(entry => {
      const qNums = entry.questions.map(q => q.question_number);
      return qNums.includes(startNum) || qNums.includes(endNum);
    });

    if (matchedGroupEntry) {
      processGroupDraft(matchedGroupEntry, enB, viBlocks, groupDrafts, warnings, rejectedBlocks);
    } else {
      rejectedBlocks.push(`Không tìm thấy nhóm DB phù hợp cho Dải Q${startNum}–${endNum}`);
    }
  }

  return {
    groups: groupDrafts,
    warnings,
    rejectedBlocks,
  };
}

function processGroupDraft(
  groupEntry: { group: any; questions: any[] },
  enBlock: string,
  viBlocks: string[],
  groupDrafts: Part7GroupDraft[],
  warnings: string[],
  _rejectedBlocks: string[]
) {
  const { group, questions: dbQuestions } = groupEntry;
  const expectedQNums = dbQuestions.map(q => q.question_number).sort((a, b) => a - b);
  const rangeLabel = `Q${expectedQNums[0]}–${expectedQNums[expectedQNums.length - 1]}`;

  // Find matching VI block
  const viB = viBlocks.find(b => {
    const m = b.match(/(?:QUESTIONS|CÂU|CAU)\s*(\d{3})\s*[-–]\s*(\d{3})/i);
    if (!m) return false;
    const s = parseInt(m[1], 10);
    return expectedQNums.includes(s);
  }) || '';

  const parsedDocsEn = parseDocumentsFromBlock(enBlock);
  const parsedDocsVi = parseDocumentsFromBlock(viB);
  const parsedQEn = parseQuestionsFromBlock(enBlock);
  const parsedQVi = parseQuestionsFromBlock(viB);

  // Build question drafts
  const questionDrafts: Part7QuestionDraft[] = [];

  for (const dbQ of dbQuestions) {
    const qNum = dbQ.question_number;
    const qEn = parsedQEn.find(q => q.question_number === qNum);
    const qVi = parsedQVi.find(q => q.question_number === qNum);

    const normDbEnOpts = normalize4Options(dbQ.options);
    const normDbViOpts = normalize4Options(dbQ.options_vi);

    questionDrafts.push({
      id: dbQ.id,
      question_number: qNum,
      question_text: qEn?.question_text || dbQ.question_text || '',
      translation_vi: qVi?.question_text || dbQ.translation_vi || '',
      options: qEn?.options.some(o => o !== '') ? qEn.options : normDbEnOpts,
      options_vi: qVi?.options.some(o => o !== '') ? qVi.options : normDbViOpts,
    });
  }

  // Check completeness
  const parsedQNums = parsedQEn.map(q => q.question_number).sort((a, b) => a - b);
  const hasAllQuestions = expectedQNums.length === parsedQNums.length && expectedQNums.every((n, i) => n === parsedQNums[i]);

  let isComplete = true;
  let validationError: string | undefined = undefined;

  if (!hasAllQuestions) {
    isComplete = false;
    const missing = expectedQNums.filter(n => !parsedQNums.includes(n));
    validationError = `Nội dung không khớp nhóm ${rangeLabel}. Thiếu Q${missing.join(', Q')}.`;
    warnings.push(`⚠️ ${rangeLabel}: ${validationError}`);
  } else if (parsedDocsEn.length === 0) {
    isComplete = false;
    validationError = `Nội dung ${rangeLabel} thiếu bài đọc (passage/documents).`;
  }

  // Build bilingual units
  const units = buildPart7BilingualUnits(
    parsedDocsEn.map(d => ({ type: d.type, title: d.title, content: d.content })),
    parsedDocsVi.map(d => ({ type: d.type, title: d.title, content: d.content }))
  );

  const groupType: 'single_passage' | 'double_passage' | 'triple_passage' =
    parsedDocsEn.length === 2 ? 'double_passage' : parsedDocsEn.length >= 3 ? 'triple_passage' : 'single_passage';

  groupDrafts.push({
    groupId: group.id,
    expectedQuestionNumbers: expectedQNums,
    rangeLabel,
    groupType,
    documents: parsedDocsEn,
    documents_vi: parsedDocsVi,
    questions: questionDrafts,
    units,
    isComplete,
    validationError,
  });
}

/**
 * Builds true patch payload for a single Part 7 group update RPC.
 */
export function buildPart7GroupPatchPayload(
  dbGroup: any,
  dbQuestions: any[],
  draft: Part7GroupDraft
): { payload: Record<string, any>; hasChanges: boolean } {
  const payload: Record<string, any> = {};
  let hasChanges = false;

  // Documents check
  const dbDocsJson = JSON.stringify(dbGroup?.documents || []);
  const draftDocsJson = JSON.stringify(draft.documents || []);
  if (dbDocsJson !== draftDocsJson) {
    hasChanges = true;
    payload.documents = draft.documents.length > 0 ? draft.documents : null;
  }

  // Documents VI check
  const dbDocsViJson = JSON.stringify(dbGroup?.documents_vi || []);
  const draftDocsViJson = JSON.stringify(draft.documents_vi || []);
  if (dbDocsViJson !== draftDocsViJson) {
    hasChanges = true;
    payload.documents_vi = (draft.documents_vi && draft.documents_vi.length > 0) ? draft.documents_vi : null;
  }

  // Bilingual units check
  const dbUnitsJson = JSON.stringify(dbGroup?.part7_bilingual_units || []);
  const draftUnitsJson = JSON.stringify(draft.units || []);
  if (dbUnitsJson !== draftUnitsJson) {
    hasChanges = true;
    payload.part7_bilingual_units = draft.units.length > 0 ? draft.units : null;
  }

  // Group type check
  if (dbGroup?.group_type !== draft.groupType) {
    hasChanges = true;
    payload.group_type = draft.groupType;
  }

  // Questions check
  const questionPatches: Record<string, any>[] = [];

  for (const qDraft of draft.questions) {
    const dbQ = dbQuestions.find(q => q.question_number === qDraft.question_number);
    const qPatch: Record<string, any> = {
      question_number: qDraft.question_number,
    };
    let qHasChanges = false;

    // Stem check
    const dbStem = (dbQ?.question_text || '').trim();
    const draftStem = (qDraft.question_text || '').trim();
    if (dbStem !== draftStem) {
      qHasChanges = true;
      qPatch.question_text = draftStem !== '' ? draftStem : null;
    }

    // Translation VI check
    const dbTransVi = (dbQ?.translation_vi || '').trim();
    const draftTransVi = (qDraft.translation_vi || '').trim();
    if (dbTransVi !== draftTransVi) {
      qHasChanges = true;
      qPatch.translation_vi = draftTransVi !== '' ? draftTransVi : null;
    }

    // Options EN check
    const normDbOpts = normalize4Options(dbQ?.options);
    const optsChanged = qDraft.options.some((opt, i) => opt !== normDbOpts[i]);
    if (optsChanged) {
      qHasChanges = true;
      qPatch.options = [...qDraft.options];
    }

    // Options VI check
    const normDbOptsVi = normalize4Options(dbQ?.options_vi);
    const optsViChanged = qDraft.options_vi.some((opt, i) => opt !== normDbOptsVi[i]);
    if (optsViChanged) {
      qHasChanges = true;
      qPatch.options_vi = [...qDraft.options_vi];
    }

    if (qHasChanges) {
      hasChanges = true;
      questionPatches.push(qPatch);
    }
  }

  if (questionPatches.length > 0) {
    payload.questions = questionPatches;
  }

  return { payload, hasChanges };
}
