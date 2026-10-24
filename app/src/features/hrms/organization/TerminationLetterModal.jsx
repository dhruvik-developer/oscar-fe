import React, { useState, useEffect } from "react";
import {
  X,
  Printer,
  Edit3,
  Eye,
  CheckCircle2,
  FileText,
  Building2,
  AlertCircle,
  Save,
  Calendar,
  User,
} from "lucide-react";

export default function TerminationLetterModal({
  isOpen,
  onClose,
  termination,
  onUpdateTermination,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (termination) {
      const existing = termination.letterContent;
      setFormData({
        refNumber:
          existing?.refNumber ||
          `EV/TRM/2024/${termination.id || "101"}`,
        issueDate:
          existing?.issueDate ||
          termination.noticeDate ||
          new Date().toISOString().split("T")[0],
        employeeName: termination.employee || "",
        employeeId: termination.employeeId || "",
        dept: termination.dept || "",
        role: termination.role || "",
        noticeDate: termination.noticeDate || "",
        exitDate: termination.exitDate || "",
        terminationType: termination.terminationType || "Performance / Restructuring",
        reason:
          existing?.reason ||
          termination.reason ||
          "Under organizational restructuring and performance review directives.",
        severance:
          existing?.severance ||
          termination.severance ||
          "1 Month Gross Settlement",
        handoverInstruction:
          existing?.handoverInstruction ||
          "Please return all company property (laptop, access badge, keycards, files) to IT & Operations before your final day. All standard confidentiality agreements remain binding.",
        signatoryName: existing?.signatoryName || "Ayesha Khan",
        signatoryTitle: existing?.signatoryTitle || "Head of People Operations",
        companyName: "Evenmore Technologies Inc.",
        companyAddress: "100 Innovation Parkway, New York, NY 10001 • hr@evenmore.io",
      });
      setIsEditing(false);
      setSavedSuccess(false);
    }
  }, [termination]);

  if (!isOpen || !termination || !formData) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleSave = () => {
    if (onUpdateTermination) {
      const updated = {
        ...termination,
        employee: formData.employeeName,
        employeeId: formData.employeeId,
        dept: formData.dept,
        role: formData.role,
        noticeDate: formData.noticeDate,
        exitDate: formData.exitDate,
        terminationType: formData.terminationType,
        severance: formData.severance,
        reason: formData.reason,
        letterContent: { ...formData },
      };
      onUpdateTermination(updated);
    }
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:static print:bg-white print:backdrop-blur-none">
      <div className="bg-white rounded-2xl border border-slate-300 shadow-2xl max-w-3xl w-full my-auto overflow-hidden flex flex-col print:border-none print:shadow-none print:w-full print:max-w-none print:rounded-none">
        
        {/* Top Control Bar (Hidden during Print) */}
        <div className="bg-[#1F2E4A] text-white px-5 py-3 flex flex-wrap items-center justify-between gap-3 no-print shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-600/30 border border-red-500/40 text-red-300 flex items-center justify-center font-bold">
              <FileText size={16} />
            </div>
            <div>
              <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
                <span className="font-bold text-sm text-white">
                  Termination Notice — {formData.employeeName}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-mono bg-red-500/20 text-red-200 border border-red-400/30">
                  {termination.id}
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Minimal &amp; simple official separation letter
              </p>
            </div>
          </div>

          <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
            {/* Toggle Edit / Preview */}
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                isEditing
                  ? "bg-amber-500 text-slate-950 hover:bg-amber-400"
                  : "bg-white/10 hover:bg-white/20 text-white border border-white/20"
              }`}
            >
              {isEditing ? <Eye size={14} /> : <Edit3 size={14} />}
              <span>{isEditing ? "Preview Letter" : "Edit Letter"}</span>
            </button>

            {/* Save */}
            <button
              type="button"
              onClick={handleSave}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
              title="Save Changes"
            >
              <Save size={14} />
              <span>{savedSuccess ? "Saved!" : "Save"}</span>
            </button>

            {/* Print / Save PDF */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
              title="Print or Export as PDF"
            >
              <Printer size={14} />
              <span>Print / Save as PDF</span>
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition ml-1"
              title="Close Preview"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Saved Alert Banner */}
        {savedSuccess && (
          <div className="no-print bg-emerald-50 border-b border-emerald-200 text-emerald-800 px-5 py-2 text-xs font-medium flex items-center gap-2">
            <CheckCircle2 size={14} className="text-emerald-600" />
            <span>Termination details updated successfully.</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="max-h-[calc(88vh-55px)] overflow-y-auto">
          {isEditing ? (
            /* ── EDIT MODE FORM ── */
            <div className="p-4 sm:p-6 bg-slate-50 space-y-4 no-print text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <h4 className="font-bold text-slate-900 text-sm">
                  Edit Separation Details
                </h4>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-xs text-blue-600 hover:underline font-semibold"
                >
                  View Preview →
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Employee Name
                  </label>
                  <input
                    type="text"
                    value={formData.employeeName}
                    onChange={(e) =>
                      setFormData({ ...formData, employeeName: e.target.value })
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Employee ID
                  </label>
                  <input
                    type="text"
                    value={formData.employeeId}
                    onChange={(e) =>
                      setFormData({ ...formData, employeeId: e.target.value })
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Designation / Role
                  </label>
                  <input
                    type="text"
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({ ...formData, role: e.target.value })
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    value={formData.dept}
                    onChange={(e) =>
                      setFormData({ ...formData, dept: e.target.value })
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Notice Served Date
                  </label>
                  <input
                    type="date"
                    value={formData.noticeDate}
                    onChange={(e) =>
                      setFormData({ ...formData, noticeDate: e.target.value })
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Final Exit Date
                  </label>
                  <input
                    type="date"
                    value={formData.exitDate}
                    onChange={(e) =>
                      setFormData({ ...formData, exitDate: e.target.value })
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Severance / Final Settlement
                  </label>
                  <input
                    type="text"
                    value={formData.severance}
                    onChange={(e) =>
                      setFormData({ ...formData, severance: e.target.value })
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-blue-600 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Reason for Termination
                </label>
                <textarea
                  rows={2}
                  value={formData.reason}
                  onChange={(e) =>
                    setFormData({ ...formData, reason: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Company Asset Return &amp; Handover Instructions
                </label>
                <textarea
                  rows={2}
                  value={formData.handoverInstruction}
                  onChange={(e) =>
                    setFormData({ ...formData, handoverInstruction: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Signatory Name
                  </label>
                  <input
                    type="text"
                    value={formData.signatoryName}
                    onChange={(e) =>
                      setFormData({ ...formData, signatoryName: e.target.value })
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Signatory Title
                  </label>
                  <input
                    type="text"
                    value={formData.signatoryTitle}
                    onChange={(e) =>
                      setFormData({ ...formData, signatoryTitle: e.target.value })
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-500"
                >
                  Done Editing &amp; Preview
                </button>
              </div>
            </div>
          ) : null}

          {/* ── MINIMAL & SIMPLE PRINTABLE TERMINATION LETTER ── */}
          <div className="overflow-x-auto p-2 sm:p-6 lg:p-0 print:p-0 print:overflow-visible">
          <div className="p-8 sm:p-12 min-w-[720px] lg:min-w-0 print:min-w-0 text-slate-800 bg-white font-sans text-xs space-y-6 printable-document">
            
            {/* Header / Company Info */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#1F2E4A] text-white flex items-center justify-center font-bold text-base font-mono">
                    E
                  </div>
                  <div>
                    <h1 className="text-base font-bold text-[#1F2E4A] tracking-tight uppercase">
                      {formData.companyName}
                    </h1>
                    <p className="text-[10px] text-slate-500">
                      {formData.companyAddress}
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-right space-y-0.5 text-[11px] text-slate-500">
                <div className="font-mono font-medium text-slate-700">
                  Ref: {formData.refNumber}
                </div>
                <div>Date: {formData.issueDate}</div>
              </div>
            </div>

            {/* Recipient Block */}
            <div className="space-y-0.5 text-[12px]">
              <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                To:
              </div>
              <div className="font-bold text-slate-900 text-sm">
                {formData.employeeName}
              </div>
              <div className="text-slate-600">
                Employee ID: <span className="font-mono font-medium text-slate-800">{formData.employeeId}</span> • {formData.role} ({formData.dept})
              </div>
            </div>

            {/* Subject */}
            <div className="font-bold text-slate-950 text-[13px] border-b border-slate-100 pb-1.5">
              Subject: Notice of Separation of Employment
            </div>

            {/* Concise Opening */}
            <div className="space-y-2 text-[12.5px] leading-relaxed text-slate-700">
              <p>
                Dear <b>{formData.employeeName}</b>,
              </p>
              <p>
                This letter is to inform you that your employment with{" "}
                <b>{formData.companyName}</b> as <b>{formData.role}</b> in the{" "}
                <b>{formData.dept}</b> Department will conclude on{" "}
                <b className="text-red-700">{formData.exitDate}</b>.
              </p>
            </div>

            {/* Key Separation Terms Grid (Clean, Simple, Essential) */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Separation Details
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4 text-[12px]">
                <div>
                  <span className="text-[10.5px] text-slate-400 block font-medium">
                    Notice Date
                  </span>
                  <span className="font-medium text-slate-800">
                    {formData.noticeDate}
                  </span>
                </div>

                <div>
                  <span className="text-[10.5px] text-slate-400 block font-medium">
                    Final Working Day
                  </span>
                  <span className="font-bold text-red-700">
                    {formData.exitDate}
                  </span>
                </div>

                <div>
                  <span className="text-[10.5px] text-slate-400 block font-medium">
                    Severance Settlement
                  </span>
                  <span className="font-semibold text-slate-900">
                    {formData.severance}
                  </span>
                </div>
              </div>

              {/* Reason for Termination: Prominently and Clearly Highlighted */}
              <div className="pt-2 border-t border-slate-200/80">
                <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Reason for Termination:
                </span>
                <p className="text-[12px] text-slate-800 font-medium leading-relaxed bg-white border border-slate-200 p-2.5 rounded-lg">
                  {formData.reason}
                </p>
              </div>
            </div>

            {/* Handover & Property Return */}
            <div className="space-y-1 text-[12px] text-slate-600 leading-relaxed pt-1">
              <p className="font-semibold text-slate-800">Next Steps &amp; Asset Handover:</p>
              <p>{formData.handoverInstruction}</p>
              <p className="pt-1 text-slate-500">
                We thank you for your contributions during your time with us and wish you all the best in your future endeavors.
              </p>
            </div>

            {/* Signatures */}
            <div className="pt-8 border-t border-slate-200 grid grid-cols-2 gap-8">
              {/* Employer Sign-off */}
              <div className="space-y-2">
                <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                  For {formData.companyName}:
                </div>
                <div className="pt-6 border-b border-slate-300 w-44"></div>
                <div className="space-y-0.5 text-[11.5px]">
                  <div className="font-bold text-slate-900">{formData.signatoryName}</div>
                  <div className="text-slate-500 text-[11px]">{formData.signatoryTitle}</div>
                </div>
              </div>

              {/* Employee Acknowledgment */}
              <div className="space-y-2">
                <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                  Employee Acknowledgment:
                </div>
                <p className="text-[10.5px] text-slate-500">
                  I acknowledge receipt of this separation notice.
                </p>
                <div className="pt-4 border-b border-slate-300 w-44"></div>
                <div className="space-y-0.5 text-[11px] text-slate-500">
                  <div>Signature: ______________________</div>
                  <div>Date: __________________________</div>
                </div>
              </div>
            </div>

            {/* Minimal Footer */}
            <div className="pt-4 text-center text-[9.5px] text-slate-400">
              Evenmore Technologies Inc. • Confidential Separation Notice
            </div>

          </div>
          </div>
        </div>

      </div>
    </div>
  );
}
