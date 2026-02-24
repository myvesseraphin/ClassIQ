import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Search,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "react-toastify";
import api from "../../api/client";
import EmptyState from "../../Component/EmptyState";

const STATUS_FILTERS = [
  { label: "All", value: "" },
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
];

const safeLower = (value) => String(value || "").trim().toLowerCase();

const AdminRequests = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [requests, setRequests] = useState([]);
  const [statusCounts, setStatusCounts] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const requestedRequestId = String(searchParams.get("requestId") || "").trim();

  useEffect(() => {
    let active = true;
    setIsLoading(true);

    const timer = setTimeout(async () => {
      try {
        const offset = (page - 1) * pageSize;
        const { data } = await api.get("/admin/requests", {
          params: {
            status: statusFilter || undefined,
            q: searchQuery.trim() || undefined,
            limit: pageSize,
            offset,
          },
        });

        if (!active) return;
        const incoming = Array.isArray(data?.requests) ? data.requests : [];
        setRequests(incoming);
        setTotal(Number(data?.total) || 0);

        const counts = data?.statusCounts || {};
        setStatusCounts({
          pending: Number(counts.pending) || 0,
          approved: Number(counts.approved) || 0,
          rejected: Number(counts.rejected) || 0,
        });
      } catch (err) {
        console.error("Failed to load access requests", err);
        toast.error("Failed to load access requests.");
        if (active) {
          setRequests([]);
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
  }, [page, pageSize, searchQuery, statusFilter]);

  useEffect(() => {
    if (!requestedRequestId || requests.length === 0) return;
    const match = requests.find((r) => r.id === requestedRequestId);
    if (match) {
      setSelectedRequest(match);
    }
  }, [requestedRequestId, requests]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return requests;
    const q = searchQuery.trim().toLowerCase();
    return requests.filter((r) => {
      return (
        String(r.fullName || "").toLowerCase().includes(q) ||
        String(r.email || "").toLowerCase().includes(q) ||
        String(r.school || "").toLowerCase().includes(q)
      );
    });
  }, [requests, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const openRequest = (request) => {
    setSelectedRequest(request);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("requestId", request.id);
      return next;
    });
  };

  const closeRequest = () => {
    setSelectedRequest(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("requestId");
      return next;
    });
  };

  const updateRequestStatus = async (request, nextStatus) => {
    if (!request?.id) return;
    const normalizedStatus = safeLower(nextStatus);
    if (!["pending", "approved", "rejected"].includes(normalizedStatus)) {
      toast.error("Invalid status.");
      return;
    }

    setIsSaving(true);
    try {
      const { data } = await api.patch(`/admin/requests/${request.id}`, {
        status: normalizedStatus,
      });

      const updated = data?.request;
      if (!updated?.id) throw new Error("Invalid update response.");

      setRequests((prev) =>
        prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)),
      );
      setSelectedRequest((prev) =>
        prev?.id === updated.id ? { ...prev, ...updated } : prev,
      );

      toast.success("Request updated.");
    } catch (err) {
      console.error("Failed to update access request", err);
      toast.error(err?.response?.data?.error || "Failed to update request.");
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
            Access Requests
          </h1>
          <div className="relative w-full md:w-96 group">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#2D70FD]"
              size={20}
            />
            <input
              type="text"
              placeholder="Search name, email, school..."
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
          <StatCard
            label="Total"
            value={total}
            icon={<Eye size={18} />}
            tone="blue"
          />
          <StatCard
            label="Pending"
            value={statusCounts.pending}
            icon={<Eye size={18} />}
            tone="blue"
          />
          <StatCard
            label="Approved"
            value={statusCounts.approved}
            icon={<CheckCircle2 size={18} />}
            tone="green"
          />
          <StatCard
            label="Rejected"
            value={statusCounts.rejected}
            icon={<XCircle size={18} />}
            tone="red"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full pb-2 scrollbar-hide">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value || "all"}
              onClick={() => {
                setStatusFilter(filter.value);
                setPage(1);
              }}
              className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
                statusFilter === filter.value
                  ? "bg-[#2D70FD] text-white shadow-lg shadow-blue-100"
                  : "bg-white text-slate-500 border border-slate-200 hover:border-blue-100"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-8 py-5 text-xs font-black text-slate-400 tracking-tight uppercase">
                    Requester
                  </th>
                  <th className="px-8 py-5 text-xs font-black text-slate-400 tracking-tight uppercase">
                    School
                  </th>
                  <th className="px-8 py-5 text-xs font-black text-slate-400 tracking-tight uppercase">
                    Status
                  </th>
                  <th className="px-8 py-5 text-xs font-black text-slate-400 tracking-tight uppercase">
                    Created
                  </th>
                  <th className="px-8 py-5 text-right pr-12">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((reqItem) => (
                  <tr
                    key={reqItem.id}
                    className="hover:bg-blue-50/20 transition-colors"
                  >
                    <td className="px-8 py-6">
                      <p className="font-black text-slate-800 text-sm">
                        {reqItem.fullName || "Access request"}
                      </p>
                      <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                        {reqItem.email}
                      </p>
                    </td>
                    <td className="px-8 py-6 text-sm font-bold text-slate-600">
                      {reqItem.school || "--"}
                    </td>
                    <td className="px-8 py-6">
                      <StatusPill status={reqItem.status} />
                    </td>
                    <td className="px-8 py-6 text-sm font-bold text-slate-500">
                      {reqItem.createdAt || "--"}
                    </td>
                    <td className="px-8 py-6 text-right pr-12 space-x-2">
                      <button
                        onClick={() => openRequest(reqItem)}
                        className="p-3 bg-white border border-slate-100 text-[#2D70FD] rounded-xl hover:bg-blue-50 transition-all shadow-sm"
                        aria-label="View request"
                      >
                        <Eye size={18} />
                      </button>
                      {safeLower(reqItem.status) === "pending" ? (
                        <button
                          onClick={() => updateRequestStatus(reqItem, "approved")}
                          disabled={isSaving}
                          className="p-3 bg-white border border-slate-100 text-emerald-600 rounded-xl hover:bg-emerald-50 transition-all shadow-sm disabled:opacity-60"
                          aria-label="Approve"
                        >
                          <CheckCircle2 size={18} />
                        </button>
                      ) : null}
                      {safeLower(reqItem.status) === "pending" ? (
                        <button
                          onClick={() => updateRequestStatus(reqItem, "rejected")}
                          disabled={isSaving}
                          className="p-3 bg-white border border-slate-100 text-rose-600 rounded-xl hover:bg-rose-50 transition-all shadow-sm disabled:opacity-60"
                          aria-label="Reject"
                        >
                          <XCircle size={18} />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-6 bg-white border-t border-slate-100">
              <p className="text-xs font-bold text-slate-500">
                Page {page} of {totalPages} | {total} request(s)
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

      {selectedRequest ? (
        <Modal title="Request Details" onClose={closeRequest}>
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2D70FD] shrink-0">
              <Eye size={22} />
            </div>
            <div className="min-w-0">
              <h3 className="text-xl font-black text-slate-900 truncate">
                {selectedRequest.fullName || "Access request"}
              </h3>
              <p className="text-sm font-bold text-slate-500 truncate">
                {selectedRequest.email}
              </p>
              <p className="text-xs font-bold text-slate-400 mt-1 truncate">
                {selectedRequest.school || "School not set"} |{" "}
                {selectedRequest.createdAt || "--"}
              </p>
            </div>
            <button
              onClick={closeRequest}
              className="ml-auto p-3 bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mt-6 flex items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Status
              </p>
              <StatusPill status={selectedRequest.status} size="lg" />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateRequestStatus(selectedRequest, "pending")}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-black text-xs uppercase tracking-widest disabled:opacity-60"
              >
                Set Pending
              </button>
              <button
                onClick={() => updateRequestStatus(selectedRequest, "rejected")}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white font-black text-xs uppercase tracking-widest disabled:opacity-60"
              >
                Reject
              </button>
              <button
                onClick={() => updateRequestStatus(selectedRequest, "approved")}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-black text-xs uppercase tracking-widest disabled:opacity-60"
              >
                Approve
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
};

const StatusPill = ({ status, size = "sm" }) => {
  const value = safeLower(status);
  const common =
    size === "lg"
      ? "px-4 py-2 rounded-xl text-xs"
      : "px-3 py-1 rounded-lg text-[10px]";

  if (value === "approved") {
    return (
      <span
        className={`${common} font-black uppercase tracking-widest bg-emerald-50 text-emerald-600`}
      >
        Approved
      </span>
    );
  }
  if (value === "rejected") {
    return (
      <span
        className={`${common} font-black uppercase tracking-widest bg-rose-50 text-rose-600`}
      >
        Rejected
      </span>
    );
  }
  return (
    <span
      className={`${common} font-black uppercase tracking-widest bg-blue-50 text-[#2D70FD]`}
    >
      Pending
    </span>
  );
};

const StatCard = ({ label, value, icon, tone = "blue" }) => {
  const toneClasses =
    tone === "green"
      ? "bg-emerald-50 text-emerald-600"
      : tone === "red"
        ? "bg-rose-50 text-rose-600"
        : "bg-blue-50 text-[#2D70FD]";

  return (
    <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm flex items-center gap-4">
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center ${toneClasses}`}
      >
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
};

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

export default AdminRequests;
