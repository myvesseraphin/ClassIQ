import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import logo from "./assets/logo.png";
import Login from "./Pages/Login";
import LibraryLogin from "./Pages/LibraryLogin";
import ForgotPassword from "./Pages/ForgotPassword";
import ResetPassword from "./Pages/ResetPassword";
import VerifyEmail from "./Pages/VerifyEmail";
import RequestAccess from "./Pages/RequestAccess";
import LandingPage from "./Pages/LandingPage";
import ProtectedRoute from "./Auth/ProtectedRoute";
import StudentLayout from "./Dashboard/Student/studentLayout";
import StudentHome from "./Dashboard/Student/studentHome";
import PLPBundle from "./Dashboard/Student/plpBundle";
import Exercise from "./Dashboard/Student/Exercise";
import AssessmentList from "./Dashboard/Student/assessmentList";
import Resources from "./Dashboard/Student/Resources";
import MyCourses from "./Dashboard/Student/MyCourses";
import StudentProfile from "./Dashboard/Student/studentProfile";
import Notifications from "./Dashboard/Student/Notifications";
import Tasks from "./Dashboard/Student/Tasks";
import Schedule from "./Dashboard/Student/Schedule";
import LibraryDashboard from "./Dashboard/Student/LibraryDashboard";
import LibraryResources from "./Dashboard/Student/LibraryResources";
import LibraryLayout from "./Dashboard/Library/LibraryLayout";
const Preloader = () => (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white">
    <div className="relative flex items-center justify-center">
      <div className="w-44 h-44 border-t-4 border-b-4 border-blue-50 rounded-full animate-spin"></div>
      <div className="absolute w-36 h-36 border-l-4 border-r-4 border-[#2D70FD] rounded-full animate-spin [animation-duration:1.2s]"></div>
      <div className="absolute w-28 h-28 border-t-2 border-b-2 border-blue-200 rounded-full animate-spin-reverse [animation-duration:2s]"></div>
      <div className="absolute flex items-center justify-center animate-pulse">
        <img
          src={logo}
          alt="ClassIQ Logo"
          className="w-14 h-14 object-contain"
        />
      </div>
    </div>
  </div>
);
const ErrorPage = ({ code, title, message, ctaText, ctaLink }) => (
  <div className="h-screen flex flex-col items-center justify-center bg-white text-center px-6 overflow-hidden">
    <span className="text-[15rem] font-black text-slate-50 leading-none absolute select-none tracking-tighter">
      {code}
    </span>
    <div className="relative z-10">
      <h1 className="text-5xl font-black text-slate-900 tracking-tighter mb-3">
        {title}
      </h1>
      <p className="text-slate-500 font-bold max-w-sm mx-auto leading-relaxed">
        {message}
      </p>
      <Link
        to={ctaLink}
        className="inline-block mt-10 px-12 py-5 bg-[#2D70FD] text-white rounded-[1.5rem] font-black shadow-2xl"
      >
        {ctaText}
      </Link>
    </div>
  </div>
);

function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) return <Preloader />;

  return (
    <BrowserRouter>
      <ToastContainer position="top-right" autoClose={4000} />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/library-login" element={<LibraryLogin />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/request-access" element={<RequestAccess />} />
        <Route
          path="/student"
          element={
            <ProtectedRoute allowedRoles={["student"]}>
              <StudentLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<StudentHome />} />
          <Route path="plp" element={<PLPBundle />} />
          <Route path="my-courses" element={<MyCourses />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="assessments" element={<AssessmentList />} />
          <Route path="exercise" element={<Exercise />} />
          <Route path="resources" element={<Resources />} />
          <Route path="profile" element={<StudentProfile />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="schedule" element={<Schedule />} />
          <Route
            path="settings"
            element={<Navigate to="/student/profile" replace />}
          />
        </Route>
        <Route
          path="/library"
          element={
            <ProtectedRoute redirectTo="/library-login">
              <LibraryLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<LibraryDashboard />} />
          <Route path="resources" element={<LibraryResources />} />
        </Route>
        <Route
          path="/teacher"
          element={
            <ProtectedRoute allowedRoles={["teacher"]}>
              <div className="flex h-screen items-center justify-center bg-[#F8FAFC] p-10 font-black text-slate-900 text-3xl tracking-tighter">
                Teacher Dashboard Placeholder
              </div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <div className="flex h-screen items-center justify-center bg-[#F8FAFC] p-10 font-black text-slate-900 text-3xl tracking-tighter">
                Admin Dashboard Placeholder
              </div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/unauthorized"
          element={
            <ErrorPage
              code="403"
              title="Access Denied"
              message="You do not have the clearance required to view this sector of ClassIQ."
              ctaText="Return to Login"
              ctaLink="/login"
            />
          }
        />

        <Route
          path="*"
          element={
            <ErrorPage
              code="404"
              title="Lost in Space?"
              message="The page you're looking for has moved or no longer exists."
              ctaText="Back to Earth"
              ctaLink="/"
            />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
