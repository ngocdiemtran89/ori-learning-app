// ============================================================
// ORI TOEIC Website V2 — Extract Learning Units Helper
// ============================================================

import { OriToeicV2Package, V2LearningUnit } from './types';
import { classifySinglePart5Question } from './part5Classifier';
import { classifySinglePart2Question } from './part2Classifier';

export interface ExtractedQuestionLearningLink {
  question_number: number;
  item_key: string;
  kind: string;
  ai_suggested: boolean;
}

export interface ExtractedLearningData {
  items: V2LearningUnit[];
  links: ExtractedQuestionLearningLink[];
}

export function extractLearningUnitsFromV2Package(pkg: OriToeicV2Package): ExtractedLearningData {
  const itemsMap = new Map<string, V2LearningUnit>();
  const links: ExtractedQuestionLearningLink[] = [];

  // Pass 1: Top-level explicit learning_units
  if (Array.isArray(pkg.learning_units)) {
    pkg.learning_units.forEach((unit) => {
      if (unit.item_key && unit.title) {
        itemsMap.set(unit.item_key, {
          kind: unit.kind || 'vocabulary',
          item_key: unit.item_key,
          title: unit.title,
          definition: unit.definition || '',
          example: unit.example || '',
          difficulty_level: unit.difficulty_level || 3,
          ai_suggested: unit.ai_suggested ?? true,
        });
      }
    });
  }

  // Pass 2: Question-level explicit learning_units
  if (Array.isArray(pkg.questions)) {
    pkg.questions.forEach((q) => {
      if (Array.isArray(q.learning_units) && q.learning_units.length > 0) {
        q.learning_units.forEach((unit) => {
          if (unit.item_key && unit.title) {
            if (!itemsMap.has(unit.item_key)) {
              itemsMap.set(unit.item_key, {
                kind: unit.kind || 'vocabulary',
                item_key: unit.item_key,
                title: unit.title,
                definition: unit.definition || '',
                example: unit.example || '',
                difficulty_level: unit.difficulty_level || 3,
                ai_suggested: unit.ai_suggested ?? true,
              });
            }

            links.push({
              question_number: q.question_number,
              item_key: unit.item_key,
              kind: unit.kind || 'vocabulary',
              ai_suggested: unit.ai_suggested ?? true,
            });
          }
        });
      }
    });

    // Pass 3: Automatic Part 2 and Part 5 Classifier Fallbacks (only for questions without explicit units)
    pkg.questions.forEach((q) => {
      const hasExplicitUnits = Array.isArray(q.learning_units) && q.learning_units.length > 0;
      if (hasExplicitUnits) return;

      if ((q.part as string) === 'P2' || (q.part as string) === 'part2' || (q.question_number >= 7 && q.question_number <= 31)) {
        // Automatic Part 2 Classifier fallback
        const classified = classifySinglePart2Question({
          question_number: q.question_number,
          part: 'part2',
          transcript: q.question_text || q.explanation || '',
          correct_answer: (q.correct_answer as any) || null,
          explanation: q.explanation,
        });

        // Register Question Type Item
        if (!itemsMap.has(classified.question_type_item_key)) {
          itemsMap.set(classified.question_type_item_key, {
            kind: 'grammar',
            item_key: classified.question_type_item_key,
            title: classified.question_type_label_vi,
            definition: classified.reasoning || '',
            example: q.question_text || '',
            difficulty_level: 3,
            ai_suggested: true,
          });
        }
        links.push({
          question_number: q.question_number,
          item_key: classified.question_type_item_key,
          kind: 'grammar',
          ai_suggested: true,
        });

        // Register Topic Item
        if (classified.primary_topic_item_key && !itemsMap.has(classified.primary_topic_item_key)) {
          itemsMap.set(classified.primary_topic_item_key, {
            kind: 'vocabulary',
            item_key: classified.primary_topic_item_key,
            title: classified.primary_topic_label_vi,
            definition: classified.reasoning || '',
            example: q.question_text || '',
            difficulty_level: 3,
            ai_suggested: true,
          });
        }
        if (classified.primary_topic_item_key) {
          links.push({
            question_number: q.question_number,
            item_key: classified.primary_topic_item_key,
            kind: 'vocabulary',
            ai_suggested: true,
          });
        }
      } else if ((q.part as string) === 'P5' || (q.part as string) === 'part5' || (q.question_number >= 101 && q.question_number <= 130)) {
        // Automatic Part 5 Classifier fallback
        const classified = classifySinglePart5Question({
          question_number: q.question_number,
          part: 'part5',
          question_text: q.question_text,
          options: q.options,
          correct_answer: q.correct_answer,
          explanation: q.explanation,
          translation_vi: q.translation_vi,
        });

        if (!itemsMap.has(classified.item_key)) {
          itemsMap.set(classified.item_key, {
            kind: classified.kind,
            item_key: classified.item_key,
            title: classified.title,
            definition: classified.reasoning || '',
            example: q.question_text || '',
            difficulty_level: 3,
            ai_suggested: true,
          });
        }

        links.push({
          question_number: q.question_number,
          item_key: classified.item_key,
          kind: classified.kind,
          ai_suggested: true,
        });
      }
    });
  }

  return {
    items: Array.from(itemsMap.values()),
    links,
  };
}
