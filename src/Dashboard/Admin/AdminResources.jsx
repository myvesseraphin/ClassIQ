import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  BookOpen,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  LayoutGrid,
  List,
  Loader2,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import api from "../../api/client";
import EmptyState from "../../Component/EmptyState";

const AdminResources = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("All");
  const [selectedClass, setSelectedClass] = useState("All");
  const [selectedUnit, setSelectedUnit] = useState("All");
  const [selectedTopic, setSelectedTopic] = useState("All");
  const [resources, setResources] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 60;

  const [selectedResource, setSelectedResource] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const apiBase = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
  const fileOrigin = apiBase.replace(/\/api\/?$/, "");

  const requestedResourceId = String(searchParams.get("resourceId") || "").trim();

  const resolveResourceUrl = (resource) => {
    if (!resource?.url) return "";
    return resource.url.startsWith("/") ? `${fileOrigin}${resource.url}` : resource.url;
  };

  const getFileExtension = (resource) => {
    const url = resolveResourceUrl(resource);
    const match = url.match(/\.([a-z0-9]+)(?:\?|#|$)/i);
    if (match) return match[1].toLowerCase();
    return "";
  };

  const isPdfFile = (resource) => {
    const ext = getFileExtension(resource);
    if (ext === "pdf") return true;
    return String(resource?.type || "").toLowerCase().includes("pdf");
  };

  const isImageFile = (resource) => {
    const ext = getFileExtension(resource);
    if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return true;
    return String(resource?.type || "").toLowerCase().includes("image");
  };

  const subjects = useMemo(() => {
    const derived = Array.from(
      new Set(resources.map((r) => r.subject).filter(Boolean)),
    );
    return ["All", ...derived];
  }, [resources]);

  const classes = useMemo(() => {
    const derived = Array.from(
      new Set(resources.map((r) => r.className || r.class).filter(Boolean)),
    );
    return ["All", ...derived];
  }, [resources]);

  const units = useMemo(() => {
    const derived = Array.from(new Set(resources.map((r) => r.unit).filter(Boolean)));
    return ["All", ...derived];
  }, [resources]);

  const topics = useMemo(() => {
    const derived = Array.from(new Set(resources.map((r) => r.topic).filter(Boolean)));
    return ["All", ...derived];
  }, [resources]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);

    const timer = setTimeout(async () => {
      try {
        const offset = (page - 1) * pageSize;
        const { data } = await api.get("/admin/resources", {
          params: {
            subject: selectedSubject === "All" ? undefined : selectedSubject,
            className: selectedClass === "All" ? undefined : selectedClass,
            unit: selectedUnit === "All" ? undefined : selectedUnit,
            topic: selectedTopic === "All" ? undefined : selectedTopic,
            q: searchQuery.trim() || undefined,
            limit: pageSize,
            offset,
          },
        });

        if (!active) return;
        const incoming = Array.isArray(data?.resources) ? data.resources : [];
        setResources(incoming);
        setTotal(Number(data?.total) || 0);
      } catch (err) {
        console.error("Failed to load resources", err);
        toast.error("Failed to load resources.");
        if (active) {
          setResources([]);
          setTotal(0);
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [page, pageSize, searchQuery, selectedSubject, selectedClass, selectedUnit, selectedTopic]);

  useEffect(() => {
    if (!requestedResourceId || resources.length === 0) return;
    const match = resources.find((r) => r.id === requestedResourceId);
    if (match) {
      setSelectedResource(match);
    }
  }, [requestedResourceId, resources]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const openResource = (resource) => {
    setSelectedResource(resource);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("resourceId", resource.id);
      return next;
    });
  };

  const closeResource = () => {
    setSelectedResource(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("resourceId");
      return next;
    });
  };

  const requestDelete = (resource) => {
    setDeleteTarget(resource);
  };

  const cancelDelete = () => {
    setDeleteTarget(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget?.id) return;
    setIsDeleting(true);
    try {
      await api.delete(`/admin/resources/${deleteTarget.id}`);
      setResources((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setTotal((prev) => Math.max(0, Number(prev || 0) - 1));
      if (selectedResource?.id === deleteTarget.id) {
        closeResource();
      }
      toast.success("Resource deleted.");
      setDeleteTarget(null);
    } catch (err) {
      console.error("Failed to delete resource", err);
      toast.error(err?.response?.data?.error || "Failed to delete resource.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[55vh] w-full items-center justify-center bg-slate-50 rounded-[2rem]">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  return (
    <div className="w-full h-full animate-in fade-in duration-500 font-sans">
      <div className="max-w-7xl mx-auto space-y-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">
            Curriculum Resources
          </h1>
          <div className="flex items-center gap-3 bg-white border-2 border-slate-100 p-1.5 rounded-2xl shadow-sm">
            <button
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-bold text-sm ${
                viewMode === "grid"
                  ? "bg-blue-50 text-[#2D70FD]"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <LayoutGrid size={18} /> Grid
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-bold text-sm ${
                viewMode === "list"
                  ? "bg-blue-50 text-[#2D70FD]"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <List size={18} /> List
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="flex flex-wrap items-center gap-2 overflow-x-auto w-full lg:w-auto pb-2 lg:pb-0 scrollbar-hide">
            <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400">
              <Filter size={18} />
            </div>
            {subjects.map((sub) => (
              <button
                key={sub}
                onClick={() => {
                  setSelectedSubject(sub);
                  setPage(1);
                }}
                className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
                  selectedSubject === sub
                    ? "bg-[#2D70FD] text-white shadow-lg shadow-blue-100"
                    : "bg-white text-slate-500 border border-slate-200 hover:border-blue-100"
                }`}
              >
                {sub}
              </button>
            ))}
            <select
              value={selectedClass}
              onChange={(e) => {
                setSelectedClass(e.target.value);
                setPage(1);
              }}
              className="px-4 py-2.5 rounded-xl font-bold text-sm bg-white text-slate-500 border border-slate-200"
            >
              {classes.map((item) => (
                <option key={item} value={item}>
                  {item === "All" ? "All Classes" : item}
                </option>
              ))}
            </select>
            <select
              value={selectedUnit}
              onChange={(e) => {
                setSelectedUnit(e.target.value);
                setPage(1);
              }}
              className="px-4 py-2.5 rounded-xl font-bold text-sm bg-white text-slate-500 border border-slate-200"
            >
              {units.map((item) => (
                <option key={item} value={item}>
                  {item === "All" ? "All Units" : item}
                </option>
              ))}
            </select>
            <select
              value={selectedTopic}
              onChange={(e) => {
                setSelectedTopic(e.target.value);
                setPage(1);
              }}
              className="px-4 py-2.5 rounded-xl font-bold text-sm bg-white text-slate-500 border border-slate-200"
            >
              {topics.map((item) => (
                <option key={item} value={item}>
                  {item === "All" ? "All Topics" : item}
                </option>
              ))}
            </select>
          </div>

          <div className="relative w-full lg:w-96 group">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#2D70FD]"
              size={20}
            />
            <input
              type="text"
              placeholder="Search resources..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full pl-12 pr-6 py-3.5 bg-white border-2 border-slate-100 rounded-2xl outline-none focus:border-[#2D70FD] transition-all font-bold text-slate-700 shadow-sm"
            />
          </div>
        </div>

        {resources.length === 0 ? (
          <EmptyState />
        ) : viewMode === "grid" ? (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-8">
            {resources.map((resource) => (
              <div
                key={resource.id}
                className="bg-white border border-slate-100 rounded-[2.5rem] p-8 hover:border-blue-200 transition-all group relative overflow-hidden shadow-sm"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-[#2D70FD] group-hover:bg-blue-50 transition-colors">
                    <BookOpen size={28} />
                  </div>
                  <div className="px-3 py-1 bg-slate-50 rounded-lg text-[10px] font-black text-slate-400">
                    {resource.type || "FILE"}
                  </div>
                </div>
                <h3 className="font-black text-slate-800 text-lg mb-1 leading-tight line-clamp-2">
                  {resource.name}
                </h3>
                <p className="text-sm font-bold text-slate-400 mb-1">
                  {resource.subject || "Subject not set"}
                </p>
                <p className="text-xs font-bold text-slate-500 mb-1">
                  {resource.className || resource.class || "--"} | {resource.unit || "--"} |{" "}
                  {resource.topic || "--"}
                </p>
                <p className="text-xs font-bold text-slate-400 mb-8">
                  Uploaded by {resource.uploadedBy || "User"} | Downloads:{" "}
                  {Number(resource.downloads) || 0} | Classes used:{" "}
                  {Number(resource.classesUsedIn) || 0}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => openResource(resource)}
                    className="py-4 bg-blue-50 text-[#2D70FD] rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-blue-100 transition-all"
                  >
                    <Eye size={18} /> View
                  </button>
                  <button
                    onClick={() => requestDelete(resource)}
                    className="py-4 bg-white border border-slate-200 text-rose-600 rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-rose-50 transition-all"
                  >
                    <Trash2 size={18} /> Delete
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
                  <th className="px-8 py-5 text-xs font-black text-slate-400 tracking-tight uppercase">
                    Name
                  </th>
                  <th className="px-8 py-5 text-xs font-black text-slate-400 tracking-tight uppercase">
                    Subject
                  </th>
                  <th className="px-8 py-5 text-xs font-black text-slate-400 tracking-tight uppercase">
                    Curriculum Link
                  </th>
                  <th className="px-8 py-5 text-xs font-black text-slate-400 tracking-tight uppercase">
                    Usage
                  </th>
                  <th className="px-8 py-5 text-xs font-black text-slate-400 tracking-tight uppercase">
                    Date
                  </th>
                  <th className="px-8 py-5 text-right pr-12">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {resources.map((resource) => (
                  <tr
                    key={resource.id}
                    className="hover:bg-blue-50/20 transition-colors"
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="p-2 bg-blue-50 rounded-lg text-[#2D70FD] shrink-0">
                          <FileText size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-700 truncate">
                            {resource.name}
                          </p>
                          <p className="text-[11px] font-bold text-slate-400">
                            {resource.type || "FILE"} {resource.size ? `| ${resource.size}` : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-sm font-bold text-slate-500">
                      {resource.subject || "--"}
                    </td>
                    <td className="px-8 py-6 text-sm font-bold text-slate-500">
                      {(resource.className || resource.class || "--") + " | " + (resource.unit || "--") + " | " + (resource.topic || "--")}
                    </td>
                    <td className="px-8 py-6 text-sm font-bold text-slate-500">
                      {`Downloads: ${Number(resource.downloads) || 0} | Classes: ${Number(resource.classesUsedIn) || 0}`}
                    </td>
                    <td className="px-8 py-6 text-sm font-bold text-slate-400">
                      {resource.date || "--"}
                    </td>
                    <td className="px-8 py-6 text-right pr-12 space-x-2">
                      <button
                        onClick={() => openResource(resource)}
                        className="p-3 bg-white border border-slate-100 text-[#2D70FD] rounded-xl hover:bg-blue-50 transition-all shadow-sm"
                        aria-label="View resource"
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        onClick={() => {
                          const url = resolveResourceUrl(resource);
                          if (url) window.open(url, "_blank", "noopener");
                        }}
                        className="p-3 bg-white border border-slate-100 text-[#2D70FD] rounded-xl hover:bg-blue-50 transition-all shadow-sm"
                        aria-label="Open in new tab"
                      >
                        <ExternalLink size={18} />
                      </button>
                      <button
                        onClick={() => requestDelete(resource)}
                        className="p-3 bg-white border border-slate-100 text-rose-600 rounded-xl hover:bg-rose-50 transition-all shadow-sm"
                        aria-label="Delete resource"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-6 bg-white border-t border-slate-100">
              <p className="text-xs font-bold text-slate-500">
                Page {page} of {totalPages} | {total} resource(s)
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={!canPrev}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-black text-xs uppercase tracking-widest disabled:opacity-50"
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={!canNext}
                  className="px-4 py-2 rounded-xl bg-[#2D70FD] text-white font-black text-xs uppercase tracking-widest disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedResource ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 md:p-12">
          <div
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-md"
            onClick={closeResource}
          />
          <div className="relative bg-white w-full h-full max-w-6xl rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 bg-blue-50 text-[#2D70FD] rounded-2xl flex items-center justify-center shrink-0">
                  <FileText size={24} />
                </div>
                <div className="min-w-0">
                  <h2 className="font-black text-slate-800 text-xl leading-none truncate">
                    {selectedResource.name}
                  </h2>
                  <p className="text-sm font-bold text-slate-400 mt-1 truncate">
                    {selectedResource.subject}
                    {selectedResource.size ? ` | ${selectedResource.size}` : ""}
                    {selectedResource.type ? ` | ${selectedResource.type}` : ""}
                  </p>
                  <p className="text-xs font-bold text-slate-500 mt-1 truncate">
                    {(selectedResource.className || selectedResource.class || "--") +
                      " | " +
                      (selectedResource.unit || "--") +
                      " | " +
                      (selectedResource.topic || "--")}
                  </p>
                  <p className="text-xs font-bold text-slate-400 mt-1 truncate">
                    Downloads: {Number(selectedResource.downloads) || 0} | Classes used:{" "}
                    {Number(selectedResource.classesUsedIn) || 0}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const url = resolveResourceUrl(selectedResource);
                    if (url) window.open(url, "_blank", "noopener");
                  }}
                  className="p-3 text-slate-400 hover:text-[#2D70FD] hover:bg-blue-50 rounded-xl transition-all"
                  aria-label="Open resource"
                >
                  <ExternalLink size={20} />
                </button>
                <button
                  onClick={() => requestDelete(selectedResource)}
                  className="p-3 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                  aria-label="Delete resource"
                >
                  <Trash2 size={20} />
                </button>
                <button
                  onClick={closeResource}
                  className="p-3 bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all"
                  aria-label="Close viewer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-50 p-6 md:p-10 overflow-hidden">
              <div className="w-full h-full bg-white rounded-[2rem] border border-slate-200 shadow-inner flex flex-col items-center justify-center text-center overflow-hidden">
                {resolveResourceUrl(selectedResource) && isPdfFile(selectedResource) ? (
                  <iframe
                    title={selectedResource.name || "Resource Preview"}
                    src={resolveResourceUrl(selectedResource)}
                    className="w-full h-full"
                  />
                ) : resolveResourceUrl(selectedResource) && isImageFile(selectedResource) ? (
                  <div className="w-full h-full flex items-center justify-center p-6">
                    <img
                      src={resolveResourceUrl(selectedResource)}
                      alt={selectedResource.name || "Resource Preview"}
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
                onClick={closeResource}
                className="text-slate-500 font-bold hover:text-slate-900 transition-colors"
              >
                Close Viewer
              </button>
              <button
                onClick={() => {
                  const url = resolveResourceUrl(selectedResource);
                  if (url) window.open(url, "_blank", "noopener");
                }}
                className="px-10 py-4 bg-[#2D70FD] text-white rounded-[1.5rem] font-black shadow-lg shadow-blue-100 hover:scale-105 transition-all"
              >
                <Download size={18} className="inline -mt-0.5 mr-2" />
                Download
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-6">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => {
              if (!isDeleting) cancelDelete();
            }}
          />
          <div className="relative w-full max-w-md rounded-[2rem] bg-white border border-slate-100 shadow-2xl p-8">
            <h3 className="text-2xl font-black text-slate-900">
              Delete resource?
            </h3>
            <p className="mt-3 text-sm font-medium text-slate-500">
              This will remove the resource from the library. If the file exists in
              storage, it will be deleted as well.
            </p>
            <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <p className="text-sm font-black text-slate-800 line-clamp-2">
                {deleteTarget.name}
              </p>
              <p className="text-xs font-bold text-slate-400 mt-1">
                {deleteTarget.subject}
              </p>
            </div>
            <div className="mt-8 flex justify-end gap-3">
              <button
                onClick={cancelDelete}
                disabled={isDeleting}
                className="px-5 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-5 py-3 rounded-xl bg-rose-600 text-white font-black disabled:opacity-60"
              >
                {isDeleting ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminResources;
