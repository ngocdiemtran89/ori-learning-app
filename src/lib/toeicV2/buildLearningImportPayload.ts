// ============================================================
// ORI TOEIC Website V2 — Build Learning Import Payload
// ============================================================

import { ExtractedLearningData } from './extractLearningUnits';

export function buildLearningImportPayload(
  testId: string,
  extracted: ExtractedLearningData
) {
  const itemsPayload = extracted.items.map((item) => ({
    item_key: item.item_key,
    kind: item.kind,
    title: item.title,
    definition: item.definition || null,
    example: item.example || null,
    difficulty_level: item.difficulty_level || 3,
    is_approved: false, // Default: pending ORI manual review
  }));

  const linksPayload = extracted.links.map((link) => ({
    test_id: testId,
    question_number: link.question_number,
    item_key: link.item_key,
    ai_suggested: link.ai_suggested,
    is_approved: false, // Default: pending ORI manual review
  }));

  return { itemsPayload, linksPayload };
}
