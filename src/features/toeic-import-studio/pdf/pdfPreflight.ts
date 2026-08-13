/**
 * PDF Preflight & Text Extraction Engine
 */

import { loadPdfDocument, renderPdfPageToCanvas } from '../../../lib/cms/pdfUtils';
import { PdfPagePreflight, PdfPreflightReport, PdfPageStatus } from '../types';
import { LOW_TEXT_CHAR_THRESHOLD, EMPTY_TEXT_CHAR_THRESHOLD } from '../constants';

export async function processPdfPreflight(file: File): Promise<PdfPreflightReport> {
  const { pdfDoc, numPages, filename } = await loadPdfDocument(file);
  const pages: PdfPagePreflight[] = [];

  let pagesWithText = 0;
  let lowTextPages = 0;
  let imageOrEmptyPages = 0;

  for (let p = 1; p <= numPages; p++) {
    const page = await pdfDoc.getPage(p);
    const textContent = await page.getTextContent();
    const rawText = textContent.items
      .map((item: any) => item.str || '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    const charCount = rawText.length;
    let status: PdfPageStatus = 'TEXT_OK';
    const warnings: string[] = [];

    if (charCount <= EMPTY_TEXT_CHAR_THRESHOLD) {
      status = 'EMPTY';
      warnings.push(`Trang ${p} không có chữ hoặc chỉ có kí tự lạ (0-${EMPTY_TEXT_CHAR_THRESHOLD} chars). Khuyên dùng ChatGPT Vision.`);
      imageOrEmptyPages++;
    } else if (charCount < LOW_TEXT_CHAR_THRESHOLD) {
      status = 'LOW_TEXT';
      warnings.push(`Trang ${p} ít chữ (${charCount} chars < ${LOW_TEXT_CHAR_THRESHOLD}). Cần kiểm tra dạng ảnh PDF scan.`);
      lowTextPages++;
    } else {
      status = 'TEXT_OK';
      pagesWithText++;
    }

    pages.push({
      pageNumber: p,
      text: rawText,
      textCharCount: charCount,
      status,
      warnings,
    });
  }

  return {
    fileName: filename,
    totalPages: numPages,
    pagesWithText,
    lowTextPages,
    imageOrEmptyPages,
    pages,
  };
}

export async function getPdfPageCanvas(file: File, pageNum: number, scale: number = 1.2): Promise<HTMLCanvasElement> {
  const { pdfDoc } = await loadPdfDocument(file);
  return await renderPdfPageToCanvas(pdfDoc, pageNum, scale);
}
