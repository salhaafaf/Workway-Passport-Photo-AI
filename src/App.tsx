import React, { useState } from "react";
import { PassportSize, FlutterFile } from "./types";
import { FLUTTER_FILES } from "./data/flutterFiles";
import PassportStudio from "./components/PassportStudio";
import A4PrintSheet from "./components/A4PrintSheet";
import CodeExplorer from "./components/CodeExplorer";
import { Sparkles, Code, Layout, Download, FileDown, Check, AppWindow, Github, RefreshCw } from "lucide-react";
import JSZip from "jszip";

export default function App() {
  const [activeView, setActiveView] = useState<"studio" | "flutter">("studio");
  const [size, setSize] = useState<PassportSize>("35x45");
  const [processedPhoto, setProcessedPhoto] = useState<string>("");
  const [isZipping, setIsZipping] = useState(false);
  const [copiedZipUrl, setCopiedZipUrl] = useState(false);

  // Download entire Flutter Project as a ZIP
  const handleDownloadZip = async () => {
    setIsZipping(true);
    try {
      const zip = new JSZip();
      
      // Structure all flutter files into the zip
      FLUTTER_FILES.forEach((file) => {
        zip.file(file.path, file.content);
      });

      // Add a README to guide them on running inside Android Studio / Release APK
      zip.file("README.md", `# Passport Photo AI (Flutter Mobile App)

This is a complete, production-ready Flutter Android & iOS project generated with Passport Photo AI.

## Features Included
- On-device Face Detection (using package:google_ml_kit)
- Custom cropping aspect ratios (35x45mm & 2x2in)
- Solid background replacements (White / Sky Blue)
- Face lighting & skin smoothing enhancements
- Draggable formal Black Blazer & Tie overlay
- 32-Photo Printable A4 grid generator with crop/cut ticks
- Save as JPG, PNG, and PDF (via package:pdf)

## Requirements
- Flutter SDK (>= 3.0.0)
- Dart SDK (>= 3.0.0)
- Android Studio or VS Code with Flutter extension
- An Android Device or Emulator to compile

## Getting Started

1. Extract this ZIP file.
2. Open the project folder in **Android Studio**:
   \`\`\`bash
   cd passport_photo_ai
   flutter pub get
   \`\`\`
3. Run or Build Release APK:
   \`\`\`bash
   flutter build apk --release
   \`\`\`
   The compiled release APK will be saved at:
   \`build/app/outputs/flutter-apk/app-release.apk\`
`);

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "passport_photo_ai_flutter.zip";
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to generate Flutter source ZIP:", err);
    } finally {
      setIsZipping(false);
    }
  };

  // Download single processed passport photo crop
  const downloadSinglePhoto = (format: "png" | "jpeg") => {
    if (!processedPhoto) return;
    const link = document.createElement("a");
    link.href = processedPhoto;
    link.download = `passport_crop_${size}.${format}`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased">
      
      {/* Workspace Header Banner */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
                Passport Photo AI <span className="bg-blue-100 text-blue-700 text-[9px] font-mono tracking-widest font-extrabold uppercase px-2 py-0.5 rounded-full">v1.0 Pro</span>
              </h1>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-widest">
                Professional Biometric Tool
              </p>
            </div>
          </div>

          {/* Core Navigation Views */}
          <div className="flex items-center gap-2 bg-slate-100/80 border border-slate-200/60 p-1 rounded-2xl shadow-inner">
            <button
              onClick={() => setActiveView("studio")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all ${
                activeView === "studio"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Layout className="w-4 h-4" />
              <span>AI STUDIO WORKSPACE</span>
            </button>
            <button
              onClick={() => setActiveView("flutter")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all ${
                activeView === "flutter"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Code className="w-4 h-4" />
              <span>FLUTTER SOURCE CODE</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <main className="max-w-7xl mx-auto py-8 px-6 space-y-8">
        
        {activeView === "studio" ? (
          /* Active Passport Studio Workspace */
          <div className="space-y-8">
            {/* Split panels containing Studio configuration and Live previews */}
            <section>
              <PassportStudio
                onProcessedImageChange={setProcessedPhoto}
                selectedSize={size}
                onSizeChange={setSize}
              />
            </section>

            {/* A4 printable grid sheet generation panel */}
            {processedPhoto && (
              <section className="animate-fade-in">
                <A4PrintSheet
                  processedPhotoUrl={processedPhoto}
                  size={size}
                  onSaveJpg={() => downloadSinglePhoto("jpeg")}
                  onSavePng={() => downloadSinglePhoto("png")}
                />
              </section>
            )}
          </div>
        ) : (
          /* Full Flutter Android Source Explorer Panel */
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-900 to-indigo-950 border border-blue-800 text-white p-6 rounded-2xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <span className="bg-blue-800 text-[10px] font-mono font-black uppercase tracking-widest px-2.5 py-1 rounded-full">
                  Android Studio Ready
                </span>
                <h3 className="text-xl font-bold mt-2">Download Android & iOS Codebase</h3>
                <p className="text-xs text-blue-200 mt-1 leading-relaxed max-w-xl">
                  This complete package compiles a native Flutter app featuring MLKit, Canvas matting, PDF document compiler, and camera integration. Compile a Release APK directly!
                </p>
              </div>

              <button
                onClick={handleDownloadZip}
                disabled={isZipping}
                className="flex items-center gap-2 bg-white hover:bg-slate-50 text-indigo-950 font-bold text-sm px-6 py-3.5 rounded-xl shadow-lg hover:shadow-xl disabled:bg-slate-100 transition-all min-w-[200px] justify-center"
              >
                {isZipping ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
                    <span>Packaging Zip...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5 text-indigo-600" />
                    <span>Download Source ZIP</span>
                  </>
                )}
              </button>
            </div>

            <section>
              <CodeExplorer
                files={FLUTTER_FILES}
                onDownloadZip={handleDownloadZip}
                isZipping={isZipping}
              />
            </section>
          </div>
        )}

      </main>

      {/* Aesthetic Footer */}
      <footer className="bg-white border-t border-slate-100 py-6 text-center text-xs text-slate-400 font-medium">
        <p>© 2026 Passport Photo AI Suite. Engineered in standard React & full-stack Flutter compiler environment.</p>
      </footer>

    </div>
  );
}
