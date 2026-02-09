import React, { useState } from "react";
import {
  CheckCircle2,
  Trash2,
  Plus,
  X,
  Calendar,
  ChevronLeft,
  Loader2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../api/client";

const Tasks = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddTask, setShowAddTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [taskPriority, setTaskPriority] = useState("medium");
  const [filter, setFilter] = useState("all");

  React.useEffect(() => {
    let isMounted = true;
    const loadTasks = async () => {
      try {
        const { data } = await api.get("/student/tasks");
        if (isMounted && Array.isArray(data?.tasks)) {
          setTasks(data.tasks);
        }
      } catch (err) {
        console.error("Failed to load tasks", err);
        toast.error("Failed to load tasks.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadTasks();
    return () => {
      isMounted = false;
    };
  }, []);

  const addTask = async () => {
    if (!taskTitle.trim()) return;
    try {
      const { data } = await api.post("/student/tasks", {
        title: taskTitle,
        due: taskDue || undefined,
        priority: taskPriority,
      });
      setTasks((prev) => [...prev, data.task]);
      setTaskTitle("");
      setTaskDue("");
      setTaskPriority("medium");
      setShowAddTask(false);
    } catch (err) {
      console.error("Failed to add task", err);
      toast.error("Failed to add task.");
    }
  };

  const toggleTask = async (id) => {
    const current = tasks.find((t) => t.id === id);
    if (!current) return;
    try {
      const { data } = await api.patch(`/student/tasks/${id}`, {
        completed: !current.completed,
      });
      setTasks((prev) => prev.map((t) => (t.id === id ? data.task : t)));
    } catch (err) {
      console.error("Failed to update task", err);
      toast.error("Failed to update task.");
    }
  };

  const deleteTask = async (id) => {
    try {
      await api.delete(`/student/tasks/${id}`);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error("Failed to delete task", err);
      toast.error("Failed to delete task.");
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (filter === "completed") return t.completed;
    if (filter === "pending") return !t.completed;
    return true;
  });

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "high":
        return "bg-blue-50 border-blue-200 text-blue-700";
      case "medium":
        return "bg-slate-50 border-slate-200 text-slate-700";
      case "low":
        return "bg-green-50 border-green-200 text-green-700";
      default:
        return "bg-slate-50 border-slate-200 text-slate-700";
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <div className="flex-1 flex flex-col min-w-0 relative">
        <main className="flex-1 overflow-y-auto p-8 lg:p-12">
          <div className="max-w-4xl mx-auto space-y-10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigate("/student")}
                  className="p-3 rounded-2xl bg-white border border-slate-100 text-slate-400 hover:text-blue-600 transition-colors"
                >
                  <ChevronLeft size={24} />
                </button>
                <div className="p-3 rounded-2xl bg-white border border-slate-100 text-blue-600">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <h1 className="text-4xl font-black text-slate-900 tracking-tight">
                    Tasks
                  </h1>
                  <p className="text-sm text-slate-400 font-bold">
                    Track and manage all your tasks
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddTask(true)}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black text-sm uppercase tracking-wider flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg active:scale-95"
              >
                <Plus size={18} /> New Task
              </button>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2">
              {["all", "pending", "completed"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-6 py-2 rounded-full font-black text-sm uppercase tracking-wider transition-all whitespace-nowrap ${
                    filter === f
                      ? "bg-blue-600 text-white shadow-lg"
                      : "bg-white border border-slate-200 text-slate-600 hover:border-blue-200"
                  }`}
                >
                  {f === "all"
                    ? "All Tasks"
                    : f === "pending"
                      ? "Pending"
                      : "Completed"}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {isLoading ? (
                <div className="text-center py-20 bg-white rounded-[2rem] border border-slate-100">
                  <Loader2
                    className="mx-auto mb-4 text-blue-600 animate-spin"
                    size={36}
                  />
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-[2rem] border border-slate-100">
                  <CheckCircle2
                    className="mx-auto mb-4 text-slate-300"
                    size={48}
                  />
                  <p className="font-black text-slate-400 uppercase tracking-widest">
                    {filter === "completed"
                      ? "No completed tasks"
                      : filter === "pending"
                        ? "No pending tasks"
                        : "No tasks yet"}
                  </p>
                  <p className="text-sm text-slate-400 mt-2">
                    Create one to get started
                  </p>
                </div>
              ) : (
                filteredTasks.map((task) => (
                  <div
                    key={task.id}
                    className="bg-white border border-slate-100 rounded-2xl p-6 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start gap-4">
                      <button
                        onClick={() => toggleTask(task.id)}
                        className="mt-1 flex-shrink-0 transition-all"
                      >
                        <CheckCircle2
                          size={24}
                          className={
                            task.completed
                              ? "text-green-600 fill-green-50"
                              : "text-slate-300"
                          }
                        />
                      </button>
                      <div className="flex-1 min-w-0">
                        <h3
                          className={`text-lg font-black transition-all ${task.completed ? "line-through text-slate-400" : "text-slate-900"}`}
                        >
                          {task.title}
                        </h3>
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <span
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold border ${getPriorityColor(task.priority)}`}
                          >
                            {task.priority.charAt(0).toUpperCase() +
                              task.priority.slice(1)}{" "}
                            Priority
                          </span>
                          <span className="flex items-center gap-1 text-sm text-slate-500 font-bold">
                            <Calendar size={14} /> {task.due || "No due date"}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-50 rounded-lg text-slate-300 hover:text-red-600"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      </div>

      {showAddTask && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12 bg-black/20 backdrop-blur-sm">
          <div className="relative bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-8 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black text-slate-900">New Task</h2>
                <button
                  onClick={() => setShowAddTask(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider block mb-2">
                    Task Title
                  </label>
                  <input
                    type="text"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder="Enter task title..."
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
                    onKeyPress={(e) => e.key === "Enter" && addTask()}
                  />
                </div>

                <div>
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider block mb-2">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={taskDue}
                    onChange={(e) => setTaskDue(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider block mb-2">
                    Priority
                  </label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all font-bold"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowAddTask(false)}
                  className="flex-1 px-4 py-3 border border-slate-200 rounded-xl font-black text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={addTask}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-black text-sm hover:bg-blue-700 transition-colors active:scale-95"
                >
                  Add Task
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tasks;
