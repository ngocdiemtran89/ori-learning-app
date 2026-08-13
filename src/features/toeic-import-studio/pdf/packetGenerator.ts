/**
 * ChatGPT Master Prompt & Batch Packet Generator
 */

import { PdfPagePreflight, ChatGptBatchPacket } from '../types';

export function generateMasterPrompt(): string {
  return `Bạn là Chuyên gia Khai thác và Chuẩn hóa Dữ liệu Đề thi TOEIC Listening & Reading cho Hệ thống ORI Learning Studio.

NHIỆM VỤ:
Trích xuất và chuẩn hóa chính xác dữ liệu từ văn bản/ảnh PDF đề thi được cung cấp bên dưới thành định dạng JSON chuẩn ORI (schemaVersion: 1).

QUY TẮC CHẮC CHẮN VÀ BẮT BUỘC:
1. KHÔNG tự bịa nội dung hoặc sửa đổi số câu.
2. Giữ nguyên số thứ tự câu (Q1 đến Q200).
3. Giữ nguyên văn bản câu hỏi và 4 lựa chọn (A), (B), (C), (D).
4. Đối với Listening Part 1-2: Không nhập transcript bài nghe vào questionText.
5. Đối với Listening Part 3-4 & Reading Part 6-7:
   - Gom nhóm đúng phạm vi ghi trên đề (VD: "Questions 147-148 refer to the following notice.").
   - Tiêu đề nhóm nguồn (sourceHeader) là CƠ SỞ PHÁP LÝ CAO NHẤT để chia nhóm.
6. Cung cấp bản dịch Tiếng Việt (questionVi, optionsVi, passageVi) chất lượng cao cho học viên.
7. Báo cáo các trường hợp mờ, mất chữ hoặc không chắc chắn vào thuộc tính "warnings".
8. Chỉ trả về JSON duy nhất, không kèm văn bản giải thích thừa.

ĐỊNH DẠNG XUẤT JSON CHUẨN ORI:
{
  "schemaVersion": 1,
  "source": "Reading",
  "batch": 1,
  "pagesProcessed": [1, 2, 3, 4, 5],
  "questions": [
    {
      "questionNumber": 147,
      "part": 7,
      "questionText": "What is the notice about?",
      "questionVi": "Thông báo có nội dung gì?",
      "options": {
        "A": "Parking fees",
        "B": "Office hours",
        "C": "Staff training",
        "D": "Building closure"
      },
      "optionsVi": {
        "A": "Phí giữ xe",
        "B": "Giờ làm việc",
        "C": "Đào tạo nhân viên",
        "D": "Đóng cửa tòa nhà"
      },
      "correctAnswer": "A",
      "groupKey": "P7-Q147-148",
      "sourcePage": 12,
      "confidence": 0.98,
      "warnings": []
    }
  ],
  "groups": [
    {
      "groupKey": "P7-Q147-148",
      "part": 7,
      "startQuestion": 147,
      "endQuestion": 148,
      "instruction": "Questions 147-148 refer to the following notice.",
      "passage": "Notice content...",
      "passageVi": "Nội dung thông báo...",
      "sourcePages": [12],
      "confidence": 0.98,
      "warnings": []
    }
  ],
  "warnings": []
}`;
}

export function generateBatchPackets(
  pages: PdfPagePreflight[],
  sourceType: 'listening' | 'reading' | 'script',
  batchSize: number = 5
): ChatGptBatchPacket[] {
  const packets: ChatGptBatchPacket[] = [];
  const totalBatches = Math.ceil(pages.length / batchSize);

  for (let i = 0; i < pages.length; i += batchSize) {
    const batchPages = pages.slice(i, i + batchSize);
    const batchIndex = Math.floor(i / batchSize) + 1;
    const startPage = batchPages[0].pageNumber;
    const endPage = batchPages[batchPages.length - 1].pageNumber;

    const requiresVision = batchPages.some(
      (p) => p.status === 'LOW_TEXT' || p.status === 'IMAGE_LIKELY' || p.status === 'EMPTY'
    );

    let promptText = `=== ORI TOEIC HYBRID BATCH ${batchIndex}/${totalBatches} (${sourceType.toUpperCase()} PDF) ===\n`;
    promptText += `PAGES: ${startPage} -> ${endPage}\n`;
    if (requiresVision) {
      promptText += `⚠ KHUYÊN DÙNG CHATGPT VISION CHO CÁC TRANG SCAN/ẢNH BÊN DƯỚI.\n`;
    }
    promptText += `\n`;

    batchPages.forEach((p) => {
      promptText += `--- PAGE ${p.pageNumber} (${p.status}, ${p.textCharCount} chars) ---\n`;
      promptText += `${p.text || '[NO EXTRACTABLE TEXT]'}\n\n`;
    });

    packets.push({
      batchIndex,
      totalBatches,
      sourceType,
      startPage,
      endPage,
      promptText,
      requiresVision,
    });
  }

  return packets;
}
