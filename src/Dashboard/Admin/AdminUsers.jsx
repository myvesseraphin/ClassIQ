import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Search,
  Shield,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import api, { resolveMediaUrl } from "../../api/client";
import EmptyState from "../../Component/EmptyState";

const ROLE_FILTERS = [
  { label: "All", value: "" },
  { label: "Students", value: "student" },
  { label: "Teachers", value: "teacher" },
  { label: "Admins", value: "admin" },
];

const AdminUsers = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [roleFilter, setRoleFilter] = useState("");
  const [verificationFilter, setVerificationFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [roleCounts, setRoleCounts] = useState({
    student: 0,
    teacher: 0,
    admin: 0,
  });
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const [selectedUser, setSelectedUser] = useState(null);
  const [editRole, setEditRole] = useState("student");
  const [editVerified, setEditVerified] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const requestedUserId = String(searchParams.get("userId") || "").trim();

  useEffect(() => {
    let active = true;
    Promise.all([api.get("/admin/classes"), api.get("/admin/subjects")])
      .then(([classRes, subjectRes]) => {
        if (!active) return;
        setClasses(Array.isArray(classRes?.data?.classes) ? classRes.data.classes : []);
        setSubjects(
          Array.isArray(subjectRes?.data?.subjects) ? subjectRes.data.subjects : [],
        );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setIsLoading(true);

    const timer = setTimeout(async () => {
      try {
        const offset = (page - 1) * pageSize;
        const { data } = await api.get("/admin/users", {
          params: {
            q: searchQuery.trim() || undefined,
            role: roleFilter || undefined,
            classId: classFilter || undefined,
            subjectId: subjectFilter || undefined,
            limit: pageSize,
            offset,
          },
        });

        if (!active) return;
        const incomingUsers = Array.isArray(data?.users) ? data.users : [];
        setUsers(incomingUsers);
        setTotal(Number(data?.total) || 0);
        setRoleCounts({
          student: Number(data?.roleCounts?.student) || 0,
          teacher: Number(data?.roleCounts?.teacher) || 0,
          admin: Number(data?.roleCounts?.admin) || 0,
        });
      } catch (err) {
        console.error("Failed to load users", err);
        toast.error("Failed to load users.");
        if (active) {
          setUsers([]);
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
  }, [page, pageSize, roleFilter, searchQuery, classFilter, subjectFilter]);

  useEffect(() => {
    if (!requestedUserId || users.length === 0) return;
    const match = users.find((u) => u.id === requestedUserId);
    if (match) {
      setSelectedUser(match);
      setEditRole(match.role || "student");
      setEditVerified(Boolean(match.emailVerified));
    }
  }, [requestedUserId, users]);

  const filtered = useMemo(() => {
    if (verificationFilter === "all") return users;
    return users
      .filter((u) =>
        verificationFilter === "verified"
          ? Boolean(u.emailVerified)
          : !Boolean(u.emailVerified),
      )
      .filter((u) => {
        if (!classFilter) return true;
        if (String(u.role || "").toLowerCase() !== "student") return true;
        return (
          String(u.classId || "") === String(classFilter) ||
          String(u.className || "").toLowerCase() ===
            String(
              classes.find((c) => String(c.id) === String(classFilter))?.className || "",
            ).toLowerCase()
        );
      })
      .filter((u) => {
        if (!subjectFilter) return true;
        if (String(u.role || "").toLowerCase() !== "teacher") return true;
        const teacherSubjects = Array.isArray(u.subjects) ? u.subjects : [];
        return (
          teacherSubjects.some((s) => String(s.id || s) === String(subjectFilter)) ||
          String(u.subjectId || "") === String(subjectFilter)
        );
      });
  }, [users, verificationFilter, classFilter, subjectFilter, classes]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const openUser = (user) => {
    setSelectedUser(user);
    setEditRole(user.role || "student");
    setEditVerified(Boolean(user.emailVerified));
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("userId", user.id);
      return next;
    });
  };

  const closeUser = () => {
    setSelectedUser(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("userId");
      return next;
    });
  };

  const saveUser = async () => {
    if (!selectedUser?.id) return;
    setIsSaving(true);
    try {
      const payload = {
        role: editRole,
        emailVerified: Boolean(editVerified),
      };
      const { data } = await api.patch(`/admin/users/${selectedUser.id}`, payload);
      const updated = data?.user;
      if (!updated?.id) throw new Error("Invalid user update response.");

      setUsers((prev) =>
        prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)),
      );
      setSelectedUser((prev) => (prev ? { ...prev, ...updated } : prev));
      toast.success("User updated.");
    } catch (err) {
      console.error("Failed to update user", err);
      toast.error(err?.response?.data?.error || "Failed to update user.");
    } finally {
      setIsSaving(false);
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
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">
            Users
          </h1>
          <div className="relative w-full md:w-96 group">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#2D70FD]"
              size={20}
            />
            <input
              type="text"
              placeholder="Search name, email, ID..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full pl-12 pr-6 py-3.5 bg-white border-2 border-slate-100 rounded-2xl outline-none focus:border-[#2D70FD] transition-all font-bold text-slate-700 shadow-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard label="Total" value={total} icon={<Users size={18} />} />
          <StatCard
            label="Students"
            value={roleCounts.student}
            icon={<Users size={18} />}
          />
          <StatCard
            label="Teachers"
            value={roleCounts.teacher}
            icon={<UserCheck size={18} />}
          />
          <StatCard
            label="Admins"
            value={roleCounts.admin}
            icon={<Shield size={18} />}
          />
        </div>

        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-2 lg:pb-0 scrollbar-hide">
            {ROLE_FILTERS.map((filter) => (
              <button
                key={filter.label}
                onClick={() => {
                  setRoleFilter(filter.value);
                  setPage(1);
                }}
                className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
                  roleFilter === filter.value
                    ? "bg-[#2D70FD] text-white shadow-lg shadow-blue-100"
                    : "bg-white text-slate-500 border border-slate-200"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <select
              value={classFilter}
              onChange={(e) => {
                setClassFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-white border border-slate-200 text-slate-600"
            >
              <option value="">All Classes</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label || `${item.gradeLevel || ""} ${item.className || ""}`.trim()}
                </option>
              ))}
            </select>
            <select
              value={subjectFilter}
              onChange={(e) => {
                setSubjectFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-white border border-slate-200 text-slate-600"
            >
              <option value="">All Subjects</option>
              {subjects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            {[
              { label: "All", value: "all" },
              { label: "Verified", value: "verified" },
              { label: "Unverified", value: "unverified" },
            ].map((item) => (
              <button
                key={item.value}
                onClick={() => setVerificationFilter(item.value)}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  verificationFilter === item.value
                    ? "bg-[#2D70FD] text-white"
                    : "bg-white border border-slate-200 text-slate-500"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-8 py-5 text-xs font-black text-slate-400 tracking-tight uppercase">
                    User
                  </th>
                  <th className="px-8 py-5 text-xs font-black text-slate-400 tracking-tight uppercase">
                    Role
                  </th>
                  <th className="px-8 py-5 text-xs font-black text-slate-400 tracking-tight uppercase">
                    Verified
                  </th>
                  <th className="px-8 py-5 text-xs font-black text-slate-400 tracking-tight uppercase">
                    Last Login
                  </th>
                  <th className="px-8 py-5 text-xs font-black text-slate-400 tracking-tight uppercase">
                    Created
                  </th>
                  <th className="px-8 py-5 text-right pr-12">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-blue-50/20 transition-colors"
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="h-10 w-10 rounded-full bg-slate-100 overflow-hidden border border-slate-200 flex items-center justify-center shrink-0">
                          {user.avatarUrl ? (
                            <img
                              src={resolveMediaUrl(user.avatarUrl)}
                              alt={user.name}
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                  user.name || "User",
                                )}`;
                              }}
                            />
                          ) : (
                            <CheckCircle2 size={18} className="text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-slate-800 text-sm truncate">
                            {user.name}
                          </p>
                          <p className="text-[11px] font-bold text-slate-400 truncate">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-sm font-bold text-slate-600">
                      {String(user.role || "student").toUpperCase()}
                    </td>
                    <td className="px-8 py-6">
                      <span
                        className={`px-3 py-1 rounded-lg font-black text-[10px] uppercase tracking-widest ${
                          user.emailVerified
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}
                      >
                        {user.emailVerified ? "Verified" : "Unverified"}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-sm font-bold text-slate-500">
                      {user.lastLogin || "--"}
                    </td>
                    <td className="px-8 py-6 text-sm font-bold text-slate-500">
                      {user.createdAt || "--"}
                    </td>
                    <td className="px-8 py-6 text-right pr-12">
                      <button
                        onClick={() => openUser(user)}
                        className="p-3 bg-white border border-slate-100 text-[#2D70FD] rounded-xl hover:bg-blue-50 transition-all shadow-sm"
                        aria-label="View user"
                      >
                        <Eye size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-6 bg-white border-t border-slate-100">
              <p className="text-xs font-bold text-slate-500">
                Page {page} of {totalPages} | {total} users
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={!canPrev}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-black text-xs uppercase tracking-widest disabled:opacity-50"
                >
                  <ChevronLeft size={14} className="inline -mt-0.5 mr-1" />
                  Prev
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={!canNext}
                  className="px-4 py-2 rounded-xl bg-[#2D70FD] text-white font-black text-xs uppercase tracking-widest disabled:opacity-50"
                >
                  Next
                  <ChevronRight size={14} className="inline -mt-0.5 ml-1" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedUser ? (
        <Modal title="User Profile" onClose={closeUser}>
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-2xl bg-slate-100 overflow-hidden border border-slate-200 flex items-center justify-center shrink-0">
              {selectedUser.avatarUrl ? (
                <img
                  src={resolveMediaUrl(selectedUser.avatarUrl)}
                  alt={selectedUser.name}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      selectedUser.name || "User",
                    )}`;
                  }}
                />
              ) : (
                <Users size={22} className="text-slate-400" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-xl font-black text-slate-900 truncate">
                {selectedUser.name}
              </h3>
              <p className="text-sm font-bold text-slate-500 truncate">
                {selectedUser.email}
              </p>
              {selectedUser.schoolName ? (
                <p className="text-xs font-bold text-slate-400 mt-1 truncate">
                  {selectedUser.schoolName}
                </p>
              ) : null}
            </div>
            <button
              onClick={closeUser}
              className="ml-auto p-3 bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Role
              </p>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white font-bold text-slate-700 outline-none focus:border-[#2D70FD]"
              >
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Email Verification
              </p>
              <button
                type="button"
                onClick={() => setEditVerified((v) => !v)}
                className={`w-full px-4 py-3 rounded-2xl border font-black transition-all ${
                  editVerified
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {editVerified ? "Verified" : "Unverified"}
              </button>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:justify-end">
            <button
              onClick={closeUser}
              disabled={isSaving}
              className="px-6 py-3 rounded-xl border border-slate-200 text-slate-700 font-black disabled:opacity-60"
            >
              Close
            </button>
            <button
              onClick={saveUser}
              disabled={isSaving}
              className="px-6 py-3 rounded-xl bg-[#2D70FD] text-white font-black disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
};

const StatCard = ({ label, value, icon }) => (
  <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm flex items-center gap-4">
    <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#2D70FD] flex items-center justify-center">
      {icon}
    </div>
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
        {label}
      </p>
      <p className="text-2xl font-black text-slate-800">{value}</p>
    </div>
  </div>
);

const Modal = ({ title, children, onClose }) => (
  <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
    <div
      className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
      onClick={onClose}
    />
    <div className="relative w-full max-w-2xl rounded-[2.2rem] bg-white border border-slate-100 shadow-2xl p-8">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
        {title}
      </p>
      {children}
    </div>
  </div>
);

export default AdminUsers;
