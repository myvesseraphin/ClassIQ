import React, { useState } from "react";
import { Bell, X, Trash, CheckCircle } from "lucide-react";
import { toast } from "react-toastify";
import api from "../../api/client";
import EmptyState from "../../Component/EmptyState";
import StudentPageSkeleton from "../../Component/StudentPageSkeleton";

const Notifications = () => {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  React.useEffect(() => {
    let isMounted = true;
    const loadNotifications = async () => {
      try {
        const { data } = await api.get("/student/notifications");
        if (isMounted && Array.isArray(data?.notifications)) {
          setItems(data.notifications);
        }
      } catch (err) {
        console.error("Failed to load notifications", err);
        toast.error("Failed to load notifications.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadNotifications();
    return () => {
      isMounted = false;
    };
  }, []);

  const markRead = async (id) => {
    try {
      const { data } = await api.patch(`/student/notifications/${id}/read`);
      setItems((s) =>
        s.map((it) => (it.id === id ? data.notification : it)),
      );
    } catch (err) {
      console.error("Failed to mark notification read", err);
      toast.error("Failed to update notification.");
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/student/notifications/${id}`);
      setItems((s) => s.filter((it) => it.id !== id));
    } catch (err) {
      console.error("Failed to remove notification", err);
      toast.error("Failed to remove notification.");
    }
  };

  const clearAll = async () => {
    try {
      await api.delete("/student/notifications");
      setItems([]);
    } catch (err) {
      console.error("Failed to clear notifications", err);
      toast.error("Failed to clear notifications.");
    }
  };

  if (isLoading) {
    return <StudentPageSkeleton variant="notifications" />;
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 relative">
        <main className="flex-1 overflow-y-auto p-8 lg:p-12">
          <div className="max-w-7xl mx-auto space-y-10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-white border border-slate-100 text-[#2D70FD]">
                  <Bell size={20} />
                </div>
                <div>
                  <h1 className="text-4xl font-black text-slate-900 tracking-tight">
                    Notifications
                  </h1>
                  <p className="text-sm text-slate-400 font-bold">
                    Recent activity and alerts
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={clearAll}
                  className="px-4 py-2 bg-white border border-slate-100 rounded-2xl font-bold text-sm text-slate-600 hover:bg-slate-50"
                >
                  <Trash size={16} className="inline-block mr-2" /> Clear All
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {items.length === 0 ? (
                <EmptyState />
              ) : (
                items.map((n) => (
                  <div
                    key={n.id}
                    className={`bg-white p-4 rounded-2xl border border-slate-100 flex items-start justify-between ${n.read ? "opacity-70" : "shadow-sm"}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center text-[#2D70FD]">
                        <CheckCircle size={18} />
                      </div>
                      <div>
                        <h4 className="font-black text-slate-800">{n.title}</h4>
                        <p className="text-sm font-bold text-slate-400">
                          {n.body}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-2">
                          {n.time}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {!n.read && (
                        <button
                          onClick={() => markRead(n.id)}
                          className="px-3 py-2 bg-blue-600 text-white rounded-2xl font-black text-xs"
                        >
                          Mark read
                        </button>
                      )}
                      <button
                        onClick={() => remove(n.id)}
                        className="p-2 bg-slate-50 rounded-lg text-slate-400 hover:text-rose-500"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Notifications;
