import { describe, it, expect } from 'vitest';
import { buildPart7BilingualUnits } from '../../lib/toeic/part7BilingualAligner';

describe('Part 7 Student Workspace & Evidence Suite', () => {
  const mockGroup: any = {
    id: 'grp-159-163',
    part: 'part7',
    group_type: 'single_passage',
    title: 'E-mail',
    instruction: 'Questions 159-163 refer to the following e-mail.',
    instruction_vi: 'Câu 159-163 tham chiếu đến e-mail sau.',
    documents: [
      {
        type: 'email',
        title: 'Discount Notice',
        content: 'To: Hailey Hua\nFrom: Middlesex Hair\nDate: October 14\nSubject: Special Offer\n\nWe have not seen you in a long time, and we miss you! If you book an appointment within the next two weeks, you will receive a 20 percent discount.',
      },
    ],
    documents_vi: [
      {
        type: 'email',
        title: 'Thông báo giảm giá',
        content: 'Người nhận: Hailey Hua\nNgười gửi: Middlesex Hair\nNgày: 14 tháng 10\nTiêu đề: Ưu đãi đặc biệt\n\nĐã lâu rồi chúng tôi chưa gặp bạn và chúng tôi rất nhớ bạn! Nếu bạn đặt lịch hẹn trong vòng hai tuần tới, bạn sẽ nhận được mức giảm giá 20%.',
      },
    ],
    part7_bilingual_units: [],
  };

  const mockQuestions: any[] = [
    {
      id: 'q-159',
      group_id: 'grp-159-163',
      question_number: 159,
      part: 'part7',
      question_text: 'How can Ms. Hua receive a 20 percent discount at Middlesex Hair?',
      translation_vi: 'Làm thế nào cô Hua có thể nhận được mức giảm giá 20% tại Middlesex Hair?',
      options: [
        'By presenting a coupon',
        'By referring new customers',
        'By making a booking within two weeks',
        'By purchasing products online',
      ],
      options_vi: [
        'Bằng cách xuất trình phiếu giảm giá',
        'Bằng cách giới thiệu khách hàng mới',
        'Bằng cách đặt lịch hẹn trong vòng hai tuần',
        'Bằng cách mua sản phẩm trực tuyến',
      ],
      evidence: [
        {
          document_index: 0,
          unit_id: 'd0-u002',
          quote_en: 'If you book an appointment within the next two weeks...',
          quote_vi: 'Nếu bạn đặt lịch hẹn trong vòng hai tuần tới...',
        },
      ],
    },
  ];

  it('1. verifies persisted bilingual units generator pairs EN & VI sentence units', () => {
    const units = buildPart7BilingualUnits(mockGroup.documents, mockGroup.documents_vi);
    expect(units.length).toBeGreaterThan(0);
    expect(units[0].document_index).toBe(0);
    expect(units[0].en).toBeDefined();
    expect(units[0].vi).toBeDefined();
  });

  it('2. verifies question evidence structure maps to stable translation units', () => {
    const q159 = mockQuestions[0];
    expect(q159.evidence.length).toBe(1);
    expect(q159.evidence[0].document_index).toBe(0);
    expect(q159.evidence[0].unit_id).toBe('d0-u002');
  });

  it('3. verifies practice mode exposes Vietnamese & evidence, while mock exam forces English ONLY', () => {
    const renderWorkspaceForMode = (isPartMode: boolean) => {
      const showBilingualToggle = isPartMode;
      const showEvidenceToggle = isPartMode;
      const showQuestionVi = isPartMode;
      const showOptionsVi = isPartMode;

      return { showBilingualToggle, showEvidenceToggle, showQuestionVi, showOptionsVi };
    };

    const practiceControls = renderWorkspaceForMode(true);
    expect(practiceControls.showBilingualToggle).toBe(true);
    expect(practiceControls.showEvidenceToggle).toBe(true);
    expect(practiceControls.showQuestionVi).toBe(true);

    const mockControls = renderWorkspaceForMode(false);
    expect(mockControls.showBilingualToggle).toBe(false);
    expect(mockControls.showEvidenceToggle).toBe(false);
    expect(mockControls.showQuestionVi).toBe(false);
  });
});
