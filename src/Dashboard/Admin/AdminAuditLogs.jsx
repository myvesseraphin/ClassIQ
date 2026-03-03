import React, { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "react-toastify";
import api from "../../api/client";

const AdminAuditLogs = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [actions, setActions] = useState([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedAction, setSelectedAction] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    let active = true;
    const loadUsers = async () => {
      try {
        const { data } = await api.get("/admin/users", {
          params: { limit: 200, offset: 0 },
        });
        if (!active) return;
        setUsers(Array.isArray(data?.users) ? data.users : []);
      } catch (err) {
        console.error("Failed to load users for audit filters", err);
      }
    };
    loadUsers();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadLogs = async () => {
      try {
        setIsLoading(true);
        const params = {
          q: searchQuery || undefined,
          userId: selectedUser || undefined,
          action: selectedAction || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          limit: 300,
          offset: 0,
        };
        const { data: logsData } = await api.get("/admin/audit-logs", { params });
        if (!active) return;
        setLogs(Array.isArray(logsData?.logs) ? logsData.logs : []);
        setActions(
          Array.isArray(logsData?.actions)
            ? logsData.actions.map((item) => item.action).filter(Boolean)
            : [],
        );
      } catch (err) {
        console.error("Failed to load audit logs", err);
        toast.error("Failed to load audit logs.");
      } finally {
        if (active) setIsLoading(false);
      }
    };

    const timer = setTimeout(loadLogs, 220);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery, selectedUser, selectedAction, dateFrom, dateTo]);

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
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">
            Audit Logs
          </h1>
          <p className="text-sm font-bold text-slate-400 mt-1">
            Trace every high-impact action across curriculum and user operations.
          </p>
        </div>

        <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search logs..."
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 outline-none focus:border-[#2D70FD]"
            />
          </div>
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 outline-none focus:border-[#2D70FD]"
          >
            <option value="">All users</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.email}
              </option>
            ))}
          </select>
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 outline-none focus:border-[#2D70FD]"
          >
            <option value="">All actions</option>
            {actions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 outline-none focus:border-[#2D70FD]"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 outline-none focus:border-[#2D70FD]"
          />
        </div>

        <div className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
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
                    Action
                  </th>
                  <th className="px-8 py-5 text-xs font-black text-slate-400 tracking-tight uppercase">
                    Affected Entity
                  </th>
                  <th className="px-8 py-5 text-xs font-black text-slate-400 tracking-tight uppercase">
                    Timestamp
                  </th>
                  <th className="px-8 py-5 text-xs font-black text-slate-400 tracking-tight uppercase">
                    IP / Device
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {logs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-8 py-12 text-center text-sm font-bold text-slate-400"
                    >
                      No audit logs found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  logs.map((item) => (
                    <tr key={item.id} className="hover:bg-blue-50/20 transition-colors">
                      <td className="px-8 py-5">
                        <p className="text-sm font-black text-slate-800">
                          {item.userName || item.userEmail || "Unknown"}
                        </p>
                        <p className="text-[11px] font-bold text-slate-400">
                          {item.userEmail || "--"}
                        </p>
                      </td>
                      <td className="px-8 py-5 text-sm font-bold text-slate-600">
                        {String(item.role || "--").toUpperCase()}
                      </td>
                      <td className="px-8 py-5 text-sm font-bold text-slate-600">
                        {item.action || "--"}
                      </td>
                      <td className="px-8 py-5 text-sm font-bold text-slate-600">
                        {item.entity || "--"}
                      </td>
                      <td className="px-8 py-5 text-sm font-bold text-slate-500">
                        {item.timestamp || "--"}
                      </td>
                      <td className="px-8 py-5 text-sm font-bold text-slate-400">
                        {item.ipAddress || item.device || "--"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAuditLogs;
