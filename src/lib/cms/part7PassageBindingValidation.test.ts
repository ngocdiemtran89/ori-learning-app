import { describe, it, expect } from 'vitest';
import {
  computePassageFingerprint,
  normalizePassageText,
  extractPassageText,
  parsePart7StructureFromText,
} from './part7StructureParser';
import {
  compareStructureWithDatabase,
  DbGroupInfo,
  DbQuestionInfo,
} from './part7StructureComparison';
import { Part7StructureManifest } from './part7StructureManifest';

describe('Part 7 Passage-Binding Safety & Lock Verification Suite', () => {
  const text1 = "Questions 147-148 refer to the following email.\nTo: All Staff\nFrom: HR\nSubject: Office Policy\n\nPlease find the details regarding the new office policy.\n\n147. What is the main purpose of the email?\n(A) A\n(B) B\n(C) C\n(D) D\n\n148. What is mentioned about the policy?\n(A) A\n(B) B\n(C) C\n(D) D";
  const text2 = "Questions 149-151 refer to the following notice.\nNotice: Parking Regulations\n\nAll123456789012345678901234567890123456789012345678901234567890\n\n149. What is the notice about?\n(A) A\n(B) B\n(C) C\n(D) D\n\n150. Who is affected?\n(A) A\n(B) B\n(C) C\n(D) D\n\n151. When does it start?\n(A) A\n(B) B\n(C) C\n(D) D";

  const cleanPassage1 = "Questions 147-148 refer to the following email.\nTo: All Staff\nFrom: HR\nSubject: Office Policy\n\nPlease find the details regarding the new office policy.";
  const cleanPassage2 = "Questions 149-151 refer to the following notice.\nNotice: Parking Regulations\n\nAll123456789012345678901234567890123456789012345678901234567890";
  const wrongPassage = "Questions 147-148 refer to the following letter.\nDear Customer,\nThank you for choosing our service.";

  const fp1 = computePassageFingerprint(cleanPassage1);
  const fp2 = computePassageFingerprint(cleanPassage2);
  const fpWrong = computePassageFingerprint(wrongPassage);

  const mockDbGroups: DbGroupInfo[] = [
    {
      id: 'g-101',
      part: 'part7',
      sort_order: 1,
      passage: cleanPassage1,
      question_numbers: [147, 148],
      min_qn: 147,
      max_qn: 148,
    },
    {
      id: 'g-102',
      part: 'part7',
      sort_order: 2,
      passage: cleanPassage2,
      question_numbers: [149, 150, 151],
      min_qn: 149,
      max_qn: 151,
    },
  ];

  const mockDbQuestions: DbQuestionInfo[] = [
    { id: 'q-147', question_number: 147, group_id: 'g-101' },
    { id: 'q-148', question_number: 148, group_id: 'g-101' },
    { id: 'q-149', question_number: 149, group_id: 'g-102' },
    { id: 'q-150', question_number: 150, group_id: 'g-102' },
    { id: 'q-151', question_number: 151, group_id: 'g-102' },
  ];

  it('1. same question ranges + wrong passage -> repair blocked', () => {
    const wrongManifest: Part7StructureManifest = {
      version: 1,
      part: 'part7',
      startQuestion: 147,
      endQuestion: 200,
      questionCount: 54,
      groupCount: 2,
      structureHash: '',
      groups: [
        {
          order: 1,
          startQuestion: 147,
          endQuestion: 148,
          questionNumbers: [147, 148],
          sourceHeader: 'Questions 147-148',
          passageText: wrongPassage,
          passageFingerprint: fpWrong,
        },
        {
          order: 2,
          startQuestion: 149,
          endQuestion: 151,
          questionNumbers: [149, 150, 151],
          sourceHeader: 'Questions 149-151',
          passageText: cleanPassage2,
          passageFingerprint: fp2,
        },
      ],
    };

    const plan = compareStructureWithDatabase(wrongManifest, mockDbGroups, mockDbQuestions, false);
    expect(plan.isApplyAllowed).toBe(false);
    expect(plan.blockReason).toContain('passage mismatch');
    expect(plan.groupComparisons[0].passageStatus).toBe('PASSAGE_NOT_FOUND');
  });

  it('2. unique passage fingerprint -> correct targetGroupId', () => {
    const validManifest: Part7StructureManifest = {
      version: 1,
      part: 'part7',
      startQuestion: 147,
      endQuestion: 200,
      questionCount: 54,
      groupCount: 2,
      structureHash: '',
      groups: [
        {
          order: 1,
          startQuestion: 147,
          endQuestion: 148,
          questionNumbers: [147, 148],
          sourceHeader: 'Questions 147-148',
          passageText: cleanPassage1,
          passageFingerprint: fp1,
        },
        {
          order: 2,
          startQuestion: 149,
          endQuestion: 151,
          questionNumbers: [149, 150, 151],
          sourceHeader: 'Questions 149-151',
          passageText: cleanPassage2,
          passageFingerprint: fp2,
        },
      ],
    };

    const plan = compareStructureWithDatabase(validManifest, mockDbGroups, mockDbQuestions, false);
    expect(plan.groupComparisons[0].targetGroupId).toBe('g-101');
    expect(plan.groupComparisons[1].targetGroupId).toBe('g-102');
  });

  it('3. zero passage matches -> no auto-binding', () => {
    const unknownPassage = "Unknown passage that does not exist in DB";
    const manifest: Part7StructureManifest = {
      version: 1,
      part: 'part7',
      startQuestion: 147,
      endQuestion: 200,
      questionCount: 54,
      groupCount: 1,
      structureHash: '',
      groups: [
        {
          order: 1,
          startQuestion: 147,
          endQuestion: 148,
          questionNumbers: [147, 148],
          sourceHeader: 'Questions 147-148',
          passageText: unknownPassage,
          passageFingerprint: computePassageFingerprint(unknownPassage),
        },
      ],
    };

    const plan = compareStructureWithDatabase(manifest, mockDbGroups, mockDbQuestions, false);
    expect(plan.groupComparisons[0].targetGroupId).toBeUndefined();
    expect(plan.groupComparisons[0].passageStatus).toBe('PASSAGE_NOT_FOUND');
    expect(plan.isApplyAllowed).toBe(false);
  });

  it('4. duplicate passage matches -> 0 auto-binding (ambiguous)', () => {
    const duplicateDbGroups: DbGroupInfo[] = [
      { id: 'g-101', part: 'part7', sort_order: 1, passage: cleanPassage1, question_numbers: [147, 148], min_qn: 147, max_qn: 148 },
      { id: 'g-102', part: 'part7', sort_order: 2, passage: cleanPassage1, question_numbers: [149, 150], min_qn: 149, max_qn: 150 },
    ];

    const manifest: Part7StructureManifest = {
      version: 1,
      part: 'part7',
      startQuestion: 147,
      endQuestion: 200,
      questionCount: 54,
      groupCount: 1,
      structureHash: '',
      groups: [
        {
          order: 1,
          startQuestion: 147,
          endQuestion: 148,
          questionNumbers: [147, 148],
          sourceHeader: 'Questions 147-148',
          passageText: cleanPassage1,
          passageFingerprint: fp1,
        },
      ],
    };

    const plan = compareStructureWithDatabase(manifest, duplicateDbGroups, mockDbQuestions, false);
    expect(plan.groupComparisons[0].targetGroupId).toBeUndefined();
    expect(plan.groupComparisons[0].passageStatus).toBe('PASSAGE_AMBIGUOUS');
    expect(plan.isApplyAllowed).toBe(false);
  });

  it('5. order mismatch but passage match -> bind by passage, not index', () => {
    const reversedManifest: Part7StructureManifest = {
      version: 1,
      part: 'part7',
      startQuestion: 147,
      endQuestion: 200,
      questionCount: 54,
      groupCount: 2,
      structureHash: '',
      groups: [
        {
          order: 1,
          startQuestion: 147,
          endQuestion: 149,
          questionNumbers: [147, 148, 149],
          sourceHeader: 'Questions 147-149',
          passageText: cleanPassage2,
          passageFingerprint: fp2,
        },
        {
          order: 2,
          startQuestion: 150,
          endQuestion: 151,
          questionNumbers: [150, 151],
          sourceHeader: 'Questions 150-151',
          passageText: cleanPassage1,
          passageFingerprint: fp1,
        },
      ],
    };

    const plan = compareStructureWithDatabase(reversedManifest, mockDbGroups, mockDbQuestions, false);
    expect(plan.groupComparisons[0].targetGroupId).toBe('g-102');
    expect(plan.groupComparisons[1].targetGroupId).toBe('g-101');
    expect(plan.groupComparisons[0].passageStatus).toBe('PASSAGE_MATCH');
    expect(plan.groupComparisons[1].passageStatus).toBe('PASSAGE_MATCH');
  });

  it('6. index match but passage mismatch -> do NOT bind by index', () => {
    const mismatchManifest: Part7StructureManifest = {
      version: 1,
      part: 'part7',
      startQuestion: 147,
      endQuestion: 200,
      questionCount: 54,
      groupCount: 2,
      structureHash: '',
      groups: [
        {
          order: 1,
          startQuestion: 147,
          endQuestion: 148,
          questionNumbers: [147, 148],
          sourceHeader: 'Questions 147-148',
          passageText: "Other text",
          passageFingerprint: computePassageFingerprint("Other text"),
        },
        {
          order: 2,
          startQuestion: 149,
          endQuestion: 151,
          questionNumbers: [149, 150, 151],
          sourceHeader: 'Questions 149-151',
          passageText: cleanPassage2,
          passageFingerprint: fp2,
        },
      ],
    };

    const plan = compareStructureWithDatabase(mismatchManifest, mockDbGroups, mockDbQuestions, false);
    expect(plan.groupComparisons[0].targetGroupId).toBeUndefined();
    expect(plan.groupComparisons[0].passageStatus).toBe('PASSAGE_NOT_FOUND');
    expect(plan.isApplyAllowed).toBe(false);
  });

  it('7. extractPassageText correctly handles string and document array', () => {
    const fromString = extractPassageText("  Header Text  ");
    expect(fromString).toBe("Header Text");

    const fromDocs = extractPassageText(null, [{ title: "Email Title", content: "Email Content" }]);
    expect(fromDocs).toBe("Email Title\n\nEmail Content");

    const empty = extractPassageText("", []);
    expect(empty).toBe("");
  });

  it('8. normalizePassageText produces consistent clean text', () => {
    const messy = "  Line1 \r\n\r\n\r\n Line2  \t  Line3  ";
    const clean = normalizePassageText(messy);
    expect(clean).toBe("Line1\n\nLine2 Line3");
  });

  it('9. computePassageFingerprint returns 32-character hex string', () => {
    const fp = computePassageFingerprint("Test Passage Content");
    expect(fp).toHaveLength(32);
    expect(fp).toMatch(/^[0-9a-f]{32}$/);
  });

  it('10. missing passageFingerprint makes group not lock-ready', () => {
    const noFpManifest: Part7StructureManifest = {
      version: 1,
      part: 'part7',
      startQuestion: 147,
      endQuestion: 200,
      questionCount: 54,
      groupCount: 1,
      structureHash: '',
      groups: [
        {
          order: 1,
          startQuestion: 147,
          endQuestion: 148,
          questionNumbers: [147, 148],
          sourceHeader: 'Questions 147-148',
          passageText: '',
          passageFingerprint: '',
        },
      ],
    };

    const plan = compareStructureWithDatabase(noFpManifest, mockDbGroups, mockDbQuestions, false);
    expect(plan.isApplyAllowed).toBe(false);
  });

  it('11. parsePart7StructureFromText generates passageFingerprint for each group', () => {
    const parsed = parsePart7StructureFromText(text1 + "\n\n" + text2);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].passageFingerprint).toBeTruthy();
    expect(parsed[0].passageFingerprint).toHaveLength(32);
    expect(parsed[1].passageFingerprint).toBeTruthy();
    expect(parsed[1].passageFingerprint).toHaveLength(32);
  });

  it('12. manual binding with matching passage results in PASSAGE_MATCH', () => {
    const manualManifest: Part7StructureManifest = {
      version: 1,
      part: 'part7',
      startQuestion: 147,
      endQuestion: 200,
      questionCount: 54,
      groupCount: 1,
      structureHash: '',
      groups: [
        {
          order: 1,
          startQuestion: 147,
          endQuestion: 148,
          questionNumbers: [147, 148],
          sourceHeader: 'Questions 147-148',
          passageText: cleanPassage1,
          passageFingerprint: fp1,
          targetGroupId: 'g-101',
        },
      ],
    };

    const plan = compareStructureWithDatabase(manualManifest, mockDbGroups, mockDbQuestions, false);
    expect(plan.groupComparisons[0].passageStatus).toBe('PASSAGE_MATCH');
    expect(plan.groupComparisons[0].targetGroupId).toBe('g-101');
  });

  it('13. manual binding with Mismatched passage results in PASSAGE_DIFFERENT and blocks apply', () => {
    const manualMismatchedManifest: Part7StructureManifest = {
      version: 1,
      part: 'part7',
      startQuestion: 147,
      endQuestion: 200,
      questionCount: 54,
      groupCount: 1,
      structureHash: '',
      groups: [
        {
          order: 1,
          startQuestion: 147,
          endQuestion: 148,
          questionNumbers: [147, 148],
          sourceHeader: 'Questions 147-148',
          passageText: 'Random Different Text',
          passageFingerprint: computePassageFingerprint('Random Different Text'),
          targetGroupId: 'g-101', // g-101 has cleanPassage1
        },
      ],
    };

    const plan = compareStructureWithDatabase(manualMismatchedManifest, mockDbGroups, mockDbQuestions, false);
    expect(plan.groupComparisons[0].passageStatus).toBe('PASSAGE_DIFFERENT');
    expect(plan.groupComparisons[0].status).toBe('PASSAGE_MISMATCH');
    expect(plan.isApplyAllowed).toBe(false);
  });

  it('14. complete 54-question match with all matching passages allows lock', () => {
    const fullSourceGroups = [
      createGroup(1, 147, 148, 'g-1'),
      createGroup(2, 149, 151, 'g-2'),
      createGroup(3, 152, 154, 'g-3'),
      createGroup(4, 155, 157, 'g-4'),
      createGroup(5, 158, 160, 'g-5'),
      createGroup(6, 161, 164, 'g-6'),
      createGroup(7, 165, 168, 'g-7'),
      createGroup(8, 169, 172, 'g-8'),
      createGroup(9, 173, 175, 'g-9'),
      createGroup(10, 176, 180, 'g-10'),
      createGroup(11, 181, 185, 'g-11'),
      createGroup(12, 186, 190, 'g-12'),
      createGroup(13, 191, 195, 'g-13'),
      createGroup(14, 196, 200, 'g-14'),
    ];

    const fullDbGroups: DbGroupInfo[] = fullSourceGroups.map((g) => ({
      id: g.targetGroupId!,
      part: 'part7',
      sort_order: g.order,
      passage: `Passage ${g.order}`,
      question_numbers: g.questionNumbers,
      min_qn: g.startQuestion,
      max_qn: g.endQuestion,
    }));

    const fullDbQuestions: DbQuestionInfo[] = [];
    fullSourceGroups.forEach((g) => {
      g.questionNumbers.forEach((qn) => {
        fullDbQuestions.push({
          id: `q-${qn}`,
          question_number: qn,
          group_id: g.targetGroupId!,
        });
      });
    });

    const fullManifest: Part7StructureManifest = {
      version: 1,
      part: 'part7',
      startQuestion: 147,
      endQuestion: 200,
      questionCount: 54,
      groupCount: 14,
      structureHash: '',
      groups: fullSourceGroups,
    };

    const plan = compareStructureWithDatabase(fullManifest, fullDbGroups, fullDbQuestions, false);
    expect(plan.isApplyAllowed).toBe(true);
    expect(plan.totalMovedQuestions).toBe(0);
    expect(plan.groupComparisons).toHaveLength(14);
    expect(plan.groupComparisons.every((c) => c.passageStatus === 'PASSAGE_MATCH')).toBe(true);
  });

  it('15. extractPassageText handles document with body property', () => {
    const docText = extractPassageText(null, [{ title: "Memo", body: "Important memo content" }]);
    expect(docText).toBe("Memo\n\nImportant memo content");
  });

  it('16. extractPassageText handles document with text property', () => {
    const docText = extractPassageText(null, [{ text: "Direct text content" }]);
    expect(docText).toBe("Direct text content");
  });

  it('17. extractPassageText prioritizes passage over documents when passage exists', () => {
    const docText = extractPassageText("Main Passage", [{ title: "Secondary Doc" }]);
    expect(docText).toBe("Main Passage");
  });

  it('18. normalizePassageText handles Windows CRLF carriage returns correctly', () => {
    const norm = normalizePassageText("Line1\r\nLine2\r\nLine3");
    expect(norm).toBe("Line1\nLine2\nLine3");
  });

  it('19. normalizePassageText collapses 4 newlines down to 2 newlines', () => {
    const norm = normalizePassageText("Paragraph 1\n\n\n\nParagraph 2");
    expect(norm).toBe("Paragraph 1\n\nParagraph 2");
  });

  it('20. computePassageFingerprint produces identical MD5 for CRLF vs LF', () => {
    const fpLF = computePassageFingerprint("Hello World\nLine 2");
    const fpCRLF = computePassageFingerprint("Hello World\r\nLine 2");
    expect(fpLF).toBe(fpCRLF);
  });

  it('21. computePassageFingerprint produces identical MD5 despite extra spaces', () => {
    const fp1 = computePassageFingerprint("Hello   World  \nLine 2 ");
    const fp2 = computePassageFingerprint("Hello World\nLine 2");
    expect(fp1).toBe(fp2);
  });

  it('22. compareStructureWithDatabase blocks apply when test is published', () => {
    const fullSourceGroups = [createGroup(1, 147, 148, 'g-1')];
    const fullDbGroups: DbGroupInfo[] = [{ id: 'g-1', part: 'part7', sort_order: 1, passage: 'Passage 1', question_numbers: [147, 148], min_qn: 147, max_qn: 148 }];
    const fullDbQuestions: DbQuestionInfo[] = [{ id: 'q-147', question_number: 147, group_id: 'g-1' }, { id: 'q-148', question_number: 148, group_id: 'g-1' }];
    const fullManifest: Part7StructureManifest = {
      version: 1,
      part: 'part7',
      startQuestion: 147,
      endQuestion: 200,
      questionCount: 54,
      groupCount: 1,
      structureHash: '',
      groups: fullSourceGroups,
    };

    const plan = compareStructureWithDatabase(fullManifest, fullDbGroups, fullDbQuestions, true);
    expect(plan.isApplyAllowed).toBe(false);
    expect(plan.blockReason).toContain('PUBLISHED');
  });

  it('23. compareStructureWithDatabase blocks apply when group has bilingual units', () => {
    const fullSourceGroups = [createGroup(1, 147, 148, 'g-1')];
    const fullDbGroups: DbGroupInfo[] = [{ id: 'g-1', part: 'part7', sort_order: 1, passage: 'Passage 1', question_numbers: [147, 148], min_qn: 147, max_qn: 148, has_bilingual_units: true }];
    const fullDbQuestions: DbQuestionInfo[] = [{ id: 'q-147', question_number: 147, group_id: 'g-1' }, { id: 'q-148', question_number: 148, group_id: 'g-1' }];
    const fullManifest: Part7StructureManifest = {
      version: 1,
      part: 'part7',
      startQuestion: 147,
      endQuestion: 200,
      questionCount: 54,
      groupCount: 1,
      structureHash: '',
      groups: fullSourceGroups,
    };

    const plan = compareStructureWithDatabase(fullManifest, fullDbGroups, fullDbQuestions, false);
    expect(plan.isApplyAllowed).toBe(false);
    expect(plan.blockReason).toContain('bilingual units');
  });

  it('24. compareStructureWithDatabase blocks apply when group has evidence metadata', () => {
    const fullSourceGroups = [createGroup(1, 147, 148, 'g-1')];
    const fullDbGroups: DbGroupInfo[] = [{ id: 'g-1', part: 'part7', sort_order: 1, passage: 'Passage 1', question_numbers: [147, 148], min_qn: 147, max_qn: 148, has_evidence: true }];
    const fullDbQuestions: DbQuestionInfo[] = [{ id: 'q-147', question_number: 147, group_id: 'g-1' }, { id: 'q-148', question_number: 148, group_id: 'g-1' }];
    const fullManifest: Part7StructureManifest = {
      version: 1,
      part: 'part7',
      startQuestion: 147,
      endQuestion: 200,
      questionCount: 54,
      groupCount: 1,
      structureHash: '',
      groups: fullSourceGroups,
    };

    const plan = compareStructureWithDatabase(fullManifest, fullDbGroups, fullDbQuestions, false);
    expect(plan.isApplyAllowed).toBe(false);
    expect(plan.blockReason).toContain('evidence metadata');
  });

  it('25. compareStructureWithDatabase detects duplicate targetGroupId assignments and blocks apply', () => {
    const fullSourceGroups = [
      createGroup(1, 147, 148, 'g-1'),
      createGroup(2, 149, 151, 'g-1'),
    ];
    const fullDbGroups: DbGroupInfo[] = [{ id: 'g-1', part: 'part7', sort_order: 1, passage: 'Passage 1', question_numbers: [147, 148], min_qn: 147, max_qn: 148 }];
    const fullDbQuestions: DbQuestionInfo[] = [{ id: 'q-147', question_number: 147, group_id: 'g-1' }, { id: 'q-148', question_number: 148, group_id: 'g-1' }];
    const fullManifest: Part7StructureManifest = {
      version: 1,
      part: 'part7',
      startQuestion: 147,
      endQuestion: 200,
      questionCount: 54,
      groupCount: 2,
      structureHash: '',
      groups: fullSourceGroups,
    };

    const plan = compareStructureWithDatabase(fullManifest, fullDbGroups, fullDbQuestions, false);
    expect(plan.isApplyAllowed).toBe(false);
  });

  it('26. extractPassageText returns empty when documents array is empty', () => {
    expect(extractPassageText(null, [])).toBe('');
  });

  it('27. extractPassageText returns empty when passage is empty whitespace', () => {
    expect(extractPassageText('   ')).toBe('');
  });

  it('28. normalizePassageText handles empty string', () => {
    expect(normalizePassageText('')).toBe('');
  });

  it('29. computePassageFingerprint returns empty string for empty input', () => {
    expect(computePassageFingerprint('')).toBe('');
  });

  it('30. MD5 calculation is deterministic across multiple calls', () => {
    const str = "Deterministic test string for MD5 calculation parity";
    const res1 = computePassageFingerprint(str);
    const res2 = computePassageFingerprint(str);
    expect(res1).toBe(res2);
  });

  it('31. computePassageFingerprint handles unicode characters in passage', () => {
    const str = "Chào bạn! Đây là bài đọc TOEIC Part 7 Tiếng Việt & English.";
    const fp = computePassageFingerprint(str);
    expect(fp).toHaveLength(32);
  });

  it('32. extractPassageText handles document objects with only title', () => {
    const res = extractPassageText(null, [{ title: "Only Title" }]);
    expect(res).toBe("Only Title");
  });

  it('33. extractPassageText handles document objects with title and body', () => {
    const res = extractPassageText(null, [{ title: "Title", body: "Body content" }]);
    expect(res).toBe("Title\n\nBody content");
  });

  it('34. compareStructureWithDatabase sets groupComparisons status to MATCH when ranges and passages match', () => {
    const sourceGroups = [createGroup(1, 147, 148, 'g-1')];
    const dbGroups: DbGroupInfo[] = [{ id: 'g-1', part: 'part7', sort_order: 1, passage: 'Passage 1', question_numbers: [147, 148], min_qn: 147, max_qn: 148 }];
    const dbQuestions: DbQuestionInfo[] = [
      { id: 'q-147', question_number: 147, group_id: 'g-1' },
      { id: 'q-148', question_number: 148, group_id: 'g-1' },
    ];
    const manifest: Part7StructureManifest = {
      version: 1,
      part: 'part7',
      startQuestion: 147,
      endQuestion: 200,
      questionCount: 54,
      groupCount: 1,
      structureHash: '',
      groups: sourceGroups,
    };
    const plan = compareStructureWithDatabase(manifest, dbGroups, dbQuestions, false);
    expect(plan.groupComparisons[0].status).toBe('MATCH');
  });

  it('35. compareStructureWithDatabase detects RANGE_MISMATCH when min/max qn differ from source', () => {
    const sourceGroups = [createGroup(1, 147, 148, 'g-1')];
    const dbGroups: DbGroupInfo[] = [{ id: 'g-1', part: 'part7', sort_order: 1, passage: 'Passage 1', question_numbers: [147, 148, 149], min_qn: 147, max_qn: 149 }];
    const dbQuestions: DbQuestionInfo[] = [
      { id: 'q-147', question_number: 147, group_id: 'g-1' },
      { id: 'q-148', question_number: 148, group_id: 'g-1' },
    ];
    const manifest: Part7StructureManifest = {
      version: 1,
      part: 'part7',
      startQuestion: 147,
      endQuestion: 200,
      questionCount: 54,
      groupCount: 1,
      structureHash: '',
      groups: sourceGroups,
    };
    const plan = compareStructureWithDatabase(manifest, dbGroups, dbQuestions, false);
    expect(plan.groupComparisons[0].status).toBe('RANGE_MISMATCH');
  });

  it('36. compareStructureWithDatabase detects MEMBERSHIP_MISMATCH when questions move', () => {
    const sourceGroups = [createGroup(1, 147, 148, 'g-1')];
    const dbGroups: DbGroupInfo[] = [{ id: 'g-1', part: 'part7', sort_order: 1, passage: 'Passage 1', question_numbers: [147, 148], min_qn: 147, max_qn: 148 }];
    const dbQuestions: DbQuestionInfo[] = [
      { id: 'q-147', question_number: 147, group_id: 'g-1' },
      { id: 'q-148', question_number: 148, group_id: 'g-2' }, // Q148 is in g-2 currently!
    ];
    const manifest: Part7StructureManifest = {
      version: 1,
      part: 'part7',
      startQuestion: 147,
      endQuestion: 200,
      questionCount: 54,
      groupCount: 1,
      structureHash: '',
      groups: sourceGroups,
    };
    const plan = compareStructureWithDatabase(manifest, dbGroups, dbQuestions, false);
    expect(plan.groupComparisons[0].status).toBe('MEMBERSHIP_MISMATCH');
    expect(plan.totalMovedQuestions).toBe(1);
  });

  it('37. compareStructureWithDatabase sets blockReason when dbGroupCount does not match sourceGroupCount', () => {
    const sourceGroups = [createGroup(1, 147, 148, 'g-1'), createGroup(2, 149, 151, 'g-2')];
    const dbGroups: DbGroupInfo[] = [{ id: 'g-1', part: 'part7', sort_order: 1, passage: 'Passage 1', question_numbers: [147, 148], min_qn: 147, max_qn: 148 }];
    const dbQuestions: DbQuestionInfo[] = [{ id: 'q-147', question_number: 147, group_id: 'g-1' }];
    const manifest: Part7StructureManifest = {
      version: 1,
      part: 'part7',
      startQuestion: 147,
      endQuestion: 200,
      questionCount: 54,
      groupCount: 2,
      structureHash: '',
      groups: sourceGroups,
    };
    const plan = compareStructureWithDatabase(manifest, dbGroups, dbQuestions, false);
    expect(plan.isApplyAllowed).toBe(false);
    expect(plan.blockReason).toContain('Direct repair disabled');
  });

  it('38. extractPassageText handles document with content property', () => {
    const docText = extractPassageText(null, [{ title: "Notice", content: "Notice content body" }]);
    expect(docText).toBe("Notice\n\nNotice content body");
  });

  it('39. parsePart7StructureFromText correctly parses single group text', () => {
    const singleGroupText = "Questions 147-148 refer to the following email.\nTo: Staff\nFrom: HR\n\nEmail body text.\n\n147. Q1?\n(A) A\n(B) B\n(C) C\n(D) D\n\n148. Q2?\n(A) A\n(B) B\n(C) C\n(D) D";
    const parsed = parsePart7StructureFromText(singleGroupText);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].startQuestion).toBe(147);
    expect(parsed[0].endQuestion).toBe(148);
  });

  it('40. parsePart7StructureFromText parses multiple groups in sequence', () => {
    const multiGroupText = text1 + "\n\n" + text2;
    const parsed = parsePart7StructureFromText(multiGroupText);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].startQuestion).toBe(147);
    expect(parsed[0].endQuestion).toBe(148);
    expect(parsed[1].startQuestion).toBe(149);
    expect(parsed[1].endQuestion).toBe(151);
  });
});

function createGroup(order: number, startQ: number, endQ: number, targetId: string) {
  const qNums = [];
  for (let q = startQ; q <= endQ; q++) qNums.push(q);
  const passage = `Passage ${order}`;
  return {
    order,
    startQuestion: startQ,
    endQuestion: endQ,
    questionNumbers: qNums,
    sourceHeader: `Questions ${startQ}-${endQ}`,
    passageText: passage,
    passageFingerprint: computePassageFingerprint(passage),
    targetGroupId: targetId,
  };
}
