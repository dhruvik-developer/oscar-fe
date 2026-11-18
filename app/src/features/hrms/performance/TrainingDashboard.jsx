import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAppStore } from "../../../stores/appStore";
import { useTrainingStore } from "../../../stores/trainingStore";
import {
  GraduationCap,
  Users,
  CalendarCheck,
  Award,
  BookOpen,
  TrendingUp,
  Clock,
  BarChart3,
  ArrowRight,
  ListFilter,
  Layers,
  LayoutDashboard,
  Plus,
} from "lucide-react";

import TrainingList from "./TrainingList";
import TrainingFunnel from "./TrainingFunnel";
import Trainers from "./Trainers";
import PageInfoButton from "../../../components/common/PageInfoButton";
import { hrmsGuides } from "../../../data/hrms/hrmsGuides";

export default function TrainingDashboard({ initialTab }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const showToast = useAppStore((s) => s.showToast);
  const { trainings, trainers } = useTrainingStore();

  const queryTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(queryTab || initialTab || "overview");

  useEffect(() => {
    if (queryTab && queryTab !== activeTab) {
      setActiveTab(queryTab);
    }
  }, [queryTab, activeTab]);

  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    setSearchParams(tabKey === "overview" ? {} : { tab: tabKey });
  };

  const getParticipantCount = (p) => {
    if (Array.isArray(p)) return p.length;
    if (typeof p === "number") return p;
    if (typeof p === "string" && !isNaN(Number(p))) return Number(p);
    if (p && typeof p === "object") return 1;
    return 0;
  };

  const totalTrainings = trainings.length;
  const activeTrainings = trainings.filter((t) => t.stage !== "Cancelled");
  const totalEnrolled = trainings.reduce((sum, t) => sum + getParticipantCount(t.participants), 0);
  const upcomingCount = trainings.filter((t) =>
    ["Scheduled", "Trainer Assigned", "Requested"].includes(t.stage)
  ).length;
  const completedCount = trainings.filter((t) =>
    ["Completed", "Evaluated"].includes(t.stage)
  ).length;
  const completionRate =
    activeTrainings.length > 0
      ? Math.round((completedCount / activeTrainings.length) * 100)
      : 0;

  const stats = [
    { label: "Active Programs", value: String(activeTrainings.length), icon: BookOpen, color: "bg-[#eff6ff]", iconColor: "text-[#2563eb]" },
    { label: "Enrolled", value: String(totalEnrolled), icon: Users, color: "bg-[#f0fdf4]", iconColor: "text-[#15803d]" },
    { label: "Upcoming", value: String(upcomingCount), icon: Clock, color: "bg-[#fffbeb]", iconColor: "text-[#b45309]" },
    { label: "Completion", value: `${completionRate}%`, icon: TrendingUp, color: "bg-[#faf5ff]", iconColor: "text-[#7c3aed]" },
    { label: "Certificates", value: String(trainings.filter((t) => ["Completed", "Evaluated"].includes(t.stage)).reduce((sum, t) => sum + (t.certificates != null ? Number(t.certificates) || 0 : getParticipantCount(t.participants)), 0)), icon: Award, color: "bg-[#fef2f2]", iconColor: "text-[#dc2626]" },
  ];

  const recentPrograms = trainings.slice(0, 6);

  const statusBadge = (status) => {
    const map = {
      "Completed": "bg-[#e6f4ea] text-[#15803d] border-[#a7f3d0]",
      "Evaluated": "bg-[#ecfccb] text-[#3f6212] border-[#bef264]",
      "Ongoing": "bg-[#eff6ff] text-[#2563eb] border-[#bfdbfe]",
      "In Progress": "bg-[#eff6ff] text-[#2563eb] border-[#bfdbfe]",
      "Scheduled": "bg-[#fffbeb] text-[#b45309] border-[#fde68a]",
      "Trainer Assigned": "bg-[#ecfeff] text-[#0e7490] border-[#a5f3fc]",
      "Requested": "bg-[#f8fafc] text-[#475569] border-[#e2e8f0]",
      "Planned": "bg-[#f8fafc] text-[#475569] border-[#e2e8f0]",
      "Cancelled": "bg-[#fff1f2] text-[#be123c] border-[#fecdd3]",
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${map[status] || map["Planned"]}`}>
        {status}
      </span>
    );
  };

  const upcomingSessions = trainings
    .filter((t) => ["Scheduled", "Trainer Assigned", "Ongoing"].includes(t.stage))
    .slice(0, 3)
    .map((t) => ({
      id: t.id,
      program: t.name || t.title || "Training",
      session: t.session || t.type || t.name || t.title || "Session",
      date: [t.start || t.startDate, t.time].filter(Boolean).join(", ") || "—",
      trainer: t.trainer || t.trainerName || "Unassigned",
    }));

  const tabs = [
    { key: "overview", label: "Overview", icon: LayoutDashboard },
    { key: "list", label: "Training Programs", icon: BookOpen, badge: totalTrainings },
    { key: "funnel", label: "Training Funnel", icon: BarChart3 },
    { key: "trainers", label: "Trainer Directory", icon: GraduationCap, badge: trainers.length },
  ];

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[12px] font-medium text-slate-400 flex items-center gap-1">
            <span>Home</span>
            <span>&gt;</span>
            <span className="text-slate-600">Training</span>
          </div>
          <div className="mt-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-[24px] font-extrabold text-slate-900 tracking-tight">Training Management</h1>
              <PageInfoButton guide={hrmsGuides.trainingDashboard} />
            </div>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Unified training setup: overview, programs list, funnel progression & trainers directory
            </p>
          </div>
        </div>

        <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
          {activeTab === "overview" && (
            <button
              type="button"
              onClick={() => handleTabChange("funnel")}
              className="bg-[#1b2b4a] hover:bg-[#111f36] text-white rounded-xl px-5 py-2.5 font-bold text-[13.5px] transition shadow-2xs cursor-pointer flex items-center gap-1.5"
            >
              <Plus size={16} />
              Create Program
            </button>
          )}
        </div>
      </div>

      {/* Unified Tab Bar */}
      <div className="flex items-center gap-1.5 border-b border-[#e2e8f0] pb-1 overflow-x-auto scrollbar-none">
        {tabs.map((t) => {
          const isActive = activeTab === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => handleTabChange(t.key)}
              className={`flex items-center gap-2 shrink-0 lg:shrink px-4 py-2.5 rounded-xl text-[13px] font-medium transition cursor-pointer whitespace-nowrap ${
                isActive
                  ? "bg-[#1b2b4a] text-white shadow-2xs font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Icon size={16} />
              <span>{t.label}</span>
              {t.badge !== undefined && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[11px] font-bold ${
                    isActive ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content: Overview */}
      {activeTab === "overview" && (
        <div className="flex flex-col gap-5 w-full">
          {/* 5 Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
            {stats.map((s) => (
              <div key={s.label} className="bg-white border border-[#e2e8f0] rounded-2xl p-4 shadow-2xs flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl ${s.color} flex items-center justify-center flex-shrink-0`}>
                  <s.icon size={18} className={s.iconColor} />
                </div>
                <div>
                  <div className="text-[12px] font-medium text-slate-500">{s.label}</div>
                  <div className="text-[20px] font-bold text-slate-900 mt-0.5">{s.value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Navigation Cards switching to embedded tabs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <button
              type="button"
              onClick={() => handleTabChange("list")}
              className="bg-white border border-[#e2e8f0] rounded-2xl p-4 shadow-2xs flex items-center justify-between hover:bg-slate-50 transition cursor-pointer text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#eff6ff] flex items-center justify-center">
                  <BookOpen size={18} className="text-[#2563eb]" />
                </div>
                <div>
                  <div className="text-[14px] font-bold text-slate-800">Training Programs</div>
                  <div className="text-[12px] text-slate-500">{totalTrainings} active programs</div>
                </div>
              </div>
              <ArrowRight size={16} className="text-slate-400 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("funnel")}
              className="bg-white border border-[#e2e8f0] rounded-2xl p-4 shadow-2xs flex items-center justify-between hover:bg-slate-50 transition cursor-pointer text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#faf5ff] flex items-center justify-center">
                  <BarChart3 size={18} className="text-[#7c3aed]" />
                </div>
                <div>
                  <div className="text-[14px] font-bold text-slate-800">Training Funnel</div>
                  <div className="text-[12px] text-slate-500">{completionRate}% completion rate</div>
                </div>
              </div>
              <ArrowRight size={16} className="text-slate-400 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("trainers")}
              className="bg-white border border-[#e2e8f0] rounded-2xl p-4 shadow-2xs flex items-center justify-between hover:bg-slate-50 transition cursor-pointer text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#f0fdf4] flex items-center justify-center">
                  <GraduationCap size={18} className="text-[#15803d]" />
                </div>
                <div>
                  <div className="text-[14px] font-bold text-slate-800">Trainer Directory</div>
                  <div className="text-[12px] text-slate-500">{trainers.length} active trainers</div>
                </div>
              </div>
              <ArrowRight size={16} className="text-slate-400 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Two Column Layout: Recent Programs & Upcoming Sessions */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left: Recent Programs Table */}
            <div className="lg:col-span-8 bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-2xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[15px] font-bold text-slate-800">Recent Programs</h3>
                <button
                  type="button"
                  onClick={() => handleTabChange("list")}
                  className="text-[12px] font-semibold text-[#1e3a8a] hover:underline cursor-pointer"
                >
                  View All →
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] lg:min-w-0 text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-[#e2e8f0] text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="pb-2.5">Program</th>
                      <th className="pb-2.5">Trainer</th>
                      <th className="pb-2.5">Date</th>
                      <th className="pb-2.5">Participants</th>
                      <th className="pb-2.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentPrograms.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-[12.5px] text-slate-400">
                          No training programs yet.
                        </td>
                      </tr>
                    )}
                    {recentPrograms.map((p) => {
                      const participantCount = getParticipantCount(p.participants);
                      const programName = p.name || p.title || "Untitled Program";
                      const trainerName = p.trainer || p.trainerName || "Unassigned";
                      const dateDisplay = p.start || p.startDate || "—";
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/50 transition">
                          <td className="py-3 font-semibold text-slate-800">{programName}</td>
                          <td className="py-3 text-slate-600">
                            <div className="flex items-center gap-1.5">
                              {p.avatar ? (
                                <img src={p.avatar} alt="" className="w-5 h-5 rounded-full" />
                              ) : null}
                              <span>{trainerName}</span>
                            </div>
                          </td>
                          <td className="py-3 text-slate-500 text-[12px]">{dateDisplay}</td>
                          <td className="py-3 text-slate-700 font-medium">{participantCount}</td>
                          <td className="py-3 text-right">{statusBadge(p.stage || p.status)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: Upcoming Sessions */}
            <div className="lg:col-span-4 bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-2xs">
              <h3 className="text-[15px] font-bold text-slate-800 mb-4">Upcoming Sessions</h3>

              <div className="flex flex-col gap-3">
                {upcomingSessions.length === 0 && (
                  <div className="text-[12.5px] text-slate-400 text-center py-4">No upcoming sessions.</div>
                )}
                {upcomingSessions.map((s) => (
                  <div key={s.id} className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3.5">
                    <div className="text-[13px] font-semibold text-slate-800">{s.session}</div>
                    <div className="text-[12px] text-slate-500 mt-1">{s.program}</div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[11px] text-slate-400 font-medium">{s.date}</span>
                      <span className="text-[11px] text-slate-500 font-medium">{s.trainer}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick Stats */}
              <div className="mt-4 bg-[#fffbeb] border border-[#fde68a] rounded-xl p-3.5">
                <div className="flex items-center gap-2 text-[12px] font-medium text-[#b45309]">
                  <CalendarCheck size={14} />
                  <span>{upcomingCount} sessions in pipeline • 7-stage Funnel active</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: Programs List */}
      {activeTab === "list" && (
        <TrainingList embedded={true} onBack={() => handleTabChange("overview")} />
      )}

      {/* Tab Content: Training Funnel */}
      {activeTab === "funnel" && (
        <TrainingFunnel embedded={true} onBack={() => handleTabChange("overview")} />
      )}

      {/* Tab Content: Trainer Directory */}
      {activeTab === "trainers" && (
        <Trainers embedded={true} onBack={() => handleTabChange("overview")} />
      )}
    </div>
  );
}
