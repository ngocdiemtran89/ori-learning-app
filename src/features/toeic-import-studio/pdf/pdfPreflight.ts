/**
 * Hardened PDF Preflight & Text Extraction Engine (Phase 1.1)
 * Supports PDF_TEXT, LOW_TEXT, IMAGE_ONLY, TEXT_ERROR, RENDER_ERROR with cancellation safety.
 */

import { loadPdfDocument } from '../../../lib/cms/pdfUtils';
import { PdfPagePreflight, PdfPreflightReport, PdfTextStatus } from '../types';
import { PDF_TEXT_OK_MIN_CHARS, PDF_PAGE_RENDER_SCALE } from '../constants';

export function normalizePdfText(rawText: string): { normalizedText: string; charCount: number; wordCount: number } {
  const normalizedText = (rawText || '')
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();
  const charCount = normalizedText.length;
  const wordCount = normalizedText ? normalizedText.split(/\s+/).filter(Boolean).length : 0;
  return { normalizedText, charCount, wordCount };
}

export function isLikelyReadableText(text: string): boolean {
  if (!text || text.length === 0) return false;
  // Check proportion of printable alphanumeric & standard text chars vs garbage symbols
  const cleanCharCount = text.replace(/[^\w\s\.\,\?\!\:\;\-\(\)\'\"\–\—\“\”]/gi, '').length;
  return cleanCharCount / text.length >= 0.5;
}

export async function processPdfPreflight(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<PdfPreflightReport> {
  const { pdfDoc, numPages, filename } = await loadPdfDocument(file);
  const pages: PdfPagePreflight[] = [];

  let pagesWithText = 0;
  let lowTextPages = 0;
  let imageOnlyPages = 0;
  let textErrorPages = 0;
  let renderErrorPages = 0;

  for (let p = 1; p <= numPages; p++) {
    if (onProgress) onProgress(p, numPages);

    let rawText = '';
    let textStatus: PdfTextStatus = 'IMAGE_ONLY';
    let textError: string | undefined = undefined;
    const warnings: string[] = [];

    try {
      const page = await pdfDoc.getPage(p);
      const textContent = await page.getTextContent();
      rawText = textContent.items
        .map((item: any) => item.str || '')
        .join(' ');
    } catch (err: any) {
      textStatus = 'TEXT_ERROR';
      textError = err?.message || String(err);
      textErrorPages++;
      warnings.push(`Trang ${p}: Lỗi bóc tách chữ từ PDF (${textError}).`);
    }

    const { normalizedText, charCount, wordCount } = normalizePdfText(rawText);

    if (textStatus !== 'TEXT_ERROR') {
      if (charCount === 0) {
        textStatus = 'IMAGE_ONLY';
        imageOnlyPages++;
        warnings.push(`Trang ${p} không có chữ (0 chars). Đây là trang scan/ảnh. Cần dùng Image Mode hoặc ChatGPT Vision.`);
      } else if (charCount < PDF_TEXT_OK_MIN_CHARS) {
        textStatus = 'LOW_TEXT';
        lowTextPages++;
        warnings.push(`Trang ${p} ít chữ (${charCount} chars < ${PDF_TEXT_OK_MIN_CHARS}). Khuyên dùng OCR hoặc ChatGPT Vision.`);
      } else {
        if (isLikelyReadableText(normalizedText)) {
          textStatus = 'TEXT_OK';
          pagesWithText++;
        } else {
          textStatus = 'LOW_TEXT';
          lowTextPages++;
          warnings.push(`Trang ${p} có chữ rác/kí tự lạ. Cần kiểm tra lại.`);
        }
      }
    }

    pages.push({
      pageNumber: p,
      extractedText: rawText,
      normalizedText,
      charCount,
      wordCount,
      status: textStatus,
      textStatus,
      renderStatus: 'NOT_RENDERED',
      activeTextSource: 'PDF_TEXT',
      warnings,
      textError,
    });
  }

  return {
    fileName: filename,
    totalPages: numPages,
    pagesWithText,
    lowTextPages,
    imageOnlyPages,
    textErrorPages,
    renderErrorPages,
    imageOrEmptyPages: imageOnlyPages,
    pages,
  };
}

let activeRenderTask: any = null;

export async function renderPdfPageToCanvasSafe(
  pdfDoc: any,
  pageNum: number,
  canvas: HTMLCanvasElement,
  scale: number = PDF_PAGE_RENDER_SCALE
): Promise<void> {
  if (activeRenderTask) {
    try {
      activeRenderTask.cancel();
    } catch (e) {
      // ignore cancellation exceptions
    }
    activeRenderTask = null;
  }

  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Không thể khởi tạo Canvas 2D context.');
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const renderContext = {
    canvasContext: ctx,
    viewport,
  };

  const task = page.render(renderContext);
  activeRenderTask = task;

  try {
    await task.promise;
    activeRenderTask = null;
  } catch (err: any) {
    activeRenderTask = null;
    if (err?.name === 'RenderingCancelledException') {
      return;
    }
    throw err;
  }
}
