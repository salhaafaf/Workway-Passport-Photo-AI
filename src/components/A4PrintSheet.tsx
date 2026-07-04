import React, { useRef, useEffect } from "react";
import { PassportSize } from "../types";
import { FileDown, Printer, Share2 } from "lucide-react";
import { jsPDF } from "jspdf";

interface A4PrintSheetProps {
  processedPhotoUrl: string;
  size: PassportSize;
  onSaveJpg: () => void;
  onSavePng: () => void;
}

export default function A4PrintSheet({
  processedPhotoUrl,
  size,
  onSaveJpg,
  onSavePng,
}: A4PrintSheetProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const columns = 4;
  const rows = 8;
  const totalPhotos = columns * rows; // 32 photos

  useEffect(() => {
    if (!processedPhotoUrl) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // Clear canvas
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw header text (A4 sheet header info)
      ctx.fillStyle = "#475569";
      ctx.font = "bold 14px 'Inter', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("AI PASSPORT STUDIO - PRINT-READY A4 SHEET", canvas.width / 2, 35);
      
      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.fillText(
        `Size: ${size === "35x45" ? "35x45 mm (EU/UK)" : "2x2 in (US)"} | Quantity: 32 Photos | Margin: 12px`,
        canvas.width / 2,
        52
      );

      // Draw boundary border of the A4 page sheet
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(15, 75, canvas.width - 30, canvas.height - 95);
      ctx.setLineDash([]);

      // Draw the grid of 32 passport photos
      // A4 canvas dims: 595 x 842 (standard 72 DPI ratio) or we can draw custom
      // We'll calculate columns and spacing
      const gridStartX = 40;
      const gridStartY = 100;
      const availableWidth = canvas.width - gridStartX * 2;
      const availableHeight = canvas.height - gridStartY - 40;

      // Photo size relative to selection
      const photoW = size === "35x45" ? 105 : 115;
      const photoH = size === "35x45" ? 135 : 115;

      const gapX = (availableWidth - (columns * photoW)) / (columns - 1);
      const gapY = (availableHeight - (rows * photoH)) / (rows - 1);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < columns; c++) {
          const x = gridStartX + c * (photoW + gapX);
          const y = gridStartY + r * (photoH + gapY);

          // Draw passport photo image
          ctx.drawImage(img, x, y, photoW, photoH);

          // Draw dashed guide borders (cut lines)
          ctx.strokeStyle = "#94a3b8";
          ctx.lineWidth = 0.5;
          ctx.setLineDash([2, 2]);
          ctx.strokeRect(x, y, photoW, photoH);
          ctx.setLineDash([]);

          // Draw corner ticks/cut marks for ease of manual trimming with scissors
          ctx.strokeStyle = "#475569";
          ctx.lineWidth = 1;

          // Top Left
          ctx.beginPath();
          ctx.moveTo(x - 3, y); ctx.lineTo(x + 5, y);
          ctx.moveTo(x, y - 3); ctx.lineTo(x, y + 5);
          ctx.stroke();

          // Top Right
          ctx.beginPath();
          ctx.moveTo(x + photoW - 5, y); ctx.lineTo(x + photoW + 3, y);
          ctx.moveTo(x + photoW, y - 3); ctx.lineTo(x + photoW, y + 5);
          ctx.stroke();

          // Bottom Left
          ctx.beginPath();
          ctx.moveTo(x - 3, y + photoH); ctx.lineTo(x + 5, y + photoH);
          ctx.moveTo(x, y + photoH - 5); ctx.lineTo(x, y + photoH + 3);
          ctx.stroke();

          // Bottom Right
          ctx.beginPath();
          ctx.moveTo(x + photoW - 5, y + photoH); ctx.lineTo(x + photoW + 3, y + photoH);
          ctx.moveTo(x + photoW, y + photoH - 5); ctx.lineTo(x + photoW, y + photoH + 3);
          ctx.stroke();
        }
      }
    };
    img.src = processedPhotoUrl;
  }, [processedPhotoUrl, size]);

  const handleDownloadPdf = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // A4 specs: 210mm x 297mm
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const dataUrl = canvas.toDataURL("image/jpeg", 1.0);
    // Add page-wide image to fit standard printable A4 margins
    doc.addImage(dataUrl, "JPEG", 0, 0, 210, 297);
    doc.save("passport_photos_a4_print.pdf");
  };

  const handlePrint = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const windowPrint = window.open("");
    if (windowPrint) {
      windowPrint.document.write(
        `<img src="${dataUrl}" style="width:100%; max-width:210mm; display:block; margin:0 auto;" onLoad="window.print();window.close()"/>`
      );
      windowPrint.document.close();
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col items-center shadow-2xl relative mt-8">
      
      {/* Bento Badge */}
      <div className="absolute top-4 left-6 bg-blue-600/20 border border-blue-500/30 text-blue-400 text-[9px] font-bold tracking-widest px-2.5 py-1 rounded-md uppercase">
        Print Output Grid
      </div>

      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between w-full mt-6 mb-8 gap-6 border-b border-slate-800 pb-6">
        <div>
          <h3 className="text-lg font-bold text-white">Printable A4 Grid Preview</h3>
          <p className="text-xs text-slate-400 mt-0.5">Perfect 32-photo layout with professional corner-cut guide marks</p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={onSaveJpg}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs px-4 py-2.5 rounded-2xl transition shadow-inner"
          >
            <FileDown className="w-3.5 h-3.5 text-blue-400" />
            <span>Single JPG</span>
          </button>
          <button
            onClick={onSavePng}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs px-4 py-2.5 rounded-2xl transition shadow-inner"
          >
            <FileDown className="w-3.5 h-3.5 text-emerald-400" />
            <span>Single PNG</span>
          </button>
          <button
            onClick={handleDownloadPdf}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-2xl shadow-lg shadow-blue-500/20 transition"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Save A4 PDF</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs px-4 py-2.5 rounded-2xl transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Sheet</span>
          </button>
        </div>
      </div>

      {/* Interactive A4 Sheet Canvas Display */}
      <div className="relative border-[6px] border-slate-850 shadow-2xl rounded-2xl bg-white overflow-hidden max-w-full">
        {/* Rulers representing metric dimensions */}
        <div className="absolute top-0 left-0 right-0 h-4 bg-slate-950 border-b border-slate-850 flex items-center justify-between px-6 text-[8px] font-mono text-slate-500 select-none">
          <span>0mm</span><span>50mm</span><span>100mm</span><span>150mm</span><span>200mm</span><span>210mm (A4 Width)</span>
        </div>
        <div className="absolute top-4 left-0 bottom-0 w-4 bg-slate-950 border-r border-slate-850 flex flex-col justify-between py-6 text-[8px] font-mono text-slate-500 select-none items-center">
          <span>0</span><span>100</span><span>200</span><span>297mm</span>
        </div>

        <div className="pt-4 pl-4 overflow-auto max-w-[340px] xs:max-w-[400px] sm:max-w-full">
          {/* Canvas dimensions set to standard high-resolution display ratio for correct drawing */}
          <canvas
            ref={canvasRef}
            width={595}
            height={842}
            className="block shadow bg-white"
            style={{ width: "420px", height: "595px" }}
          />
        </div>
      </div>
    </div>
  );
}
