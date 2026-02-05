import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ChevronLeft, Loader2, Lock } from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import logo from "../assets/logo.png";
import loginIllustration from "../assets/Login.png";
import { API_BASE_URL } from "../Utility/API";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.msg || "Something went wrong. Please try again.");
      }

      toast.success("Recovery email sent! Check your inbox.", {
        position: "top-right",
        autoClose: 4000,
        hideProgressBar: false,
        pauseOnHover: true,
        draggable: true,
      });

      setTimeout(() => {
        navigate("/verify-email", { state: { email } });
      }, 1500);
    } catch (err) {
      toast.error(err.message || "Cannot connect to server.", {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        pauseOnHover: true,
        draggable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex w-full bg-white font-sans overflow-hidden">
      <ToastContainer />
      <div className="hidden lg:flex flex-1 items-center justify-center p-12 bg-[#fbfcff] border-r border-slate-100">
        <div className="relative w-full max-w-xl flex flex-col items-center">
          <img
            src={loginIllustration}
            alt="ClassIQ Reset"
            className="w-full h-auto drop-shadow-2xl rounded-[2rem] object-cover mb-8"
          />
          <div className="text-center">
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">
              Account Recovery
            </h2>
            <p className="text-sm text-slate-400 mt-2 font-medium">
              We'll help you get back into your account safely.
            </p>
          </div>
        </div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-8 md:p-12 bg-white relative z-10">
        <div className="w-full max-w-sm flex flex-col items-center mt-12">
          <form
            onSubmit={handleSubmit}
            className="w-full flex flex-col items-center"
          >
            <div className="w-full max-w-sm flex items-center justify-between mb-16 absolute top-12">
              <button
                onClick={() => navigate("/login")}
                className="p-2 -ml-2 hover:bg-slate-50 rounded-full transition-colors"
              >
                <ChevronLeft size={24} className="text-slate-400" />
              </button>
              <h1 className="text-lg font-bold text-slate-900">
                Forgot Password
              </h1>
              <div className="w-8" />
            </div>
            <p className="text-sm font-bold text-slate-800 mb-8 text-center">
              Enter Email Address
            </p>

            <input
              type="email"
              required
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-sm mb-4 focus:bg-white focus:border-[#1877F2] focus:outline-none transition-all placeholder:text-slate-300 font-bold text-slate-800"
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1877F2] text-white py-4 rounded-[25px] font-bold shadow-lg shadow-blue-100 flex items-center justify-center transition-transform active:scale-95 disabled:opacity-70 uppercase tracking-wider"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                "Send"
              )}
            </button>

            <div className="flex flex-col items-center mt-12 w-full text-center">
              <p className="text-sm text-slate-500 font-medium">
                Don't have an account?
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

export default ForgotPassword;
