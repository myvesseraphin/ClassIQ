import React, { useState } from "react";
import { Bell, X, Trash, CheckCircle, Loader2 } from "lucide-react";

const sample = [
  {
    id: 1,
    title: "New Assessment Available",
    body: "A new assessment for Mathematics has been posted.",
    time: "2h ago",
    read: false,
  },
  {
    id: 2,
    title: "Profile Updated",
    body: "Your profile was successfully updated.",
    time: "1d ago",
    read: true,
  },
  {
    id: 3,
    title: "Course Reminder",
    body: "Don't forget your Chemistry lab tomorrow at 10:00.",
    time: "3d ago",
    read: false,
  },
];

const Notifications = () => {
  const [items, setItems] = useState(sample);

  const markRead = (id) => {
    setItems((s) => s.map((it) => (it.id === id ? { ...it, read: true } : it)));
  };

  const remove = (id) => setItems((s) => s.filter((it) => it.id !== id));

  const clearAll = () => setItems([]);

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
                <div className="text-center py-20 bg-white rounded-[1.5rem] border border-slate-100">
                  <Loader2
                    className="animate-spin text-blue-600 mx-auto mb-4"
                    size={36}
                  />
                  <p className="font-black text-slate-400 uppercase tracking-widest">
                    No notifications
                  </p>
                </div>
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
