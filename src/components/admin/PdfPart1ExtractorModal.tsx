// ============================================================
// Phase P3.5F: PDF Part 1 Image Extractor & Crop Modal Component
// ============================================================

import React, { useState } from 'react';
import { FileText, Crop, CheckCircle2, AlertCircle, Trash2, RotateCcw, Image as ImageIcon, Loader2, X } from 'lucide-react';
import { loadPdfDocument, renderPdfPageToCanvas, cropCanvasRegion, canvasToFile, PdfDocumentDetails } from '../../lib/cms/pdfUtils';

export interface SelectedPdfSlot {
  qNum: number; // 1..6
  pageNum: number;
  canvas: HTMLCanvasElement;
  cropBox: { x: number; y: number; width: number; height: number } | null;
  croppedCanvas: HTMLCanvasElement | null;
  previewUrl: string;
}

interface PdfPart1ExtractorModalProps {
  onConfirmImages: (files: File[]) => void;
  onClose: () => void;
}

export const PdfPart1ExtractorModal: React.FC<PdfPart1ExtractorModalProps> = ({
  onConfirmImages,
  onClose,
}) => {
  const [pdfDetails, setPdfDetails] = useState<PdfDocumentDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected Q1..Q6 slots
  const [slots, setSlots] = useState<Record<number, SelectedPdfSlot>>({});

  // Crop Modal state
  const [croppingQNum, setCroppingQNum] = useState<number | null>(null);
  const [cropBox, setCropBox] = useState<{ x: number; y: number; width: number; height: number }>({ x: 50, y: 50, width: 300, height: 250 });

  // Page thumbnail canvases cache
  const [pageCanvases, setPageCanvases] = useState<Record<number, HTMLCanvasElement>>({});
  const [renderingPages, setRenderingPages] = useState<Record<number, boolean>>({});

  // Handle PDF file select
  const handlePdfSelect = async (file: File) => {
    setError(null);
    setLoading(true);
    try {
      const details = await loadPdfDocument(file);
      setPdfDetails(details);
      setSlots({});
      setPageCanvases({});
    } catch (err: any) {
      setError(err.message || 'Lỗi khi đọc file PDF');
    } finally {
      setLoading(false);
    }
  };

  // Render thumbnail for page if not cached
  const ensurePageCanvas = async (pageNum: number) => {
    if (!pdfDetails || pageCanvases[pageNum] || renderingPages[pageNum]) return;
    setRenderingPages(prev => ({ ...prev, [pageNum]: true }));
    try {
      const canvas = await renderPdfPageToCanvas(pdfDetails.pdfDoc, pageNum, 1.2);
      setPageCanvases(prev => ({ ...prev, [pageNum]: canvas }));
    } catch (err) {
      console.error('Error rendering page:', pageNum, err);
    } finally {
      setRenderingPages(prev => ({ ...prev, [pageNum]: false }));
    }
  };

  // Assign page to next available Q slot (or toggle)
  const handlePageClick = async (pageNum: number) => {
    // Check if page is already assigned to a slot
    const existingQNum = Object.keys(slots).find(q => slots[Number(q)].pageNum === pageNum);
    if (existingQNum) {
      // Remove assignment
      const nextSlots = { ...slots };
      delete nextSlots[Number(existingQNum)];
      setSlots(nextSlots);
      return;
    }

    // Find first empty slot (1..6)
    let emptyQNum: number | null = null;
    for (let q = 1; q <= 6; q++) {
      if (!slots[q]) {
        emptyQNum = q;
        break;
      }
    }

    if (!emptyQNum) {
      alert('Đã chọn đủ 6 ảnh cho Q1–Q6. Bỏ bớt một ảnh để chọn trang khác.');
      return;
    }

    // Render full canvas if needed
    let pageCanvas = pageCanvases[pageNum];
    if (!pageCanvas && pdfDetails) {
      pageCanvas = await renderPdfPageToCanvas(pdfDetails.pdfDoc, pageNum, 1.5);
      setPageCanvases(prev => ({ ...prev, [pageNum]: pageCanvas }));
    }

    if (pageCanvas) {
      const previewUrl = pageCanvas.toDataURL('image/png');
      setSlots(prev => ({
        ...prev,
        [emptyQNum!]: {
          qNum: emptyQNum!,
          pageNum,
          canvas: pageCanvas!,
          cropBox: null,
          croppedCanvas: null,
          previewUrl,
        },
      }));
    }
  };

  // Open Crop Editor for a specific Q slot
  const handleOpenCrop = (qNum: number) => {
    const slot = slots[qNum];
    if (!slot) return;

    setCroppingQNum(qNum);
    const canvasWidth = slot.canvas.width;
    const canvasHeight = slot.canvas.height;

    // Default crop box in center of page
    const defaultWidth = Math.floor(canvasWidth * 0.7);
    const defaultHeight = Math.floor(canvasHeight * 0.5);
    const defaultX = Math.floor((canvasWidth - defaultWidth) / 2);
    const defaultY = Math.floor((canvasHeight - defaultHeight) / 2);

    setCropBox(slot.cropBox || { x: defaultX, y: defaultY, width: defaultWidth, height: defaultHeight });
  };

  // Confirm Crop
  const handleConfirmCrop = () => {
    if (!croppingQNum || !slots[croppingQNum]) return;
    const slot = slots[croppingQNum];

    const cropped = cropCanvasRegion(slot.canvas, cropBox);
    const croppedUrl = cropped.toDataURL('image/png');

    setSlots(prev => ({
      ...prev,
      [croppingQNum]: {
        ...slot,
        cropBox,
        croppedCanvas: cropped,
        previewUrl: croppedUrl,
      },
    }));

    setCroppingQNum(null);
  };

  // Reset Crop to full page
  const handleResetCrop = (qNum: number) => {
    const slot = slots[qNum];
    if (!slot) return;
    const fullUrl = slot.canvas.toDataURL('image/png');
    setSlots(prev => ({
      ...prev,
      [qNum]: {
        ...slot,
        cropBox: null,
        croppedCanvas: null,
        previewUrl: fullUrl,
      },
    }));
  };

  // Remove assignment
  const handleRemoveSlot = (qNum: number) => {
    const next = { ...slots };
    delete next[qNum];
    setSlots(next);
  };

  // Confirm and Export all 6 slots to Files
  const handleConfirmAll = async () => {
    const count = Object.keys(slots).length;
    if (count < 6) {
      if (!window.confirm(`Bạn mới chọn ${count}/6 ảnh. Vẫn muốn xuất ${count} ảnh này?`)) {
        return;
      }
    }

    const files: File[] = [];
    for (let q = 1; q <= 6; q++) {
      const slot = slots[q];
      if (slot) {
        const targetCanvas = slot.croppedCanvas || slot.canvas;
        const filename = `q00${q}.png`;
        const file = await canvasToFile(targetCanvas, filename, 'image/png');
        files.push(file);
      }
    }

    onConfirmImages(files);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 max-w-5xl w-full space-y-4 max-h-[92vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between border-b pb-3 border-slate-100">
          <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-ori-600" />
            Lấy ảnh Part 1 từ PDF Đề thi
          </h3>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!pdfDetails ? (
          <div className="p-8 border-2 border-dashed border-slate-300 rounded-3xl text-center space-y-4 bg-slate-50/50">
            <FileText className="w-12 h-12 text-slate-400 mx-auto" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-800">Chọn hoặc kéo thả file PDF đề thi vào đây</p>
              <p className="text-xs text-slate-400">Chỉ chấp nhận file .pdf (xử lý trực tiếp trong trình duyệt, bảo mật 100%)</p>
            </div>
            <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-ori-600 hover:bg-ori-500 text-white font-extrabold text-xs rounded-xl cursor-pointer shadow-md">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
              <span>Chọn file PDF</span>
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handlePdfSelect(e.target.files[0]);
                }}
              />
            </label>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col space-y-3">
            {/* Top Bar: PDF Info & Status */}
            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs font-bold">
              <span className="text-slate-700 font-mono">PDF: {pdfDetails.filename} ({pdfDetails.numPages} trang)</span>
              <div className="flex items-center gap-3">
                <span className={`px-2.5 py-1 rounded-full ${Object.keys(slots).length === 6 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  Đã chọn: {Object.keys(slots).length}/6 ảnh Part 1
                </span>
                <label className="text-ori-600 hover:underline cursor-pointer">
                  Đổi PDF khác
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handlePdfSelect(e.target.files[0]);
                    }}
                  />
                </label>
              </div>
            </div>

            {/* Middle Section: Page Selection Grid & Slot Previews */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 min-h-0">
              {/* PDF Pages Grid (2 cols) */}
              <div className="md:col-span-2 border border-slate-200 rounded-2xl p-3 overflow-y-auto space-y-2 max-h-[50vh]">
                <p className="text-xs font-extrabold text-slate-500 uppercase">Bấm vào trang để gán cho Q1..Q6:</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Array.from({ length: pdfDetails.numPages }, (_, i) => i + 1).map((pNum) => {
                    const assignedQNum = Object.keys(slots).find(q => slots[Number(q)].pageNum === pNum);
                    ensurePageCanvas(pNum);

                    return (
                      <div
                        key={pNum}
                        onClick={() => handlePageClick(pNum)}
                        className={`relative border-2 rounded-xl p-1.5 cursor-pointer transition-all hover:shadow-md ${
                          assignedQNum ? 'border-ori-500 bg-ori-50/50' : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="text-[10px] font-bold text-slate-500 mb-1 flex justify-between">
                          <span>Trang {pNum}</span>
                          {assignedQNum && <span className="font-extrabold text-ori-600">✓ Q{assignedQNum}</span>}
                        </div>

                        {pageCanvases[pNum] ? (
                          <img
                            src={pageCanvases[pNum].toDataURL('image/png')}
                            alt={`Trang ${pNum}`}
                            className="w-full h-28 object-contain rounded bg-slate-100"
                          />
                        ) : (
                          <div className="w-full h-28 flex items-center justify-center bg-slate-100 rounded text-slate-400 text-xs">
                            <Loader2 className="w-4 h-4 animate-spin" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Slot Previews Column (1 col) */}
              <div className="border border-slate-200 rounded-2xl p-3 overflow-y-auto space-y-2 max-h-[50vh] bg-slate-50/50">
                <p className="text-xs font-extrabold text-slate-700 uppercase">Xem trước 6 Ảnh Q1–Q6:</p>
                {[1, 2, 3, 4, 5, 6].map(q => {
                  const slot = slots[q];
                  return (
                    <div key={q} className="bg-white p-2.5 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-ori-600">Q{q} Image</span>
                        {slot ? (
                          <span className="text-[10px] text-slate-500">Trang {slot.pageNum}</span>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Chưa chọn</span>
                        )}
                      </div>

                      {slot ? (
                        <div className="space-y-1.5">
                          <img src={slot.previewUrl} alt={`Q${q}`} className="w-full h-20 object-contain rounded bg-slate-100 border border-slate-100" />
                          <div className="flex items-center gap-1.5 justify-end">
                            <button
                              type="button"
                              onClick={() => handleOpenCrop(q)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] rounded-lg flex items-center gap-1"
                            >
                              <Crop className="w-3 h-3" />
                              {slot.cropBox ? 'Sửa crop' : 'Cắt ảnh'}
                            </button>
                            {slot.cropBox && (
                              <button
                                type="button"
                                onClick={() => handleResetCrop(q)}
                                className="p-1 text-slate-400 hover:text-slate-600 text-[10px]"
                                title="Bỏ crop"
                              >
                                <RotateCcw className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveSlot(q)}
                              className="p-1 text-red-500 hover:bg-red-50 rounded"
                              title="Xóa slot này"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-16 border border-dashed border-slate-200 rounded flex items-center justify-center text-slate-300 text-[10px]">
                          Bấm trang bên trái để gán
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-extrabold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleConfirmAll}
            disabled={!pdfDetails || Object.keys(slots).length === 0}
            className="px-5 py-2 text-xs font-extrabold text-white bg-ori-600 rounded-xl hover:bg-ori-500 disabled:opacity-50 flex items-center gap-2 shadow-md"
          >
            <CheckCircle2 className="w-4 h-4" />
            Xác nhận xuất {Object.keys(slots).length} ảnh Part 1
          </button>
        </div>
      </div>

      {/* CROP EDITOR MODAL OVERLAY */}
      {croppingQNum && slots[croppingQNum] && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-3xl w-full space-y-4 max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between border-b pb-2 border-slate-100">
              <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Crop className="w-4 h-4 text-ori-600" />
                Cắt ảnh cho câu Q{croppingQNum} (Trang {slots[croppingQNum].pageNum})
              </h4>
            </div>

            <p className="text-xs text-slate-500">Kéo khung chữ nhật để chọn chính xác vùng chứa bức ảnh câu hỏi:</p>

            <div className="flex-1 overflow-auto bg-slate-900/90 rounded-2xl p-4 flex items-center justify-center relative min-h-[300px]">
              <div className="relative inline-block">
                <img
                  src={slots[croppingQNum].canvas.toDataURL('image/png')}
                  alt="Crop Preview"
                  className="max-h-[55vh] w-auto select-none"
                />
                {/* Simple crop box overlay indicator */}
                <div
                  style={{
                    left: `${(cropBox.x / slots[croppingQNum].canvas.width) * 100}%`,
                    top: `${(cropBox.y / slots[croppingQNum].canvas.height) * 100}%`,
                    width: `${(cropBox.width / slots[croppingQNum].canvas.width) * 100}%`,
                    height: `${(cropBox.height / slots[croppingQNum].canvas.height) * 100}%`,
                  }}
                  className="absolute border-2 border-ori-400 bg-ori-500/20 shadow-2xl cursor-move flex items-center justify-center"
                >
                  <span className="bg-ori-600 text-white font-extrabold text-[10px] px-2 py-0.5 rounded">Vùng chọn Q{croppingQNum}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const w = slots[croppingQNum].canvas.width;
                    const h = slots[croppingQNum].canvas.height;
                    setCropBox({ x: Math.floor(w * 0.1), y: Math.floor(h * 0.1), width: Math.floor(w * 0.8), height: Math.floor(h * 0.6) });
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg"
                >
                  Vùng rộng
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const w = slots[croppingQNum].canvas.width;
                    const h = slots[croppingQNum].canvas.height;
                    setCropBox({ x: Math.floor(w * 0.2), y: Math.floor(h * 0.2), width: Math.floor(w * 0.6), height: Math.floor(h * 0.4) });
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg"
                >
                  Vùng vừa
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCroppingQNum(null)}
                  className="px-4 py-2 text-xs font-extrabold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCrop}
                  className="px-5 py-2 text-xs font-extrabold text-white bg-ori-600 rounded-xl hover:bg-ori-500 shadow-md"
                >
                  Xác nhận vùng ảnh
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
