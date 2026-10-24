import { useState } from "react";
import { useRecruitmentStore } from "../../../stores/recruitmentStore";
import { DataTable } from "../../../components/hrms/DataTable";
import { Modal } from "../../../components/hrms/Modal";
import { Button } from "../../../components/hrms/Button";
import { useAppStore } from "../../../stores/appStore";
import { useNavigate } from "react-router-dom";
import PageHeader from "../../../components/ui/PageHeader";
import {
  Eye,
  Pencil,
  Trash2,
  Plus,
  HelpCircle,
  CheckCircle2,
  ListFilter,
  FileQuestion,
  Layers,
  ToggleLeft,
  ToggleRight
} from "lucide-react";

const QUESTION_TYPES = [
  "Short Answer",
  "Long Answer",
  "Single Select",
  "Multiple Select",
  "Yes / No",
  "Number",
];

export default function CustomQuestions() {
  const { questions, addQuestion, updateQuestion, deleteQuestion, toggleQuestion } = useRecruitmentStore();
  const showToast = useAppStore((s) => s.showToast);
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [viewRow, setViewRow] = useState(null);
  const [editRow, setEditRow] = useState(null);
  const [deleteRow, setDeleteRow] = useState(null);
  const [form, setForm] = useState({ text: "", type: "Short Answer", enabled: true });

  const data = questions || [];

  function save() {
    if (!form.text.trim()) {
      showToast("Question text required");
      return;
    }
    if (editRow) {
      updateQuestion(editRow.id, { text: form.text, type: form.type, enabled: form.enabled });
      showToast("Question updated successfully");
      setEditRow(null);
    } else {
      addQuestion({
        id: `Q-${String(data.length + 1).padStart(2, "0")}`,
        text: form.text,
        type: form.type,
        enabled: form.enabled,
        assignedJobs: [],
      });
      showToast("Question added successfully");
      setAddOpen(false);
    }
  }

  const enabledCount = data.filter((q) => q.enabled).length;

  const cols = [
    {
      key: "text",
      header: "Question Prompt",
      sortable: true,
      render: (r) => (
        <div className="flex items-start gap-2.5 max-w-[420px]">
          <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 mt-0.5 shrink-0">
            <FileQuestion size={14} />
          </div>
          <div>
            <span className="font-semibold text-slate-800 dark:text-slate-100 block text-[13px] leading-snug">
              {r.text}
            </span>
            <span className="text-[11px] text-muted block mt-0.5">ID: {r.id}</span>
          </div>
        </div>
      ),
    },
    {
      key: "type",
      header: "Response Type",
      render: (r) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11.5px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
          {r.type}
        </span>
      ),
    },
    {
      key: "enabled",
      header: "Status",
      render: (r) => (
        <button
          onClick={() => {
            toggleQuestion(r.id);
            showToast(r.enabled ? "Question disabled" : "Question enabled");
          }}
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition cursor-pointer ${
            r.enabled
              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800"
              : "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
          }`}
        >
          {r.enabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
          <span>{r.enabled ? "Active" : "Disabled"}</span>
        </button>
      ),
    },
    {
      key: "assignedJobs",
      header: "Assigned Openings",
      render: (r) =>
        r.assignedJobs?.length ? (
          <div className="flex flex-wrap gap-1 max-w-[200px]">
            {r.assignedJobs.map((j) => (
              <span
                key={j}
                className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10.5px]"
              >
                {j}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-[11.5px] text-slate-400 italic">All Open Postings</span>
        ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (r) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewRow(r)}
            className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
            title="View details"
          >
            <Eye size={13} />
          </button>
          <button
            onClick={() => {
              setForm({ text: r.text, type: r.type, enabled: r.enabled });
              setEditRow(r);
            }}
            className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
            title="Edit question"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => setDeleteRow(r)}
            className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
            title="Delete question"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ),
    },
  ];

  function FormFields() {
    return (
      <div className="space-y-4 text-[13px]">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11.5px] font-medium text-slate-700 dark:text-slate-300">
            Question Prompt *
          </span>
          <input
            value={form.text}
            onChange={(e) => setForm({ ...form, text: e.target.value })}
            className="h-9 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 text-[13px]"
            placeholder="e.g. What is your notice period in days?"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11.5px] font-medium text-slate-700 dark:text-slate-300">
            Response Type
          </span>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="h-9 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 text-[13px]"
          >
            {QUESTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
          />
          <span className="text-[13px] font-medium text-slate-700 dark:text-slate-300">
            Enable question immediately on application forms
          </span>
        </label>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Page Header */}
      <PageHeader
        title="Custom Screening Questions"
        subtitle="Design pre-screening questions, compliance checks, and assessment inputs for job applicants."
        breadcrumb={[
          { label: "HRMS", path: "/hrms" },
          { label: "Recruitment", path: "/hrms/recruitment" },
          { label: "Custom Questions" },
        ]}
        actions={
          <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-[12px] font-medium transition cursor-pointer"
            >
              <HelpCircle size={14} />
              <span>Guide</span>
            </button>
            <Button
              size="sm"
              onClick={() => {
                setForm({ text: "", type: "Short Answer", enabled: true });
                setAddOpen(true);
              }}
              className="flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus size={15} />
              <span>Add Question</span>
            </Button>
          </div>
        }
      />

      {/* KPI Metric Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {[
          {
            label: "Total Questions",
            count: data.length,
            sub: "In screening library",
            icon: FileQuestion,
            color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200/60",
          },
          {
            label: "Active on Postings",
            count: enabledCount,
            sub: "Live for candidate forms",
            icon: CheckCircle2,
            color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200/60",
          },
          {
            label: "Supported Formats",
            count: QUESTION_TYPES.length,
            sub: "Text, dropdown, number, yes/no",
            icon: Layers,
            color: "text-amber-600 bg-amber-50 dark:bg-amber-950/30 border-amber-200/60",
          },
        ].map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.label}
              className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-xs flex items-center justify-between"
            >
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {m.label}
                </div>
                <div className="text-2xl font-bold text-slate-800 dark:text-white mt-1">
                  {m.count}
                </div>
                <div className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {m.sub}
                </div>
              </div>
              <div className={`p-2.5 rounded-xl border ${m.color}`}>
                <Icon size={20} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <DataTable
        columns={cols}
        data={data}
        emptyTitle="No screening questions"
        emptyDesc="Create questions to qualify candidates automatically when they submit applications."
        emptyAction={
          <Button
            size="sm"
            onClick={() => {
              setForm({ text: "", type: "Short Answer", enabled: true });
              setAddOpen(true);
            }}
          >
            + Add Question
          </Button>
        }
      />

      {/* Add Modal */}
      <Modal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        title="Create Custom Question"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>Save Question</Button>
          </>
        }
      >
        <FormFields />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editRow}
        onClose={() => setEditRow(null)}
        title="Edit Screening Question"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditRow(null)}>
              Cancel
            </Button>
            <Button onClick={save}>Update Question</Button>
          </>
        }
      >
        <FormFields />
      </Modal>

      {/* View Question Modal */}
      <Modal
        isOpen={!!viewRow}
        onClose={() => setViewRow(null)}
        title={viewRow?.text ?? "Question Details"}
        subtitle={`${viewRow?.type} • ${viewRow?.enabled ? "Enabled" : "Disabled"}`}
        size="md"
        footer={
          <Button variant="secondary" onClick={() => setViewRow(null)}>
            Close
          </Button>
        }
      >
        {viewRow && (
          <div className="space-y-4 text-[13px] text-slate-600 dark:text-slate-300">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Full Prompt
              </span>
              <p className="font-medium text-slate-800 dark:text-white">{viewRow.text}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Associated Openings
              </span>
              <p className="text-slate-700 dark:text-slate-300">
                {viewRow.assignedJobs?.length
                  ? viewRow.assignedJobs.join(", ")
                  : "Included in all default open applications"}
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteRow}
        onClose={() => setDeleteRow(null)}
        title="Delete Question?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteRow(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (deleteRow) deleteQuestion(deleteRow.id);
                setDeleteRow(null);
                showToast("Question deleted successfully");
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-slate-600 dark:text-slate-300">
          Are you sure you want to remove <b>"{deleteRow?.text}"</b>? It will no longer appear on applicant forms.
        </p>
      </Modal>

      {/* Guide Modal */}
      {guideOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-xs"
          onClick={() => setGuideOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-lg w-full p-4 sm:p-6 max-h-[95vh] overflow-y-auto text-[13px] text-slate-600 dark:text-slate-300 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600">
                  <HelpCircle size={18} />
                </div>
                <h3 className="text-[16px] font-bold text-slate-900 dark:text-white">
                  Custom Questions Guide
                </h3>
              </div>
              <button
                onClick={() => setGuideOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700">
                <div className="font-semibold text-slate-800 dark:text-slate-100 mb-1">
                  1. Pre-Screening Efficiency
                </div>
                <p className="text-[12px] text-slate-500 dark:text-slate-400">
                  Filter out disqualified applicants early by asking notice periods, salary expectations, work authorization, or key coding questions.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700">
                <div className="font-semibold text-slate-800 dark:text-slate-100 mb-1">
                  2. Dynamic Toggle
                </div>
                <p className="text-[12px] text-slate-500 dark:text-slate-400">
                  Easily disable questions without deleting them to pause their appearance during specific hiring sprints.
                </p>
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <Button size="sm" onClick={() => setGuideOpen(false)}>
                Got it
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}