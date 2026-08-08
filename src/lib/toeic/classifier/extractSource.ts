import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.mjs`;

export async function extractTextFromFile(file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'txt') {
    return await file.text();
  }

  if (extension === 'docx') {
    const arrayBuffer = await file.arrayBuffer();
    try {
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    } catch (e: any) {
      throw new Error('Failed to extract text from DOCX: ' + e.message);
    }
  }

  if (extension === 'pdf') {
    const arrayBuffer = await file.arrayBuffer();
    try {
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((item: any) => item.str).join(' ');
        text += pageText + '\n\n';
      }
      
      if (!text.trim()) {
         throw new Error('PDF này không có lớp văn bản có thể đọc tự động. Phiên bản hiện tại chưa hỗ trợ OCR.');
      }
      return text;
    } catch (e: any) {
      if (e.message.includes('không có lớp văn bản')) {
        throw e;
      }
      throw new Error('Failed to extract text from PDF: ' + e.message);
    }
  }

  throw new Error(`Định dạng file không được hỗ trợ: .${extension}`);
}
