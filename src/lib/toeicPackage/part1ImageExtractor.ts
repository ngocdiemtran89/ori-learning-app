// ============================================================
// Phase P3.5G: One-Click TOEIC Test Package Importer - Part 1 Image Extractor
// ============================================================

import { loadPdfDocument, renderPdfPageToCanvas, cropCanvasRegion } from '../cms/pdfUtils';

export interface Part1ExtractedImage {
  questionNumber: number; // 1..6
  blob: Blob;
  filename: string;
  width: number;
  height: number;
  provenance: 'PDF_EMBEDDED_IMAGE' | 'PDF_SCAN_AUTOCROP' | 'MANUAL_CROP' | 'MANUAL_UPLOAD';
  status: 'AUTO_EXTRACTED' | 'NEEDS_REVIEW' | 'MANUAL_REQUIRED';
  sourcePage?: number;
}

/**
 * Extract Part 1 images Q1..Q6 from Listening PDF file locally using PDF.js.
 * Path A: Extract native embedded raster images if present.
 * Path B: High-resolution canvas render & deterministic layout segmentation for scanned/image PDFs.
 */
export async function extractPart1ImagesFromPdf(pdfFile: File): Promise<Record<number, Part1ExtractedImage>> {
  const result: Record<number, Part1ExtractedImage> = {};
  if (!pdfFile) return result;

  try {
    const docDetails = await loadPdfDocument(pdfFile);
    const pdfDoc = docDetails.pdfDoc;
    const numPages = Math.min(docDetails.numPages, 10);

    // 1. Detect pages containing Part 1
    const p1PageNums: number[] = [];
    for (let p = 1; p <= numPages; p++) {
      const page = await pdfDoc.getPage(p);
      const textContent = await page.getTextContent();
      const text = textContent.items.map((i: any) => i.str || '').join(' ');

      if (/part\s*1/i.test(text) || /photographs/i.test(text) || /\b1\b.*\b2\b/i.test(text)) {
        p1PageNums.push(p);
      }
    }

    if (p1PageNums.length === 0) {
      for (let p = 1; p <= Math.min(numPages, 3); p++) {
        p1PageNums.push(p);
      }
    }

    // Path A: Check for native embedded images in PDF operator list
    const embeddedImages: Array<{ blob: Blob; width: number; height: number; pageNum: number; y: number }> = [];

    for (const pageNum of p1PageNums) {
      try {
        const page = await pdfDoc.getPage(pageNum);
        const opList = await page.getOperatorList();

        for (let i = 0; i < opList.fnArray.length; i++) {
          const fn = opList.fnArray[i];
          // OPS.paintImageXObject = 85, OPS.paintInlineImageXObject = 82, OPS.paintImageMaskXObject = 83
          if (fn === 85 || fn === 82 || fn === 83) {
            const imgName = opList.argsArray[i][0];
            let imgObj: any = null;
            try {
              imgObj = page.objs.get(imgName);
            } catch {
              // Ignore if object not loaded
            }

            if (imgObj && imgObj.width >= 120 && imgObj.height >= 120) {
              const imgCanvas = document.createElement('canvas');
              imgCanvas.width = imgObj.width;
              imgCanvas.height = imgObj.height;
              const ctx = imgCanvas.getContext('2d');
              if (ctx) {
                if (imgObj.data) {
                  const imgData = ctx.createImageData(imgObj.width, imgObj.height);
                  if (imgObj.data.length === imgObj.width * imgObj.height * 4) {
                    imgData.data.set(imgObj.data);
                  } else if (imgObj.data.length === imgObj.width * imgObj.height * 3) {
                    for (let j = 0, k = 0; j < imgObj.data.length; j += 3, k += 4) {
                      imgData.data[k] = imgObj.data[j];
                      imgData.data[k + 1] = imgObj.data[j + 1];
                      imgData.data[k + 2] = imgObj.data[j + 2];
                      imgData.data[k + 3] = 255;
                    }
                  }
                  ctx.putImageData(imgData, 0, 0);
                  const blob = await new Promise<Blob | null>((resolve) => imgCanvas.toBlob(resolve, 'image/png'));
                  if (blob && blob.size > 1000) {
                    embeddedImages.push({
                      blob,
                      width: imgObj.width,
                      height: imgObj.height,
                      pageNum,
                      y: i,
                    });
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        console.error(`Page ${pageNum} operator list parse error:`, err);
      }
    }

    if (embeddedImages.length >= 6) {
      embeddedImages.sort((a, b) => (a.pageNum !== b.pageNum ? a.pageNum - b.pageNum : a.y - b.y));
      for (let q = 1; q <= 6; q++) {
        const item = embeddedImages[q - 1];
        result[q] = {
          questionNumber: q,
          blob: item.blob,
          filename: `p1_q${q}_embedded.png`,
          width: item.width,
          height: item.height,
          provenance: 'PDF_EMBEDDED_IMAGE',
          status: 'AUTO_EXTRACTED',
          sourcePage: item.pageNum,
        };
      }
      return result;
    }

    // Path B: Scanned / Image-Only PDF Layout Segmentation
    const cropsPerPage = Math.ceil(6 / Math.max(1, p1PageNums.length));
    let currentQ = 1;

    for (const pageNum of p1PageNums) {
      if (currentQ > 6) break;
      const canvas = await renderPdfPageToCanvas(pdfDoc, pageNum, 2.0);
      const pageHeight = canvas.height;
      const pageWidth = canvas.width;

      const topMargin = Math.floor(pageHeight * 0.08);
      const bottomMargin = Math.floor(pageHeight * 0.05);
      const usableHeight = pageHeight - topMargin - bottomMargin;
      const leftMargin = Math.floor(pageWidth * 0.05);
      const rightMargin = Math.floor(pageWidth * 0.05);
      const usableWidth = pageWidth - leftMargin - rightMargin;

      const itemsOnThisPage = Math.min(cropsPerPage, 7 - currentQ);
      const segmentHeight = Math.floor(usableHeight / itemsOnThisPage);

      for (let i = 0; i < itemsOnThisPage; i++) {
        if (currentQ > 6) break;
        const cropY = topMargin + i * segmentHeight;
        const cropHeight = Math.floor(segmentHeight * 0.85);

        const croppedCanvas = cropCanvasRegion(canvas, {
          x: leftMargin,
          y: cropY,
          width: usableWidth,
          height: cropHeight,
        });

        const blob = await new Promise<Blob | null>((resolve) => croppedCanvas.toBlob(resolve, 'image/png'));
        if (blob) {
          result[currentQ] = {
            questionNumber: currentQ,
            blob,
            filename: `p1_q${currentQ}_autocrop.png`,
            width: croppedCanvas.width,
            height: croppedCanvas.height,
            provenance: 'PDF_SCAN_AUTOCROP',
            status: 'NEEDS_REVIEW',
            sourcePage: pageNum,
          };
        }
        currentQ++;
      }
    }
  } catch (err) {
    console.error('Part 1 image extraction error:', err);
  }

  return result;
}
