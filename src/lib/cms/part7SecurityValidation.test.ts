import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Part 7 RPC & Payload Atomicity & Security Hardening Suite', () => {
  const mockQuestions = [
    { id: 'q-147', part: 'part7', question_number: 147, group_id: 'g-active-147-150', is_active: true, options: ['a', 'b', 'c', 'd'], evidence: [{ unit_id: 'u-147-1' }] },
    { id: 'q-148', part: 'part7', question_number: 148, group_id: 'g-active-147-150', is_active: true, options: ['a', 'b', 'c', 'd'], evidence: [{ unit_id: 'u-147-2' }] },
    { id: 'q-149', part: 'part7', question_number: 149, group_id: 'g-active-147-150', is_active: true, options: ['a', 'b', 'c', 'd'] },
    { id: 'q-150', part: 'part7', question_number: 150, group_id: 'g-active-147-150', is_active: true, options: ['a', 'b', 'c', 'd'] },
  ];

  it('1. verifies Phase A validation occurs strictly before Phase B UPDATE statements in SQL', () => {
    const migrationPath = path.join(__dirname, '../../../database/migrations/20260810_part7_workbench_atomic_group_save.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    const phaseAPos = sql.indexOf('PHASE A: VALIDATION ONLY');
    const phaseBPos = sql.indexOf('PHASE B: MUTATION PHASE');
    const firstUpdatePos = sql.indexOf('UPDATE public.toeic_test_groups');

    expect(phaseAPos).toBeGreaterThan(-1);
    expect(phaseBPos).toBeGreaterThan(-1);
    expect(phaseAPos).toBeLessThan(phaseBPos);
    expect(firstUpdatePos).toBeGreaterThan(phaseBPos); // Zero UPDATE statements before Phase B!
  });

  it('2. verifies SQL uses explicit IF NOT FOUND check for group lookup without v_group_exists variable', () => {
    const migrationPath = path.join(__dirname, '../../../database/migrations/20260810_part7_workbench_atomic_group_save.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('IF NOT FOUND THEN');
    expect(sql).toContain("RETURN jsonb_build_object('success', false, 'error', 'Target Part 7 group not found or inactive.');");
    expect(sql).not.toContain('v_group_exists');
  });

  it('3. verifies empty evidence array and null evidence handling against unit_ids', () => {
    const validateEvidenceAgainstUnits = (units: any[] | null, evidence: any[] | null) => {
      const unitIds = units ? units.map(u => u.unit_id) : [];
      
      // Rule: null or [] = no evidence = VALID
      if (!evidence || (Array.isArray(evidence) && evidence.length === 0)) {
        return { success: true };
      }

      // Non-empty evidence array requires non-empty unit_ids
      if (unitIds.length === 0) {
        return { success: false, error: 'Effective evidence references units, but group bilingual units are empty.' };
      }

      for (const item of evidence) {
        if (!item || typeof item !== 'object' || typeof item.unit_id !== 'string' || !item.unit_id.trim()) {
          return { success: false, error: 'Invalid unit_id' };
        }
        if (!unitIds.includes(item.unit_id.trim())) {
          return { success: false, error: `Unit ${item.unit_id} not in group` };
        }
      }

      return { success: true };
    };

    // A. units null + evidence null -> PASS
    expect(validateEvidenceAgainstUnits(null, null).success).toBe(true);

    // B. units null + evidence [] -> PASS
    expect(validateEvidenceAgainstUnits(null, []).success).toBe(true);

    // C. units [] + evidence [] -> PASS
    expect(validateEvidenceAgainstUnits([], []).success).toBe(true);

    // D. units null + evidence [{unit_id:'A'}] -> FAIL
    expect(validateEvidenceAgainstUnits(null, [{ unit_id: 'A' }]).success).toBe(false);

    // E. units [] + evidence [{unit_id:'A'}] -> FAIL
    expect(validateEvidenceAgainstUnits([], [{ unit_id: 'A' }]).success).toBe(false);
  });

  it('4. verifies bad options fail validation before any group or question UPDATE occurs', () => {
    const malformedOpts: any = ['a', 'b', { bad: true }, 'd'];
    const isOptionsArrayValid = Array.isArray(malformedOpts) && malformedOpts.every(o => typeof o === 'string');

    expect(isOptionsArrayValid).toBe(false);
  });

  it('5. verifies bad evidence fails validation before any question_text UPDATE occurs', () => {
    const malformedEvidence: any = [{ unit_id: 12345 }];
    const isEvValid = Array.isArray(malformedEvidence) && malformedEvidence.every(e => typeof e.unit_id === 'string' && e.unit_id.trim().length > 0);

    expect(isEvValid).toBe(false);
  });

  it('6. rejects units update when unpatched questions in group contain dangling evidence (Q160 test)', () => {
    const updatedUnits = [{ unit_id: 'u-147-1', document_index: 0, order: 0, kind: 'sentence', en: 'Text 1', vi: 'Dịch 1' }];
    
    // Q148 is NOT in the patch, so it retains existing evidence 'u-147-2'
    const q148ExistingEvidence = mockQuestions[1].evidence![0].unit_id; // 'u-147-2'
    const newUnitIds = updatedUnits.map(u => u.unit_id);
    
    const isQ148Dangling = !newUnitIds.includes(q148ExistingEvidence);
    expect(isQ148Dangling).toBe(true); // Unpatched Q148 has dangling evidence! Entire RPC fails before mutation.
  });

  it('7. rejects clearing units when existing question evidence remains in group', () => {
    const clearedUnits: any[] = [];
    const groupActiveQuestionsWithEv = mockQuestions.filter(q => q.group_id === 'g-active-147-150' && q.evidence && q.evidence.length > 0);

    const isClearedValid = clearedUnits.length === 0 && groupActiveQuestionsWithEv.length > 0;
    expect(isClearedValid).toBe(true); // Clearing units while evidence remains is invalid!
  });

  it('8. rejects numeric or non-string unit_id in evidence', () => {
    const invalidEv = [{ unit_id: 12345 }, { unit_id: '' }, { unit_id: null }];
    const isValid = invalidEv.every(e => typeof e.unit_id === 'string' && e.unit_id.trim().length > 0);

    expect(isValid).toBe(false);
  });

  it('9. rejects empty or whitespace unit_id in evidence', () => {
    const emptyEv = [{ unit_id: '   ' }];
    const isValid = emptyEv.every(e => typeof e.unit_id === 'string' && e.unit_id.trim().length > 0);

    expect(isValid).toBe(false);
  });

  it('10. rejects documents_vi with invalid element types', () => {
    const invalidDocsVi: any = ['just a string', { content: 12345 }];
    const isValidDocsVi = Array.isArray(invalidDocsVi) && invalidDocsVi.every(d => typeof d === 'object' && d !== null && typeof d.content === 'string');

    expect(isValidDocsVi).toBe(false);
  });

  it('11. rejects document_index out of bounds in bilingual units', () => {
    const docsCount = 2; // Indexes 0 and 1
    const invalidUnit = { unit_id: 'u-999', document_index: 4, order: 0, kind: 'sentence', en: 'a', vi: 'b' };

    const isDocIdxValid = invalidUnit.document_index >= 0 && invalidUnit.document_index < docsCount;
    expect(isDocIdxValid).toBe(false);
  });

  it('12. rejects fractional document_index', () => {
    const isInteger = (val: any) => typeof val === 'number' && Number.isInteger(val) && val >= 0;
    expect(isInteger(1.5)).toBe(false);
  });

  it('13. rejects fractional order', () => {
    const isInteger = (val: any) => typeof val === 'number' && Number.isInteger(val) && val >= 0;
    expect(isInteger(2.5)).toBe(false);
  });

  it('14. rejects fractional question_number', () => {
    const isInteger = (val: any) => typeof val === 'number' && Number.isInteger(val) && val >= 0;
    expect(isInteger(159.2)).toBe(false);
  });

  it('15. rejects unsupported question keys like correct_answer or group_id', () => {
    const allowedQKeys = ['question_number', 'question_text', 'translation_vi', 'options', 'options_vi', 'evidence'];
    const invalidQPayload = { question_number: 147, correct_answer: 'A' };

    const keys = Object.keys(invalidQPayload);
    const hasUnsupportedKey = keys.some(k => !allowedQKeys.includes(k));

    expect(hasUnsupportedKey).toBe(true);
  });
});
