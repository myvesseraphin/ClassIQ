import React, { useState } from "react";
import {
  Search,
  FileText,
  Download,
  BookOpen,
  LayoutGrid,
  List,
  Filter,
  X,
  Eye,
  ExternalLink,
} from "lucide-react";
import { toast } from "react-toastify";
import api from "../../api/client";
import EmptyState from "../../Component/EmptyState";
import StudentPageSkeleton from "../../Component/StudentPageSkeleton";

const Resources = () => {
  const [viewMode, setViewMode] = useState("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("All");
  const [selectedFile, setSelectedFile] = useState(null);
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const apiBase = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
  const fileOrigin = apiBase.replace(/\/api\/?$/, "");

  const resolveResourceUrl = (file) => {
    if (!file?.url) return "";
    return file.url.startsWith("/") ? `${fileOrigin}${file.url}` : file.url;
  };

  const getFileExtension = (file) => {
    const url = resolveResourceUrl(file);
    const match = url.match(/\.([a-z0-9]+)(?:\?|#|$)/i);
    if (match) return match[1].toLowerCase();
    return "";
  };

  const isPdfFile = (file) => {
    const ext = getFileExtension(file);
    if (ext === "pdf") return true;
    return String(file?.type || "").toLowerCase().includes("pdf");
  };

  const isImageFile = (file) => {
    const ext = getFileExtension(file);
    if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return true;
    return String(file?.type || "").toLowerCase().includes("image");
  };

  const subjects = [
    "All",
    ...Array.from(new Set(files.map((file) => file.subject).filter(Boolean))),
  ];

  React.useEffect(() => {
    let isMounted = true;
    const loadResources = async () => {
      try {
        const { data } = await api.get("/student/resources");
        if (isMounted && Array.isArray(data?.resources)) {
          setFiles(data.resources);
        }
      } catch (err) {
        console.error("Failed to load resources", err);
        toast.error("Failed to load resources.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadResources();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleDownload = (file) => {
    if (file?.url) {
      const targetUrl = file.url.startsWith("/")
        ? `${fileOrigin}${file.url}`
        : file.url;
      const link = document.createElement("a");
      link.href = targetUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.download = file.name || "resource";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }
    const blob = new Blob(["ClassIQ Mock Resource Content"], {
      type: "application/pdf",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = file?.name?.endsWith(".pdf")
      ? file.name
      : `${file?.name || "resource"}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredFiles = files.filter(
    (f) =>
      (selectedSubject === "All" || f.subject === selectedSubject) &&
      (f.name || "").toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (isLoading) {
    return <StudentPageSkeleton variant="resources" />;
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 relative">
        <main className="flex-1 overflow-y-auto p-8 lg:p-12">
          <div className="max-w-7xl mx-auto space-y-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">
                Library Resources
              </h1>
              <div className="flex items-center gap-3 bg-white border-2 border-slate-100 p-1.5 rounded-2xl shadow-sm">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-bold text-sm ${viewMode === "grid" ? "bg-blue-50 text-[#2D70FD]" : "text-slate-400 hover:text-slate-600"}`}
                >
                  <LayoutGrid size={18} /> Grid
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-bold text-sm ${viewMode === "list" ? "bg-blue-50 text-[#2D70FD]" : "text-slate-400 hover:text-slate-600"}`}
                >
                  <List size={18} /> List
                </button>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-2 lg:pb-0 scrollbar-hide">
                <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400">
                  <Filter size={18} />
                </div>
                {subjects.map((sub) => (
                  <button
                    key={sub}
                    onClick={() => setSelectedSubject(sub)}
                    className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${selectedSubject === sub ? "bg-[#2D70FD] text-white shadow-lg shadow-blue-100" : "bg-white text-slate-500 border border-slate-200 hover:border-blue-100"}`}
                  >
                    {sub}
                  </button>
                ))}
              </div>

              <div className="relative w-full lg:w-96 group">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#2D70FD]"
                  size={20}
                />
                <input
                  type="text"
                  placeholder="Search materials..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-6 py-3.5 bg-white border-2 border-slate-100 rounded-2xl outline-none focus:border-[#2D70FD] transition-all font-medium text-slate-700 shadow-sm"
                />
              </div>
            </div>

            {files.length === 0 ? (
              <EmptyState />
            ) : filteredFiles.length === 0 ? (
              <EmptyState />
            ) : viewMode === "grid" ? (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-8">
                {filteredFiles.map((file) => (
                  <div
                    key={file.id}
                    className="bg-white border border-slate-100 rounded-[2.5rem] p-8 hover:border-blue-200 transition-all group relative overflow-hidden"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-[#2D70FD] group-hover:bg-blue-50 transition-colors">
                        <BookOpen size={28} />
                      </div>
                      <div className="px-3 py-1 bg-slate-50 rounded-lg text-[10px] font-black text-slate-400">
                        {file.type}
                      </div>
                    </div>
                    <h3 className="font-black text-slate-800 text-lg mb-1 leading-tight">
                      {file.name}
                    </h3>
                    <p className="text-sm font-bold text-slate-400 mb-8">
                      {file.subject}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setSelectedFile(file)}
                        className="py-4 bg-blue-50 text-[#2D70FD] rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-blue-100 transition-all"
                      >
                        <Eye size={18} /> View
                      </button>
                      <button
                        onClick={() => handleDownload(file)}
                        className="py-4 bg-[#2D70FD] text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:shadow-lg transition-all shadow-sm"
                      >
                        <Download size={18} /> Get
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-8 py-5 text-xs font-black text-slate-400 tracking-tight">
                        Name
                      </th>
                      <th className="px-8 py-5 text-xs font-black text-slate-400 tracking-tight">
                        Subject
                      </th>
                      <th className="px-8 py-5 text-xs font-black text-slate-400 tracking-tight">
                        Size
                      </th>
                      <th className="px-8 py-5 text-right pr-12">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredFiles.map((file) => (
                      <tr
                        key={file.id}
                        className="hover:bg-blue-50/20 transition-colors"
                      >
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className="p-2 bg-blue-50 rounded-lg text-[#2D70FD]">
                              <FileText size={18} />
                            </div>
                            <span className="font-bold text-slate-700">
                              {file.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-sm font-bold text-slate-500">
                          {file.subject}
                        </td>
                        <td className="px-8 py-6 text-sm font-bold text-slate-400">
                          {file.size}
                        </td>
                        <td className="px-8 py-6 text-right pr-12 space-x-2">
                          <button
                            onClick={() => setSelectedFile(file)}
                            className="p-3 bg-white border border-slate-100 text-[#2D70FD] rounded-xl hover:bg-blue-50 transition-all shadow-sm"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                          onClick={() => handleDownload(file)}
                            className="p-3 bg-white border border-slate-100 text-[#2D70FD] rounded-xl hover:bg-[#2D70FD] hover:text-white transition-all shadow-sm"
                          >
                            <Download size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>

        {selectedFile && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 md:p-12">
            <div
              className="absolute inset-0 bg-slate-900/30 backdrop-blur-md"
              onClick={() => setSelectedFile(null)}
            />
            <div className="relative bg-white w-full h-full max-w-6xl rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 text-[#2D70FD] rounded-2xl flex items-center justify-center">
                    <FileText size={24} />
                  </div>
                  <div>
                    <h2 className="font-black text-slate-800 text-xl leading-none">
                      {selectedFile.name}
                    </h2>
                    <p className="text-sm font-bold text-slate-400 mt-1">
                      {selectedFile.subject} • {selectedFile.size}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      if (selectedFile?.url) {
                        const targetUrl = resolveResourceUrl(selectedFile);
                        window.open(targetUrl, "_blank", "noopener");
                      }
                    }}
                    className="p-3 text-slate-400 hover:text-[#2D70FD] hover:bg-blue-50 rounded-xl transition-all"
                  >
                    <ExternalLink size={20} />
                  </button>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="p-3 bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="flex-1 bg-slate-50 p-6 md:p-10 overflow-hidden">
                <div className="w-full h-full bg-white rounded-[2rem] border border-slate-200 shadow-inner flex flex-col items-center justify-center text-center overflow-hidden">
                  {selectedFile?.url && isPdfFile(selectedFile) ? (
                    <iframe
                      title={selectedFile.name || "Resource Preview"}
                      src={resolveResourceUrl(selectedFile)}
                      className="w-full h-full"
                    />
                  ) : selectedFile?.url && isImageFile(selectedFile) ? (
                    <div className="w-full h-full flex items-center justify-center p-6">
                      <img
                        src={resolveResourceUrl(selectedFile)}
                        alt={selectedFile.name || "Resource Preview"}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-center p-10">
                      <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center text-[#2D70FD] mb-6">
                        <BookOpen size={48} />
                      </div>
                      <h3 className="text-2xl font-black text-slate-800 mb-2">
                        Preview not available
                      </h3>
                      <p className="text-slate-500 font-medium max-w-sm">
                        Open the file in a new tab to view it.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-8 bg-white border-t border-slate-100 flex justify-end items-center gap-6">
                <button
                  onClick={() => setSelectedFile(null)}
                  className="text-slate-500 font-bold hover:text-slate-900 transition-colors"
                >
                  Close Viewer
                </button>
                <button
                  onClick={() => handleDownload(selectedFile)}
                  className="px-10 py-4 bg-[#2D70FD] text-white rounded-[1.5rem] font-black shadow-lg shadow-blue-100 hover:scale-105 transition-all"
                >
                  Download Now
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Resources;
