import React, { useState } from "react";
import { FlutterFile } from "../types";
import { Folder, FileCode, Check, Copy, Download, FolderOpen } from "lucide-react";

interface CodeExplorerProps {
  files: FlutterFile[];
  onDownloadZip: () => void;
  isZipping: boolean;
}

export default function CodeExplorer({ files, onDownloadZip, isZipping }: CodeExplorerProps) {
  const [selectedFilePath, setSelectedFilePath] = useState<string>(files[0]?.path || "");
  const [copied, setCopied] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    "root": true,
    "lib": true,
    "lib/screens": true,
    "lib/services": true,
    "android": true,
    "android/app": true,
    "android/app/src/main": true,
  });

  const selectedFile = files.find((f) => f.path === selectedFilePath) || files[0];

  const handleCopy = () => {
    if (selectedFile) {
      navigator.clipboard.writeText(selectedFile.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const toggleFolder = (folder: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folder]: !prev[folder],
    }));
  };

  // Group files by directory
  const directories: Record<string, FlutterFile[]> = {};
  files.forEach((file) => {
    const parts = file.path.split("/");
    const dir = parts.slice(0, -1).join("/") || "root";
    if (!directories[dir]) {
      directories[dir] = [];
    }
    directories[dir].push(file);
  });

  const renderFolderItem = (folderName: string, path: string, displayName: string) => {
    const isExpanded = !!expandedFolders[path];
    return (
      <div key={path} className="select-none">
        <button
          onClick={() => toggleFolder(path)}
          className="flex items-center gap-2 w-full text-left py-1.5 px-2 hover:bg-slate-100 rounded text-slate-700 text-sm font-medium transition"
        >
          {isExpanded ? (
            <FolderOpen className="w-4 h-4 text-amber-500 fill-amber-100" />
          ) : (
            <Folder className="w-4 h-4 text-amber-500 fill-amber-100" />
          )}
          <span>{displayName}</span>
        </button>
        {isExpanded && (
          <div className="pl-4 border-l border-slate-200 ml-3 mt-0.5 space-y-0.5">
            {directories[path]?.map((file) => (
              <button
                key={file.path}
                onClick={() => setSelectedFilePath(file.path)}
                className={`flex items-center gap-2 w-full text-left py-1 px-2 rounded text-xs transition ${
                  selectedFilePath === file.path
                    ? "bg-blue-50 text-blue-600 font-semibold border-l-2 border-blue-500 pl-1.5"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <FileCode className={`w-3.5 h-3.5 ${selectedFilePath === file.path ? 'text-blue-500' : 'text-slate-400'}`} />
                <span className="truncate">{file.name}</span>
              </button>
            ))}
            {/* Render nested subfolders */}
            {Object.keys(directories)
              .filter((dirPath) => dirPath.startsWith(path + "/") && dirPath.split("/").length === path.split("/").length + 1)
              .map((subPath) => {
                const parts = subPath.split("/");
                return renderFolderItem(parts[parts.length - 1], subPath, parts[parts.length - 1]);
              })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-white rounded-2xl border border-slate-100 shadow-xl overflow-hidden p-6">
      {/* File Explorer Tree Panel */}
      <div className="lg:col-span-4 flex flex-col border-r border-slate-100 pr-4">
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Flutter Workspace</h2>
            <p className="text-xs text-slate-500">Official Flutter Android Package</p>
          </div>
          <button
            onClick={onDownloadZip}
            disabled={isZipping}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-semibold px-3 py-2 rounded-lg shadow-sm transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isZipping ? "Creating ZIP..." : "Download ZIP"}</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto max-h-[500px] space-y-1 pr-2">
          {/* Root Level Files */}
          {directories["root"]?.map((file) => (
            <button
              key={file.path}
              onClick={() => setSelectedFilePath(file.path)}
              className={`flex items-center gap-2 w-full text-left py-1.5 px-2 rounded text-sm transition ${
                selectedFilePath === file.path
                  ? "bg-blue-50 text-blue-600 font-semibold border-l-2 border-blue-500 pl-1.5"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <FileCode className={`w-4 h-4 ${selectedFilePath === file.path ? 'text-blue-500' : 'text-slate-400'}`} />
              <span>{file.name}</span>
            </button>
          ))}

          {/* Root Level Folders */}
          {renderFolderItem("lib", "lib", "lib/")}
          {renderFolderItem("android", "android", "android/")}
        </div>
      </div>

      {/* Code Viewer Panel */}
      <div className="lg:col-span-8 flex flex-col bg-slate-900 rounded-xl overflow-hidden border border-slate-800 min-h-[550px]">
        {/* Editor Title Bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-950/60 border-b border-slate-800 text-slate-300 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500" />
            <span className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="ml-2 font-semibold text-slate-400">{selectedFile?.path}</span>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white px-2.5 py-1.5 rounded-md transition"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Code</span>
              </>
            )}
          </button>
        </div>

        {/* Code Block */}
        <div className="flex-1 p-4 overflow-auto font-mono text-xs text-slate-300 leading-relaxed max-h-[480px]">
          <pre className="whitespace-pre-wrap selection:bg-blue-500/30">
            <code>{selectedFile?.content}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
