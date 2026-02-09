import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Mail, Lock, ArrowRight, Loader2, X } from "lucide-react";
import { toast } from "react-toastify";
import logo from "../assets/logo.png";
import loginIllustration from "../assets/Login.png";
import api from "../api/client";

const LibraryLogin = () => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showError, setShowError] = useState(false);

  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (showError) setShowError(false);
  };

  const showNotification = (msg) => {
    setError(msg);
    setShowError(true);
    setTimeout(() => setShowError(false), 4000);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", formData);
      localStorage.setItem("classiq_user", JSON.stringify(data.user));
      navigate("/library");
    } catch (err) {
      const message =
        err.response?.data?.error || "Unable to sign in. Please try again.";
      showNotification(message);
      toast.error(message);
      if (err.response?.status === 403) {
        navigate("/verify-email", {
          state: { email: formData.email, mode: "email" },
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex w-full bg-white font-sans overflow-hidden relative">
      {showError && (
        <div className="fixed top-4 right-4 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-slide-in">
          <span className="font-bold text-xs">{error}</span>
          <button onClick={() => setShowError(false)}>
            <X size={16} />
          </button>
        </div>
      )}
      <div className="hidden lg:flex flex-1 items-center justify-center relative p-12 bg-[#fbfcff] border-r border-slate-100">
        <div className="relative w-full max-w-xl flex flex-col items-center">
          <img
            src={loginIllustration}
            alt="ClassIQ Library"
            className="w-full h-auto drop-shadow-2xl rounded-[2rem] object-cover mb-8"
          />
          <div className="text-center">
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">
              ClassIQ Library Access
            </h2>
            <p className="text-sm text-slate-400 mt-2 font-medium">
              Upload, organize, and share learning resources.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 md:p-12 bg-white relative z-10">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-10">
            <Link to="/" className="flex flex-row items-center gap-3 mb-6">
              <img src={logo} alt="ClassIQ" className="h-10 w-auto" />
              <h1 className="text-2xl font-black text-slate-900 tracking-tighter leading-none">
                ClassIQ
              </h1>
            </Link>
            <h2 className="text-xl font-bold text-slate-800">Library Login</h2>
            <p className="text-sm text-slate-400 font-medium mt-2">
              Use your ClassIQ credentials.
            </p>
          </div>
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-800 ml-1">
                Email Address
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"
                  size={18}
                />
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="Email Address"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-slate-400 focus:bg-white focus:border-[#1877F2] focus:outline-none transition-all placeholder:text-slate-300"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-800 ml-1">
                Password
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"
                  size={18}
                />
                <input
                  name="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-slate-800 focus:bg-white focus:border-[#1877F2] focus:outline-none transition-all placeholder:text-slate-300"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white py-4 rounded-3xl font-bold shadow-lg shadow-slate-200 flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-70 mt-4"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <>
                  Enter Library <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LibraryLogin;
