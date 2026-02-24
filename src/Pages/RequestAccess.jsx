import React, { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Loader2, ChevronLeft, Search, Check, X } from "lucide-react";
import { toast } from "react-toastify";
import api from "../api/client";
import logo from "../assets/logo.png";
import loginIllustration from "../assets/Login.png";

const RequestAccess = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
  });
  const [schoolQuery, setSchoolQuery] = useState("");
  const [schoolResults, setSchoolResults] = useState([]);
  const [schoolOpen, setSchoolOpen] = useState(false);
  const [schoolLoading, setSchoolLoading] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const schoolRef = useRef(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    if (!schoolOpen) return undefined;
    const handleClick = (event) => {
      if (!schoolRef.current) return;
      if (!schoolRef.current.contains(event.target)) {
        setSchoolOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [schoolOpen]);

  useEffect(() => {
    if (!schoolOpen) return undefined;
    const timer = setTimeout(async () => {
      setSchoolLoading(true);
      try {
        const { data } = await api.get("/auth/schools", {
          params: { q: schoolQuery.trim(), limit: 8 },
        });
        setSchoolResults(data?.schools || []);
      } catch (err) {
        setSchoolResults([]);
      } finally {
        setSchoolLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [schoolQuery, schoolOpen]);

  const handleSchoolChange = (e) => {
    const value = e.target.value;
    setSchoolQuery(value);
    setSelectedSchool(null);
    setSchoolOpen(true);
  };

  const handleSchoolSelect = (school) => {
    setSelectedSchool(school);
    setSchoolQuery(school.name);
    setSchoolOpen(false);
  };

  const clearSchool = () => {
    setSelectedSchool(null);
    setSchoolQuery("");
    setSchoolResults([]);
    setSchoolOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const trimmedSchool = schoolQuery.trim();
      if (!trimmedSchool) {
        toast.error("School is required.");
        setLoading(false);
        return;
      }

      let attachmentUrl;
      let attachmentName;
      if (attachment) {
        const uploadData = new FormData();
        uploadData.append("file", attachment);
        const { data } = await api.post("/uploads", uploadData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        attachmentUrl = data?.file?.url;
        attachmentName = data?.file?.name;
      }

      await api.post("/auth/request-access", {
        fullName: formData.fullName,
        email: formData.email,
        schoolId: selectedSchool?.id || null,
        schoolName: trimmedSchool,
        attachmentUrl,
        attachmentName,
      });

      toast.success("Request submitted! We will get back to you.");
      setFormData({
        fullName: "",
        email: "",
      });
      setAttachment(null);
      setSchoolQuery("");
      setSchoolResults([]);
      setSelectedSchool(null);
      setTimeout(() => navigate("/login"), 1500);
    } catch (err) {
      const message =
        err.response?.data?.error ||
        "Unable to submit request. Please try again.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex w-full bg-white font-sans overflow-hidden">
      <div className="hidden lg:flex flex-1 items-center justify-center p-12 bg-[#fbfcff] border-r border-slate-100">
        <div className="relative w-full max-w-xl flex flex-col items-center">
          <img
            src={loginIllustration}
            alt="ClassIQ Access"
            className="w-full h-auto drop-shadow-2xl rounded-[2rem] object-cover mb-8"
          />
          <div className="text-center">
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">
              Request Access
            </h2>
            <p className="text-sm text-slate-400 mt-2 font-medium">
              Tell us who you are and we will review your request.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-8 md:p-12 bg-white relative z-10">
        <div className="w-full max-w-sm">
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={() => navigate("/login")}
              className="p-2 -ml-2 hover:bg-slate-50 rounded-full transition-colors"
            >
              <ChevronLeft size={24} className="text-slate-400" />
            </button>
            <Link to="/" className="flex items-center gap-2">
              <img src={logo} alt="ClassIQ" className="h-8 w-auto" />
              <span className="text-lg font-black text-slate-900">ClassIQ</span>
            </Link>
            <div className="w-8" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-black text-slate-700  block mb-2">
                Full Name
              </label>
              <input
                name="fullName"
                type="text"
                required
                value={formData.fullName}
                onChange={handleChange}
                placeholder="Full name"
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-slate-400 focus:bg-white focus:border-[#2D70FD] focus:outline-none transition-all placeholder:text-slate-300"
              />
            </div>

            <div>
              <label className="text-sm font-black text-slate-700  block mb-2">
                Email Address
              </label>
              <input
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                placeholder="Email address"
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-slate-400 focus:bg-white focus:border-[#2D70FD] focus:outline-none transition-all placeholder:text-slate-300"
              />
            </div>

            <div>
              <label className="text-sm font-black text-slate-700  block mb-2">
                School
              </label>
              <div ref={schoolRef} className="relative">
                <div className="relative">
                  <Search
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"
                  />
                  <input
                    name="school"
                    type="text"
                    required
                    value={schoolQuery}
                    onChange={handleSchoolChange}
                    onFocus={() => setSchoolOpen(true)}
                    placeholder="Search your school"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-11 pr-12 text-sm font-bold text-slate-400 focus:bg-white focus:border-[#2D70FD] focus:outline-none transition-all placeholder:text-slate-300"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {schoolLoading ? (
                      <Loader2 className="animate-spin text-slate-400" size={16} />
                    ) : null}
                    {schoolQuery ? (
                      <button
                        type="button"
                        onClick={clearSchool}
                        className="text-slate-300 hover:text-slate-500 transition-colors"
                        aria-label="Clear school"
                      >
                        <X size={16} />
                      </button>
                    ) : null}
                  </div>
                </div>
                {schoolOpen ? (
                  <div
                    id="school-results"
                    className="absolute z-20 mt-2 w-full rounded-2xl border border-slate-100 bg-white shadow-xl overflow-hidden"
                  >
                    <div className="max-h-60 overflow-auto">
                      {schoolLoading ? (
                        <div className="px-4 py-3 text-sm text-slate-400">
                          Searching schools...
                        </div>
                      ) : schoolResults.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-slate-400">
                          No schools found. You can submit the name above.
                        </div>
                      ) : (
                        schoolResults.map((school) => (
                          <button
                            key={school.id}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => handleSchoolSelect(school)}
                            className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center justify-between"
                          >
                            <span className="text-sm font-bold text-slate-700">
                              {school.name}
                            </span>
                            {school.location ? (
                              <span className="text-xs text-slate-400">
                                {school.location}
                              </span>
                            ) : null}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2D70FD] text-white py-4 rounded-[25px] font-bold shadow-lg shadow-blue-100 flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-70 uppercase tracking-wider"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                "Submit Request"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RequestAccess;

