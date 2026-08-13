/**
 * ChatGPT Master Prompt & Vision Packet Generator (Phase 1.1)
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

export function generateChatGptVisionMasterPrompt(
  sourceType: 'listening' | 'reading',
  batchIndex: number,
  totalBatches: number,
  startPage: number,
  endPage: number
): string {
  const isReading = sourceType === 'reading';
  const targetRange = isReading ? 'Reading Q101–200' : 'Listening Q1–100';

  return `=== ORI TOEIC HYBRID IMAGE IMPORT (CHATGPT VISION) ===
SCHEMA: ori-full-toeic-import-v1
SOURCE: ${sourceType.toUpperCase()} PDF
BATCH: ${batchIndex}/${totalBatches}
PAGES: ${startPage} -> ${endPage} (${targetRange})

LƯU Ý QUAN TRỌNG:
Các trang PDF đính kèm dưới đây là PDF scan / image-only (không có text layer).
Vui lòng ĐỌC TRỰC TIẾP ẢNH ĐÍNH KÈM để bóc tách chính xác toàn bộ câu hỏi và bài đọc.

QUY TẮC BẮT BUỘC:
1. Trả về định dạng JSON duy nhất tuân thủ schemaVersion: 1.
2. "pagesProcessed" phải chứa đầy đủ tất cả các trang được xử lý: [${Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i).join(', ')}].
3. KHÔNG tự động bỏ qua bất kỳ câu hỏi nào. KHÔNG bịa chữ mờ không đọc được.
4. Đọc chính xác số thứ tự câu, văn bản câu hỏi và 4 lựa chọn (A), (B), (C), (D).
5. Với Reading Part 7 (hoặc Listening Part 3-4): Tiêu đề nhóm nguồn "Questions X–Y refer to..." là CƠ SỞ CỦA TẤT CẢ PHÂN NHÓM.
6. Cung cấp bản dịch Tiếng Việt (questionVi, optionsVi, passageVi) chất lượng cao.
7. Ghi nhận các ký tự mờ vào mảng "warnings".

Vui lòng xuất mã JSON chuẩn ORI!`;
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
      (p) => p.textStatus === 'LOW_TEXT' || p.textStatus === 'IMAGE_ONLY' || p.status === 'LOW_TEXT' || (p.status as string) === 'IMAGE_LIKELY' || (p.status as string) === 'EMPTY'
    );

    let promptText = '';
    if (requiresVision && sourceType !== 'script') {
      promptText = generateChatGptVisionMasterPrompt(
        sourceType as 'listening' | 'reading',
        batchIndex,
        totalBatches,
        startPage,
        endPage
      );
    } else {
      promptText = `=== ORI TOEIC HYBRID BATCH ${batchIndex}/${totalBatches} (${sourceType.toUpperCase()} PDF) ===\n`;
      promptText += `PAGES: ${startPage} -> ${endPage}\n\n`;

      batchPages.forEach((p) => {
        const textToUse = p.extractedText || (p as any).text || '';
        promptText += `--- PAGE ${p.pageNumber} (${p.textStatus || p.status}, ${p.charCount || (p as any).textCharCount || 0} chars) ---\n`;
        promptText += `${textToUse || '[NO EXTRACTABLE TEXT]'}\n\n`;
      });
    }

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
