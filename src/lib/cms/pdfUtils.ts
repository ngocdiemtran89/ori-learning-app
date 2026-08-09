// Dynamic loader for PDF.js to support both Node test environment and Vite browser
async function getPdfJs() {
  if (typeof window === 'undefined') {
    // Node environment (Vitest)
    return await import('pdfjs-dist/legacy/build/pdf.mjs');
  } else {
    // Browser environment (Vite)
    const pdfjsLib = await import('pdfjs-dist');
    if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.mjs',
        import.meta.url
      ).toString();
    }
    return pdfjsLib;
  }
}

export interface PdfDocumentDetails {
  pdfDoc: any;
  numPages: number;
  filename: string;
}

// 1. LOAD PDF DOCUMENT SAFELY
export async function loadPdfDocument(file: File): Promise<PdfDocumentDetails> {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('File không phải là PDF hợp lệ. Vui lòng chọn file .pdf.');
  }

  try {
    const pdfjsLib = await getPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;
    return {
      pdfDoc,
      numPages: pdfDoc.numPages,
      filename: file.name,
    };
  } catch (err: any) {
    if (err?.name === 'PasswordException') {
      throw new Error('File PDF có mật khẩu bảo vệ. Vui lòng gỡ mật khẩu trước khi import.');
    }
    throw new Error('Không thể đọc file PDF này. File có thể bị hỏng hoặc không đúng định dạng.');
  }
}

// 2. RENDER PDF PAGE TO CANVAS
export async function renderPdfPageToCanvas(
  pdfDoc: any,
  pageNum: number,
  scale: number = 1.0
): Promise<HTMLCanvasElement> {
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Không thể khởi tạo Canvas 2D context.');
  }

  const renderContext = {
    canvasContext: ctx,
    viewport,
  };

  await page.render(renderContext).promise;
  return canvas;
}

// 3. CROP CANVAS REGION
export function cropCanvasRegion(
  sourceCanvas: HTMLCanvasElement,
  cropBox: { x: number; y: number; width: number; height: number }
): HTMLCanvasElement {
  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = Math.max(1, Math.floor(cropBox.width));
  croppedCanvas.height = Math.max(1, Math.floor(cropBox.height));

  const ctx = croppedCanvas.getContext('2d');
  if (!ctx) {
    throw new Error('Không thể khởi tạo Canvas context cho vùng crop.');
  }

  ctx.drawImage(
    sourceCanvas,
    cropBox.x,
    cropBox.y,
    cropBox.width,
    cropBox.height,
    0,
    0,
    cropBox.width,
    cropBox.height
  );

  return croppedCanvas;
}

// 4. CANVAS TO FILE BLOB CONVERTER
export async function canvasToFile(
  canvas: HTMLCanvasElement,
  filename: string,
  mimeType: string = 'image/png'
): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Không thể chuyển đổi Canvas thành Blob ảnh.'));
        return;
      }
      const file = new File([blob], filename, { type: mimeType });
      resolve(file);
    }, mimeType, 0.92);
  });
}

// 5. EXTRACT TEXT ITEMS FROM PDF FILE
export async function extractPdfTextItems(file: File): Promise<Array<{ text: string; pageNum: number }>> {
  const { pdfDoc, numPages } = await loadPdfDocument(file);
  const items: Array<{ text: string; pageNum: number }> = [];

  for (let p = 1; p <= numPages; p++) {
    const page = await pdfDoc.getPage(p);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str || '')
      .join(' ');
    items.push({ text: pageText, pageNum: p });
  }

  return items;
}
