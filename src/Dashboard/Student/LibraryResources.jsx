import React, { useState } from "react";
import {
  Search,
  BookOpen,
  UploadCloud,
  Loader2,
  Pencil,
  Trash2,
  X,
  ExternalLink,
} from "lucide-react";
import { toast } from "react-toastify";
import api, { resolveMediaUrl } from "../../api/client";
import EmptyState from "../../Component/EmptyState";

const LEVEL_OPTIONS = [
  "Primary 1",
  "Primary 2",
  "Primary 3",
  "Primary 4",
  "Primary 5",
  "Primary 6",
  "Senior 1",
  "Senior 2",
  "Senior 3",
  "Senior 4",
  "Senior 5",
  "Senior 6",
  "Year 1",
  "Year 2",
  "Year 3",
  "Level 3",
  "Level 4",
  "Level 5",
];

const LibraryResources = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("All");
  const [resources, setResources] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    name: "",
    subject: "",
    resourceDate: "",
    levels: [],
  });
  const [uploadFile, setUploadFile] = useState(null);
  const [editResource, setEditResource] = useState(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const subjects = [
    "All",
    ...Array.from(
      new Set(resources.map((resource) => resource.subject).filter(Boolean)),
    ),
  ];

  React.useEffect(() => {
    let isMounted = true;
    const loadResources = async () => {
      try {
        const { data } = await api.get("/library/resources");
        if (isMounted && Array.isArray(data?.resources)) {
          setResources(data.resources);
        }
      } catch (err) {
        console.error("Failed to load library resources", err);
        toast.error("Failed to load library resources.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadResources();
    return () => {
      isMounted = false;
    };
  }, []);

  const toggleLevel = (levels, level) =>
    levels.includes(level)
      ? levels.filter((item) => item !== level)
      : [...levels, level];

  const filteredResources = resources.filter(
    (resource) =>
      (selectedSubject === "All" || resource.subject === selectedSubject) &&
      (resource.name || "").toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadForm.name || !uploadForm.subject) {
      toast.error("Please provide name and subject.");
      return;
    }
    if (!uploadFile) {
      toast.error("Please select a file.");
      return;
    }
    if (!uploadForm.levels || uploadForm.levels.length === 0) {
      toast.error("Please select at least one level.");
      return;
    }
    setIsUploading(true);
    try {
      const payload = new FormData();
      payload.append("name", uploadForm.name);
      payload.append("subject", uploadForm.subject);
      if (uploadForm.resourceDate) {
        payload.append("resourceDate", uploadForm.resourceDate);
      }
      payload.append("levels", JSON.stringify(uploadForm.levels || []));
      payload.append("file", uploadFile);
      const { data } = await api.post("/library/resources", payload);
      if (data?.resource) {
        setResources((prev) => [data.resource, ...prev]);
      }
      setUploadForm({ name: "", subject: "", resourceDate: "", levels: [] });
      setUploadFile(null);
      setIsUploadOpen(false);
      toast.success("Resource uploaded!");
    } catch (err) {
      console.error("Failed to upload resource", err);
      toast.error("Failed to upload resource.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (resourceId) => {
    if (!resourceId) return;
    const ok = window.confirm("Delete this resource?");
    if (!ok) return;
    try {
      await api.delete(`/library/resources/${resourceId}`);
      setResources((prev) => prev.filter((r) => r.id !== resourceId));
      toast.success("Resource removed.");
    } catch (err) {
      console.error("Failed to delete resource", err);
      toast.error("Failed to delete resource.");
    }
  };

  const handleSaveEdit = async () => {
    if (!editResource?.id) return;
    setIsSavingEdit(true);
    try {
      const { data } = await api.patch(`/library/resources/${editResource.id}`, {
        name: editResource.name,
        subject: editResource.subject,
        levels: editResource.levels || [],
      });
      if (data?.resource) {
        setResources((prev) =>
          prev.map((item) =>
            item.id === editResource.id ? data.resource : item,
          ),
        );
      }
      setEditResource(null);
      toast.success("Resource updated.");
    } catch (err) {
      console.error("Failed to update resource", err);
      toast.error("Failed to update resource.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 relative">
        <main className="flex-1 overflow-y-auto p-8 lg:p-12">
          <div className="max-w-7xl mx-auto space-y-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h1 className="text-4xl font-black text-slate-900 tracking-tight">
                  Library Resources
                </h1>
                <p className="text-sm text-slate-500 font-semibold mt-2">
                  Everyone can add resources, edit, or remove their own uploads.
                </p>
              </div>
              <button
                onClick={() => setIsUploadOpen(true)}
                className="inline-flex items-center gap-2 px-6 py-4 bg-black text-white rounded-[1.5rem] font-black text-sm shadow-lg shadow-slate-200"
              >
                <UploadCloud size={18} /> Upload Resource
              </button>
            </div>

            <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-2 overflow-x-auto w-full pb-2 lg:pb-0 scrollbar-hide">
                {subjects.map((sub) => (
                  <button
                    key={sub}
                    onClick={() => setSelectedSubject(sub)}
                    className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
                      selectedSubject === sub
                        ? "bg-[#2D70FD] text-white"
                        : "bg-white text-slate-500 border border-slate-200"
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
              <div className="relative w-full lg:w-96">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  size={20}
                />
                <input
                  type="text"
                  placeholder="Search resources..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-6 py-3.5 bg-white border-2 border-slate-100 rounded-2xl outline-none focus:border-[#2D70FD] font-medium"
                />
              </div>
            </div>

            {resources.length === 0 ? (
              <EmptyState />
            ) : filteredResources.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-8">
                {filteredResources.map((resource) => (
                  <div
                    key={resource.id}
                    className="bg-white border border-slate-100 rounded-[2.5rem] p-8 hover:border-blue-200 transition-all group"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-[#2D70FD]">
                        <BookOpen size={28} />
                      </div>
                      <div className="text-[10px] font-black text-slate-400 bg-slate-50 px-3 py-1 rounded-lg">
                        {resource.type}
                      </div>
                    </div>
                    <h3 className="font-black text-slate-800 text-lg mb-1">
                      {resource.name}
                    </h3>
                    <p className="text-sm font-bold text-slate-400 mb-4">
                          {resource.subject} • {resource.size}
                        </p>
                        {resource.levels?.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-4">
                            {resource.levels.slice(0, 3).map((level) => (
                              <span
                                key={`${resource.id}-${level}`}
                                className="px-2.5 py-1 rounded-full bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-wide"
                              >
                                {level}
                              </span>
                            ))}
                            {resource.levels.length > 3 && (
                              <span className="px-2.5 py-1 rounded-full bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-wide">
                                +{resource.levels.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                        <p className="text-xs font-bold text-slate-400 mb-6">
                          Uploaded by {resource.uploadedBy}
                        </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          const target = resolveMediaUrl(resource.url);
                          if (target) window.open(target, "_blank", "noopener");
                        }}
                        className="flex-1 py-3 bg-blue-50 text-[#2D70FD] rounded-2xl font-black text-xs flex items-center justify-center gap-2 hover:bg-blue-100 transition-all"
                      >
                        <ExternalLink size={16} /> View
                      </button>
                      {resource.canEdit && (
                        <>
                          <button
                            onClick={() =>
                              setEditResource({
                                ...resource,
                                levels: resource.levels || [],
                              })
                            }
                            className="px-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-500 hover:text-slate-800 transition-all"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(resource.id)}
                            className="px-4 py-3 bg-white border border-slate-200 rounded-2xl text-rose-500 hover:text-rose-600 transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {isUploadOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setIsUploadOpen(false)}
          />
          <div className="relative bg-white w-full max-w-lg rounded-[2rem] shadow-2xl p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-slate-900">
                Upload Resource
              </h2>
              <button
                onClick={() => setIsUploadOpen(false)}
                className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500">
                  Resource Name
                </label>
                <input
                  value={uploadForm.name}
                  onChange={(e) =>
                    setUploadForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full mt-2 px-4 py-3 rounded-2xl border border-slate-200 font-medium"
                  placeholder="Resource name"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">
                  Subject
                </label>
                <input
                  value={uploadForm.subject}
                  onChange={(e) =>
                    setUploadForm((prev) => ({
                      ...prev,
                      subject: e.target.value,
                    }))
                  }
                  className="w-full mt-2 px-4 py-3 rounded-2xl border border-slate-200 font-medium"
                  placeholder="Subject"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">
                  Levels (select one or more)
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  {LEVEL_OPTIONS.map((level) => {
                    const isSelected = uploadForm.levels.includes(level);
                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() =>
                          setUploadForm((prev) => ({
                            ...prev,
                            levels: toggleLevel(prev.levels, level),
                          }))
                        }
                        className={`px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wide border transition-all ${
                          isSelected
                            ? "bg-[#2D70FD] text-white border-[#2D70FD]"
                            : "bg-white text-slate-500 border-slate-200"
                        }`}
                      >
                        {level}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">
                  Resource Date (optional)
                </label>
                <input
                  type="date"
                  value={uploadForm.resourceDate}
                  onChange={(e) =>
                    setUploadForm((prev) => ({
                      ...prev,
                      resourceDate: e.target.value,
                    }))
                  }
                  className="w-full mt-2 px-4 py-3 rounded-2xl border border-slate-200 font-medium"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">
                  File
                </label>
                <input
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full mt-2 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={isUploading}
                className="w-full mt-4 py-4 bg-black text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isUploading ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <>
                    <UploadCloud size={18} /> Upload
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {editResource && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setEditResource(null)}
          />
          <div className="relative bg-white w-full max-w-lg rounded-[2rem] shadow-2xl p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-slate-900">
                Edit Resource
              </h2>
              <button
                onClick={() => setEditResource(null)}
                className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500">
                  Resource Name
                </label>
                <input
                  value={editResource.name}
                  onChange={(e) =>
                    setEditResource((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  className="w-full mt-2 px-4 py-3 rounded-2xl border border-slate-200 font-medium"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">
                  Subject
                </label>
                <input
                  value={editResource.subject}
                  onChange={(e) =>
                    setEditResource((prev) => ({
                      ...prev,
                      subject: e.target.value,
                    }))
                  }
                  className="w-full mt-2 px-4 py-3 rounded-2xl border border-slate-200 font-medium"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">
                  Levels (select one or more)
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  {LEVEL_OPTIONS.map((level) => {
                    const isSelected = editResource.levels?.includes(level);
                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() =>
                          setEditResource((prev) => ({
                            ...prev,
                            levels: toggleLevel(prev.levels || [], level),
                          }))
                        }
                        className={`px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wide border transition-all ${
                          isSelected
                            ? "bg-[#2D70FD] text-white border-[#2D70FD]"
                            : "bg-white text-slate-500 border-slate-200"
                        }`}
                      >
                        {level}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="w-full mt-4 py-4 bg-black text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isSavingEdit ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <>
                    <Pencil size={18} /> Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LibraryResources;
