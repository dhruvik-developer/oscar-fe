import { useState } from "react";
import { X, Download, BookOpen } from "lucide-react";
import { guideImageUrl } from "../../../utils/guideImageUrl";

const LANGS = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "gu", label: "ગુજરાતી" },
];

const GUIDES = {
  en: {
    title: "How to Create Lead Stage Tasks",
    subtitle: "Use this guide to create tasks for all lead stages with clear descriptions.",
    steps: [
      "Open the Lead Stage Tasks page, choose the pipeline, and click any stage such as New Lead, Details Collected, Quotation Shared, Demo Pending, Demo Done, Negotiation, Won, or Lost.",
      "Click \"+ Add Task\" inside the selected stage and enter a task name with a short description that clearly tells the assignee what action to take.",
      "For New Lead, create a task like \"Follow-up\" with a description such as \"Initial follow-up to understand requirement and qualify the lead.\"",
      "For Details Collected, create a task like \"Send email\" with a description such as \"Share brochure, confirm collected details, and plan the next step.\"",
      "For Quotation Shared, Demo Pending, and Demo Done, create tasks like \"Send quotation\", \"Schedule demo\", or \"Client meeting\" with descriptions for proposal sharing, demo planning, and post-demo follow-up.",
      "For Negotiation, Won, and Lost, create tasks like \"Negotiate pricing\", \"Handover to onboarding\", or \"Capture lost reason\" so the team can close, convert, or report the lead properly.",
      "Set Role, Order, Required, Auto Create, Max Repeats, and Due In Days, then click Save or Create.",
      "Repeat this for all stages. The saved tasks appear under each stage and auto-create when a lead moves into that stage.",
    ],
  },
  hi: {
    title: "लीड स्टेज टास्क कैसे बनाएं",
    subtitle: "हर लीड स्टेज में टास्क map करने के लिए ये स्टेप अपनाएं।",
    steps: [
      "Lead Stage Tasks पेज पर Pipeline Sales चुनें और ऊपर-दाईं ओर \"+ Add Stage Task\" बटन पर क्लिक करें।",
      "Task Roles सेक्शन expand करके roles और उनके tasks देखें।",
      "New Lead, Details Collected, Quotation Shared, Demo Pending जैसे stage pill पर क्लिक करके स्टेज खोलें।",
      "स्टेज row में \"+ Add Task\" पर क्लिक करें, Task Name, Role, Order, Required, Auto Create, Max Repeats और Due In Days भरें।",
      "Create या Save पर क्लिक करें। टास्क उस स्टेज के नीचे दिखेगा और लीड के स्टेज में आते ही auto-create होगा।",
    ],
  },
  gu: {
    title: "લીડ સ્ટેજ ટાસ્ક કેવી રીતે બનાવવું",
    subtitle: "દરેક લીડ સ્ટેજમાં ટાસ્ક map કરવા માટે આ સ્ટેપ અનુસરો.",
    steps: [
      "Lead Stage Tasks પેજ પર Pipeline Sales પસંદ કરો અને ઉપર-જમણી બાજુ \"+ Add Stage Task\" બટન પર ક્લિક કરો.",
      "Task Roles સેક્શન expand કરીને roles અને તેમના tasks જુઓ.",
      "New Lead, Details Collected, Quotation Shared, Demo Pending જેવા stage pill પર ક્લિક કરીને સ્ટેજ ખોલો.",
      "સ્ટેજ row માં \"+ Add Task\" પર ક્લિક કરો, Task Name, Role, Order, Required, Auto Create, Max Repeats અને Due In Days ભરો.",
      "Create અથવા Save પર ક્લિક કરો. ટાસ્ક તે સ્ટેજ નીચે દેખાશે અને લીડ સ્ટેજમાં આવે ત્યારે auto-create થશે.",
    ],
  },
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const STEP_IMAGES = {
  0: "stage-1.png",
  1: "stage-2.png",
  2: "stage-3.png",
  3: "stage-4.png",
  4: "stage-5.png",
};

function downloadGuidePdf(lang) {
  const guide = GUIDES[lang] || GUIDES.en;
  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) return;
  const items = guide.steps
    .map((step, i) => {
      const img = STEP_IMAGES[i] ? `<br /><img src="${guideImageUrl(STEP_IMAGES[i])}" style="width:100%;border:1px solid #e2e8f0;border-radius:10px;margin-top:8px;" />` : "";
      return `<li><strong>Step ${i + 1}:</strong> ${escapeHtml(step)}${img}</li>`;
    })
    .join("");
  const today = new Date().toLocaleDateString("en-GB");
  printWindow.document.write(
    `<!doctype html><html><head><title>${escapeHtml(guide.title)}</title><style>body{font-family:Arial,Nirmala UI,Noto Sans Gujarati,sans-serif;color:#172033;padding:40px;max-width:760px;margin:0 auto}h1{font-size:24px;margin:0 0 6px}p.sub{color:#64748b;margin:0 0 20px;font-size:14px}ol{padding-left:20px}li{font-size:14px;line-height:1.7;margin-bottom:10px}.foot{margin-top:28px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8}</style></head><body><h1>${escapeHtml(guide.title)}</h1><p class="sub">${escapeHtml(guide.subtitle)} | Evenmore CRM</p><ol>${items}</ol><p class="foot">Generated on ${today} | Evenmore CRM - Stage Task Guide</p></body></html>`
  );
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 350);
}

export default function StageTasksGuideModal({ isOpen, onClose }) {
  const [lang, setLang] = useState("en");
  if (!isOpen) return null;
  const guide = GUIDES[lang] || GUIDES.en;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 bg-slate-950/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="How to create lead stage tasks guide"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <BookOpen size={18} />
            </span>
            <div>
              <h2 className="text-[15px] font-bold text-slate-800">How to create lead stage tasks?</h2>
              <p className="text-[11px] text-slate-500">Stage-wise guide with descriptions</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto">
          <div className="flex gap-2">
            {LANGS.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => setLang(l.code)}
                className={
                  lang === l.code
                    ? "flex-1 h-10 rounded-lg bg-[#1f6bff] text-white text-sm font-bold"
                    : "flex-1 h-10 rounded-lg border border-slate-300 text-slate-600 text-sm font-semibold hover:border-blue-400 hover:text-blue-600"
                }
              >
                {l.label}
              </button>
            ))}
          </div>

          <div className="mt-4 border border-slate-200 rounded-xl p-4 bg-slate-50/60">
            <p className="text-sm font-bold text-slate-800">{guide.title}</p>
            <p className="text-xs text-slate-500 mt-0.5">{guide.subtitle}</p>
            <ol className="mt-3 space-y-3.5">
              {guide.steps.map((step, i) => (
                <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-slate-700">
                  <span className="w-5 h-5 rounded-full bg-[#1f6bff] text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    {step}
                    {STEP_IMAGES[i] && (
                      <img
                        src={guideImageUrl(STEP_IMAGES[i])}
                        alt={`Demo step ${i + 1}`}
                        className="mt-2 w-full rounded-lg border border-slate-200 shadow-sm"
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-5 rounded-lg border border-slate-300 text-slate-600 text-sm font-semibold hover:bg-slate-50"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => downloadGuidePdf(lang)}
            className="h-10 px-5 rounded-lg bg-[#1f6bff] hover:bg-blue-700 text-white text-sm font-bold flex items-center gap-1.5"
          >
            <Download size={15} /> Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}
