import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import logo from "./assets/logo.png";
import {
  Login,
  LibraryLogin,
  ForgotPassword,
  ResetPassword,
  VerifyEmail,
  RequestAccess,
} from "./Pages/Auth";
import LandingPage from "./Pages/LandingPage";
import ProtectedRoute from "./Auth/ProtectedRoute";
import StudentLayout from "./Dashboard/Student/studentLayout";
import StudentHome from "./Dashboard/Student/studentHome";
import PLPBundle from "./Dashboard/Student/plpBundle";
import Exercise from "./Dashboard/Student/Exercise";
import Assignments from "./Dashboard/Student/Assignments";
import AssessmentList from "./Dashboard/Student/assessmentList";
import Resources from "./Dashboard/Student/Resources";
import MyCourses from "./Dashboard/Student/MyCourses";
import StudentProfile from "./Dashboard/Student/studentProfile";
import Notifications from "./Dashboard/Student/Notifications";
import Tasks from "./Dashboard/Student/Tasks";
import Schedule from "./Dashboard/Student/Schedule";
import Help from "./Dashboard/Student/Help";
import LibraryDashboard from "./Dashboard/Student/LibraryDashboard";
import LibraryResources from "./Dashboard/Student/LibraryResources";
import LibraryLayout from "./Dashboard/Library/LibraryLayout";
import TeacherLayout from "./Dashboard/Teacher/TeacherLayout";
import TeacherHome from "./Dashboard/Teacher/TeacherHome";
import TeacherAssessments from "./Dashboard/Teacher/TeacherAssessments";
import TeacherPLP from "./Dashboard/Teacher/TeacherPLP";
import TeacherExercises from "./Dashboard/Teacher/TeacherExercises";
import TeacherAnalytics from "./Dashboard/Teacher/TeacherAnalytics";
import TeacherOutline from "./Dashboard/Teacher/TeacherOutline";
import TeacherReports from "./Dashboard/Teacher/TeacherReports";
import TeacherResources from "./Dashboard/Teacher/TeacherResources";
import TeacherNotifications from "./Dashboard/Teacher/TeacherNotifications";
import TeacherProfile from "./Dashboard/Teacher/TeacherProfile";
import TeacherHelp from "./Dashboard/Teacher/TeacherHelp";
import AdminLayout from "./Dashboard/Admin/AdminLayout";
import AdminHome from "./Dashboard/Admin/AdminHome";
import AdminUsers from "./Dashboard/Admin/AdminUsers";
import AdminRequests from "./Dashboard/Admin/AdminRequests";
import AdminResources from "./Dashboard/Admin/AdminResources";
import AdminReports from "./Dashboard/Admin/AdminReports";
import AdminSettings from "./Dashboard/Admin/AdminSettings";
import AdminProfile from "./Dashboard/Admin/AdminProfile";
import AdminHelp from "./Dashboard/Admin/AdminHelp";

const Preloader = () => (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white">
    <div className="relative flex items-center justify-center">
      <div className="h-44 w-44 animate-spin rounded-full border-b-4 border-t-4 border-zinc-100"></div>
      <div className="absolute h-36 w-36 animate-spin rounded-full border-l-4 border-r-4 border-[#2D70FD] [animation-duration:1.2s]"></div>
      <div className="absolute h-28 w-28 animate-spin-reverse rounded-full border-b-2 border-t-2 border-zinc-300 [animation-duration:2s]"></div>
      <div className="absolute flex animate-pulse items-center justify-center">
        <img
          src={logo}
          alt="ClassIQ Logo"
          className="h-14 w-14 object-contain"
        />
      </div>
    </div>
  </div>
);

const ErrorPage = ({ code, title, message, ctaText, ctaLink }) => (
  <div className="h-screen flex flex-col items-center justify-center bg-white px-6 text-center overflow-hidden">
    <span className="absolute select-none text-[15rem] font-black leading-none tracking-tighter text-zinc-100">
      {code}
    </span>
    <div className="relative z-10">
      <h1 className="mb-3 text-5xl font-black tracking-tighter text-zinc-900">
        {title}
      </h1>
      <p className="mx-auto max-w-sm font-bold leading-relaxed text-zinc-500">
        {message}
      </p>
      <Link
        to={ctaLink}
        className="mt-10 inline-block rounded-[1.5rem] bg-black px-12 py-5 font-black text-white shadow-2xl shadow-zinc-300"
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
        <Route path="/signin" element={<Navigate to="/login" replace />} />
        <Route
          path="/auth/login"
          element={<Navigate to="/login" replace />}
        />
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
          <Route path="assignments" element={<Assignments />} />
          <Route path="assessments" element={<AssessmentList />} />
          <Route path="exercise" element={<Exercise />} />
          <Route path="resources" element={<Resources />} />
          <Route path="profile" element={<StudentProfile />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="schedule" element={<Schedule />} />
          <Route path="help" element={<Help />} />
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
              <TeacherLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<TeacherHome />} />
          <Route path="assessments" element={<TeacherAssessments />} />
          <Route
            path="weak-areas"
            element={<Navigate to="/teacher/plp" replace />}
          />
          <Route path="plp" element={<TeacherPLP />} />
          <Route path="exercises" element={<TeacherExercises />} />
          <Route path="analytics" element={<TeacherAnalytics />} />
          <Route path="outline" element={<TeacherOutline />} />
          <Route path="reports" element={<TeacherReports />} />
          <Route path="resources" element={<TeacherResources />} />
          <Route path="notifications" element={<TeacherNotifications />} />
          <Route path="profile" element={<TeacherProfile />} />
          <Route
            path="settings"
            element={<Navigate to="/teacher/profile" replace />}
          />
          <Route path="help" element={<TeacherHelp />} />
        </Route>
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminHome />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="requests" element={<AdminRequests />} />
          <Route path="resources" element={<AdminResources />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="profile" element={<AdminProfile />} />
          <Route path="help" element={<AdminHelp />} />
        </Route>
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
