import React, { useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Loader2, CheckCircle } from "lucide-react";
import { toast } from "react-toastify";
import logo from "../assets/logo.png";
import loginIllustration from "../assets/Login.png";
import api from "../api/client";

const VerifyEmail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const inputRefs = useRef([]);

  const [otp, setOtp] = useState(new Array(6).fill(""));
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const email = location.state?.email || "your email";
  const mode = location.state?.mode || "reset";

  const handleChange = (element, index) => {
    if (isNaN(element.value)) return;
    const newOtp = otp.map((d, idx) => (idx === index ? element.value : d));
    setOtp(newOtp);

    if (element.value && index < 5) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handlePaste = (e) => {
    const data = e.clipboardData.getData("text").trim();
    if (!/^\d{6}$/.test(data)) return;
    const pasteData = data.split("");
    setOtp(pasteData);
    inputRefs.current[5].focus();
  };

  const handleKeyDown = (e, index) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  const handleVerify = async (e) => {
    if (e) e.preventDefault();
    const code = otp.join("");

    if (code.length !== 6) {
      toast.error("Please enter a 6-digit code", { position: "top-right" });
      return;
    }

    setLoading(true);

    try {
      if (mode === "email") {
        await api.post("/auth/verify-email", { email, code });
        toast.success("Email verified! You can now log in.", {
          position: "top-right",
          autoClose: 2000,
        });
        setSuccess(true);
        setTimeout(() => navigate("/login", { replace: true }), 1800);
      } else {
        const { data } = await api.post("/auth/verify-reset-code", {
          email,
          code,
        });
        sessionStorage.setItem("resetToken", data.resetToken);
        toast.success("Verification successful! Redirecting...", {
          position: "top-right",
          autoClose: 2000,
        });
        setSuccess(true);
        setTimeout(
          () =>
            navigate("/reset-password", {
              state: { email, resetToken: data.resetToken },
              replace: true,
            }),
          1800,
        );
      }
    } catch (err) {
      const message =
        err.response?.data?.error || "Invalid verification code.";
      toast.error(message, { position: "top-right" });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      if (mode === "email") {
        await api.post("/auth/request-email-verification", { email });
      } else {
        await api.post("/auth/request-password-reset", { email });
      }
      toast.info("A new code has been sent.");
    } catch (err) {
      const message =
        err.response?.data?.error || "Unable to resend code.";
      toast.error(message);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-8">
        <div className="text-center space-y-4">
          <div className="bg-green-100 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="text-green-600" size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Verified!</h2>
          <p className="text-sm text-slate-500 font-medium">
            {mode === "email"
              ? "Email verified. You can now sign in."
              : "Identity confirmed. Let's set your new password."}
          </p>
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
            alt="Verify"
            className="w-full h-auto drop-shadow-2xl rounded-[2rem] object-cover mb-8"
          />
          <div className="text-center">
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">
              Check your mail
            </h2>
            <p className="text-sm text-slate-400 mt-2 font-medium">
              Enter the 6-digit code sent to your inbox.
            </p>
          </div>
        </div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-8 md:p-12 bg-white relative z-10">
        <div className="w-full max-w-sm flex flex-col items-center">
          <img src={logo} alt="ClassIQ" className="h-10 w-auto mb-10" />

          <h2 className="text-xl font-bold text-slate-800 mb-2">
            Verification
          </h2>
          <p className="text-sm text-slate-500 text-center font-medium mb-10">
            Enter Verification code sent to
            <span className="text-slate-900 font-bold"> {email}</span>
          </p>

          <form
            onSubmit={handleVerify}
            className="w-full flex flex-col items-center"
          >
            <div className="flex gap-2 mb-8">
              {otp.map((data, index) => (
                <input
                  key={index}
                  type="text"
                  maxLength="1"
                  ref={(el) => (inputRefs.current[index] = el)}
                  value={data}
                  onPaste={handlePaste}
                  onChange={(e) => handleChange(e.target, index)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  className="w-12 h-12 border-2 border-slate-100 rounded-full text-center text-lg font-bold text-slate-800 focus:border-[#1877F2] focus:outline-none transition-all bg-white"
                />
              ))}
            </div>

            <p className="text-xs text-slate-400 font-bold mb-10">
              didn't receive a code!{" "}
              <button
                type="button"
                className="text-blue-500 hover:underline"
                onClick={handleResend}
              >
                Resend
              </button>
            </p>

            <button
              type="submit"
              disabled={loading || otp.join("").length !== 6}
              className="w-full bg-[#1877F2] text-white py-4 rounded-[25px] font-bold shadow-lg shadow-blue-100 flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50 uppercase tracking-wider"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                "Verify"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
