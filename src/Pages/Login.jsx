import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Mail, Lock, Facebook, ArrowRight, Loader2, X } from "lucide-react";
import { toast } from "react-toastify";
import logo from "../assets/logo.png";
import loginIllustration from "../assets/Login.png";
import api from "../api/client";

const Login = () => {
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
      const role = data.user?.role;
      if (role === "teacher") {
        navigate("/teacher");
      } else if (role === "admin") {
        navigate("/admin");
      } else {
        navigate("/student");
      }
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
    <div className="min-h-screen flex w-full bg-white font-sans overflow-hidden">
      {showError ? (
        <div className="fixed right-4 top-4 z-50 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 shadow-lg">
          <span className="text-xs font-bold">{error}</span>
          <button
            type="button"
            onClick={() => setShowError(false)}
            className="rounded-md p-1 hover:bg-red-100"
          >
            <X size={16} />
          </button>
        </div>
      ) : null}

      <div className="hidden lg:flex flex-1 items-center justify-center p-12 bg-[#fbfcff] border-r border-slate-100">
        <div className="relative w-full max-w-xl flex flex-col items-center">
          <img
            src={loginIllustration}
            alt="ClassIQ AI Learning"
            className="w-full h-auto drop-shadow-2xl rounded-[2rem] object-cover mb-8"
          />
          <div className="text-center">
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">
              Smart Learning, Better Outcomes
            </h2>
            <p className="text-sm text-slate-400 mt-2 font-medium">
              Analyze performance and guide every learner with clarity.
            </p>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex flex-1 items-center justify-center bg-white p-8 md:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex flex-col items-center">
            <Link to="/" className="mb-6 flex items-center gap-3">
              <img src={logo} alt="ClassIQ" className="h-10 w-auto" />
              <h1 className="text-2xl font-black leading-none tracking-tighter text-slate-900">
                ClassIQ
              </h1>
            </Link>
            <h2 className="text-xl font-bold text-slate-800">Welcome Back</h2>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="ml-1 text-sm font-bold text-slate-800">
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
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-slate-800 focus:bg-white focus:border-[#2D70FD] focus:outline-none transition-all placeholder:text-slate-300"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="ml-1 flex items-center justify-between">
                <label className="text-sm font-bold text-slate-800">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => navigate("/forgot-password")}
                  className="text-xs text-blue-600 font-bold hover:underline"
                >
                  Forgot?
                </button>
              </div>
              <div className="relative">
                <Lock
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"
                  size={18}
                />
                <input
                  name="password"
                  type="password"
                  required
                  placeholder="********"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-slate-800 focus:bg-white focus:border-[#2D70FD] focus:outline-none transition-all placeholder:text-slate-300"
                />
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
                <>
                  Log in <ArrowRight size={18} />
                </>
              )}
            </button>

            <div className="flex items-center py-2">
              <div className="h-px flex-1 bg-slate-100" />
              <span className="mx-4 text-xs font-bold uppercase tracking-widest text-slate-300">
                or
              </span>
              <div className="h-px flex-1 bg-slate-100" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                className="flex items-center justify-center gap-2 border border-slate-100 bg-white py-3 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
              >
                <Facebook size={16} className="text-[#1877F2] fill-current" />
                Facebook
              </button>
              <button
                type="button"
                className="flex items-center justify-center gap-2 border border-slate-100 bg-white py-3 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
              >
                <img
                  src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                  alt="Google"
                  className="h-4 w-4"
                />
                Google
              </button>
            </div>

            <div className="pt-6 text-center">
              <p className="text-sm text-slate-500 font-medium">
                Don&apos;t have an account?
                <Link
                  to="/request-access"
                  className="ml-2 text-blue-600 font-bold hover:underline"
                >
                  Request Access
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
