import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Loader2, CheckCircle, Eye, EyeOff } from "lucide-react";
import { toast } from "react-toastify";
import logo from "../assets/logo.png";
import loginIllustration from "../assets/Login.png";
import api from "../api/client";

const ResetPassword = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [email] = useState(
    location.state?.email || sessionStorage.getItem("resetEmail") || "",
  );
  const [resetToken] = useState(
    location.state?.resetToken || sessionStorage.getItem("resetToken") || "",
  );

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (location.state?.email && location.state?.resetToken) {
      sessionStorage.setItem("resetEmail", location.state.email);
      sessionStorage.setItem("resetToken", location.state.resetToken);
    }
    if (!email || !resetToken) {
      navigate("/login");
    }
  }, [email, resetToken, navigate, location.state]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Passwords do not match", { position: "top-right" });
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters", {
        position: "top-right",
      });
      return;
    }

    setLoading(true);

    try {
      await api.post("/auth/reset-password", {
        resetToken,
        newPassword: password,
      });
      sessionStorage.removeItem("resetEmail");
      sessionStorage.removeItem("resetToken");

      toast.success("Password updated successfully! Redirecting...", {
        position: "top-right",
        autoClose: 3000,
      });

      setSuccess(true);
      setTimeout(() => navigate("/login", { replace: true }), 3000);
    } catch (err) {
      const message =
        err.response?.data?.error ||
        "Unable to reset password. Please try again.";
      toast.error(message, { position: "top-right" });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-8 animate-in fade-in duration-500">
        <div className="text-center">
          <div className="bg-green-50 p-6 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-8 shadow-sm">
            <CheckCircle className="text-green-500" size={48} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Password Updated!
          </h2>
          <p className="text-slate-500 font-medium max-w-[250px] mx-auto leading-relaxed">
            Your new password has been set. Redirecting to login...
          </p>
          <div className="mt-8 flex justify-center">
            <Loader2 className="animate-spin text-blue-500" size={24} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex w-full bg-white font-sans overflow-hidden">
      <div className="hidden lg:flex flex-1 items-center justify-center p-12 bg-[#fbfcff] border-r border-slate-100">
        <div className="relative w-full max-w-xl flex flex-col items-center">
          <img
            src={loginIllustration}
            alt="Reset"
            className="w-full h-auto drop-shadow-2xl rounded-[2rem] object-cover mb-8"
          />
          <div className="text-center">
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">
              Security Update
            </h2>
            <p className="text-sm text-slate-400 mt-2 font-medium">
              Keep your ClassIQ performance data safe.
            </p>
          </div>
        </div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-8 md:p-12 bg-white relative z-10">
        <div className="w-full max-w-sm">
          <div className="text-center mb-10">
            <img
              src={logo}
              alt="ClassIQ"
              className="h-10 w-auto mb-10 mx-auto"
            />
            <h2 className="text-lg font-bold text-slate-800 mb-1">
              New Password
            </h2>
            <p className="text-xs text-slate-400">
              Resetting for{" "}
              <span className="text-sm font-bold text-slate-800">{email}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-800 block">
                Enter New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="8 characters at least"
                  className="w-full px-6 py-4 bg-white border border-slate-200 rounded-[25px] text-sm text-slate-800 focus:border-[#2D70FD] outline-none transition-all shadow-sm pr-12"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-800 block">
                Confirm Password
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                className="w-full px-6 py-4 bg-white border border-slate-200 rounded-[25px] text-sm text-slate-800 focus:border-[#2D70FD] outline-none transition-all shadow-sm"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2D70FD] hover:bg-[#255EDC] text-white py-4 rounded-[25px] font-bold shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 mt-4 uppercase tracking-wider"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                "Update Password"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;

