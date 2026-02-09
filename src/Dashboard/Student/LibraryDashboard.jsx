import React from "react";
import { Link } from "react-router-dom";
import { BookOpen, UploadCloud, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import api from "../../api/client";
import EmptyState from "../../Component/EmptyState";

const LibraryDashboard = () => {
  const [stats, setStats] = React.useState({
    totalResources: 0,
    myUploads: 0,
  });
  const [recent, setRecent] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let isMounted = true;
    const loadStats = async () => {
      try {
        const { data } = await api.get("/library/stats");
        if (isMounted) {
          setStats(data?.stats || { totalResources: 0, myUploads: 0 });
          setRecent(Array.isArray(data?.recent) ? data.recent : []);
        }
      } catch (err) {
        console.error("Failed to load library stats", err);
        toast.error("Failed to load library stats.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadStats();
    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 relative">
        <main className="flex-1 overflow-y-auto p-8 lg:p-12">
          <div className="max-w-7xl mx-auto space-y-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h1 className="text-4xl font-black text-slate-900 tracking-tight">
                  ClassIQ Library
                </h1>
                <p className="text-sm text-slate-500 font-semibold mt-2">
                  Share and explore resources across the community.
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white border border-slate-100 rounded-[2rem] p-6">
                <div className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Total Resources
                </div>
                <div className="text-3xl font-black text-slate-900 mt-3">
                  {stats.totalResources}
                </div>
              </div>
              <div className="bg-white border border-slate-100 rounded-[2rem] p-6">
                <div className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  My Uploads
                </div>
                <div className="text-3xl font-black text-slate-900 mt-3">
                  {stats.myUploads}
                </div>
              </div>
              <div className="bg-white border border-slate-100 rounded-[2rem] p-6">
                <div className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Latest Uploads
                </div>
                <div className="text-3xl font-black text-slate-900 mt-3">
                  {recent.length}
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-[2rem] p-6 md:p-8 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black text-slate-900">
                  Recent Uploads
                </h2>
                <Link
                  to="/library/resources"
                  className="text-sm font-bold text-blue-600 hover:underline"
                >
                  View all
                </Link>
              </div>
              {recent.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="space-y-4">
                  {recent.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 rounded-2xl bg-slate-50"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-[#2D70FD]">
                          <BookOpen size={22} />
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-slate-900">
                            {item.name}
                          </h3>
                          <p className="text-xs font-bold text-slate-400">
                            {item.subject} • {item.type} • {item.size}
                          </p>
                        </div>
                      </div>
                      <div className="text-xs font-bold text-slate-500">
                        {item.uploadedBy} • {item.date}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default LibraryDashboard;
