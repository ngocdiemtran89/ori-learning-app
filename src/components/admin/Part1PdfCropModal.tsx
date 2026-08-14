// ============================================================
// Phase P3.5G: Built-in PDF Part 1 Image Cropper Modal
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { X, Crop, Check, RotateCcw, Image as ImageIcon } from 'lucide-react';
import { loadPdfDocument, renderPdfPageToCanvas, cropCanvasRegion } from '../../lib/cms/pdfUtils';

interface Part1PdfCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfFile: File | null;
  targetQuestionNumber: number; // 1..6
  onCropSaved: (questionNumber: number, croppedBlob: Blob) => void;
}

export const Part1PdfCropModal: React.FC<Part1PdfCropModalProps> = ({
  isOpen,
  onClose,
  pdfFile,
  targetQuestionNumber,
  onCropSaved,
}) => {
  const [numPages, setNumPages] = useState<number>(1);
  const [currentPageNum, setCurrentPageNum] = useState<number>(1);
  const [isLoadingPage, setIsLoadingPage] = useState<boolean>(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Drag selection coordinates
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [cropRect, setCropRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  useEffect(() => {
    if (isOpen && pdfFile) {
      loadPdfDocument(pdfFile)
        .then((doc) => {
          setNumPages(doc.numPages);
          renderPage(doc.pdfDoc, 1);
        })
        .catch((err) => console.error(err));
    }
  }, [isOpen, pdfFile]);

  const renderPage = async (pdfDoc: any, pageNum: number) => {
    setIsLoadingPage(true);
    setCropRect(null);
    setPreviewBlob(null);
    try {
      const renderedCanvas = await renderPdfPageToCanvas(pdfDoc, pageNum, 1.5);
      canvasRef.current = renderedCanvas;
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(renderedCanvas);
      }
    } catch (err) {
      console.error('Page render error:', err);
    } finally {
      setIsLoadingPage(false);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !canvasRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setStartPos({ x, y });
    setCropRect({ x, y, width: 0, height: 0 });
    setIsSelecting(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelecting || !startPos || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    const x = Math.min(startPos.x, currentX);
    const y = Math.min(startPos.y, currentY);
    const width = Math.abs(currentX - startPos.x);
    const height = Math.abs(currentY - startPos.y);

    setCropRect({ x, y, width, height });
  };

  const handleMouseUp = async () => {
    setIsSelecting(false);
    if (!cropRect || cropRect.width < 10 || cropRect.height < 10 || !canvasRef.current) return;

    // Convert display coordinates to canvas native pixel coordinates
    const displayRect = containerRef.current?.getBoundingClientRect();
    if (!displayRect) return;

    const scaleX = canvasRef.current.width / displayRect.width;
    const scaleY = canvasRef.current.height / displayRect.height;

    const realCrop = {
      x: cropRect.x * scaleX,
      y: cropRect.y * scaleY,
      width: cropRect.width * scaleX,
      height: cropRect.height * scaleY,
    };

    const croppedCanvas = cropCanvasRegion(canvasRef.current, realCrop);
    croppedCanvas.toBlob((blob) => {
      if (blob) setPreviewBlob(blob);
    }, 'image/png');
  };

  const handleSaveCrop = () => {
    if (previewBlob) {
      onCropSaved(targetQuestionNumber, previewBlob);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden">
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-800 text-white">
          <div className="flex items-center gap-3">
            <Crop className="w-5 h-5 text-ori-400" />
            <div>
              <h3 className="font-extrabold text-sm">CẮT ẢNH TỪ PDF CHO CÂU Q{targetQuestionNumber}</h3>
              <p className="text-xs text-slate-300">Kéo giữ chuột để tạo khung cắt ảnh trực tiếp từ trang PDF</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-full transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* CONTROLS */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-bold">
          <div className="flex items-center gap-3">
            <span>Trang:</span>
            <select
              value={currentPageNum}
              onChange={(e) => {
                const p = parseInt(e.target.value, 10);
                setCurrentPageNum(p);
                if (pdfFile) {
                  loadPdfDocument(pdfFile).then((doc) => renderPage(doc.pdfDoc, p));
                }
              }}
              className="px-3 py-1 bg-white border border-slate-200 rounded-xl text-xs font-extrabold"
            >
              {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => (
                <option key={p} value={p}>
                  Trang {p} / {numPages}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            {cropRect && (
              <button
                onClick={() => {
                  setCropRect(null);
                  setPreviewBlob(null);
                }}
                className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Thử Lại
              </button>
            )}
          </div>
        </div>

        {/* BODY CANVAS VIEWPORT */}
        <div className="flex-1 overflow-auto p-6 bg-slate-100 flex gap-6">
          <div className="flex-1 flex justify-center items-start">
            <div
              ref={containerRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              className="relative cursor-crosshair shadow-lg rounded-xl overflow-hidden select-none bg-white"
            >
              {isLoadingPage && (
                <div className="p-12 text-center text-xs font-bold text-slate-500">Đang tải trang PDF...</div>
              )}

              {cropRect && (
                <div
                  className="absolute border-2 border-ori-500 bg-ori-500/20 pointer-events-none"
                  style={{
                    left: `${cropRect.x}px`,
                    top: `${cropRect.y}px`,
                    width: `${cropRect.width}px`,
                    height: `${cropRect.height}px`,
                  }}
                />
              )}
            </div>
          </div>

          {/* PREVIEW SIDEBAR */}
          <div className="w-64 bg-white p-4 rounded-2xl border border-slate-200 flex flex-col justify-between">
            <div className="space-y-3">
              <span className="text-xs font-extrabold text-slate-700 uppercase flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-ori-600" /> KẾT QUẢ CẮT Q{targetQuestionNumber}
              </span>
              {previewBlob ? (
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 p-2 text-center">
                  <img
                    src={URL.createObjectURL(previewBlob)}
                    alt={`Preview Q${targetQuestionNumber}`}
                    className="max-h-48 mx-auto object-contain rounded-lg"
                  />
                  <p className="text-[10px] font-bold text-emerald-600 mt-2">✓ Đã tạo vung cắt hợp lệ</p>
                </div>
              ) : (
                <div className="p-8 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400 font-medium">
                  Hãy kéo giữ chuột trên trang PDF để chọn khung ảnh Q{targetQuestionNumber}
                </div>
              )}
            </div>

            <button
              disabled={!previewBlob}
              onClick={handleSaveCrop}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-md disabled:opacity-40 flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" /> Lưu Ảnh Q{targetQuestionNumber}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
