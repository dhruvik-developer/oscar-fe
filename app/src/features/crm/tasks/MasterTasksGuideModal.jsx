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
    title: "How to Create a Master Task",
    subtitle: "Follow these steps to add a reusable task for lead stages.",
    steps: [
      "On the Manage Master Lead Tasks page, click the \"+ Create Master Task\" button at the top-right.",
      "Enter the task name (e.g. Follow-up) and select Assigned Role, Department, Priority, Due In Days, Status and Icon.",
      "Click \"Create Task\" to save. The new task appears in the list with Active status.",
      "Edit, duplicate, or change status anytime.",
    ],
  },
  hi: {
    title: "मास्टर टास्क कैसे बनाएं",
    subtitle: "लीड स्टेज के लिए नया reusable टास्क जोड़ने के लिए ये स्टेप अपनाएं।",
    steps: [
      "Manage Master Lead Tasks पेज पर ऊपर-दाईं ओर \"+ Create Master Task\" बटन पर क्लिक करें।",
      "टास्क का नाम दर्ज करें (जैसे Follow-up) और Assigned Role, Department, Priority, Due In Days, Status और Icon चुनें।",
      "\"Create Task\" पर क्लिक करके सेव करें। नया टास्क Active स्टेटस के साथ लिस्ट में दिखेगा।",
      "कभी भी edit, duplicate या status बदलें।",
    ],
  },
  gu: {
    title: "માસ્ટર ટાસ્ક કેવી રીતે બનાવવું",
    subtitle: "લીડ સ્ટેજ માટે નવું reusable ટાસ્ક ઉમેરવા માટે આ સ્ટેપ અનુસરો.",
    steps: [
      "Manage Master Lead Tasks પેજ પર ઉપર-જમણી બાજુ \"+ Create Master Task\" બટન પર ક્લિક કરો.",
      "ટાસ્કનું નામ દાખલ કરો (દા.ત. Follow-up) અને Assigned Role, Department, Priority, Due In Days, Status અને Icon પસંદ કરો.",
      "\"Create Task\" પર ક્લિક કરીને સેવ કરો. નવું ટાસ્ક Active સ્ટેટસ સાથે યાદીમાં દેખાશે.",
      "ક્યારેય પણ edit, duplicate અથવા status બદલો.",
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
  0: "tasks-1.png",
  1: "tasks-2.png",
  2: "tasks-3.png",
  3: "tasks-4.png",
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
    `<!doctype html><html><head><title>${escapeHtml(guide.title)}</title><style>body{font-family:Arial,Nirmala UI,Noto Sans Gujarati,sans-serif;color:#172033;padding:40px;max-width:760px;margin:0 auto}h1{font-size:24px;margin:0 0 6px}p.sub{color:#64748b;margin:0 0 20px;font-size:14px}ol{padding-left:20px}li{font-size:14px;line-height:1.7;margin-bottom:10px}.foot{margin-top:28px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8}</style></head><body><h1>${escapeHtml(guide.title)}</h1><p class="sub">${escapeHtml(guide.subtitle)} | Evenmore CRM</p><ol>${items}</ol><p class="foot">Generated on ${today} | Evenmore CRM - Master Task Guide</p></body></html>`
  );
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 350);
}

export default function MasterTasksGuideModal({ isOpen, onClose }) {
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
        aria-label="How to create lead tasks master guide"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <BookOpen size={18} />
            </span>
            <div>
              <h2 className="text-[15px] font-bold text-slate-800">How to create lead tasks master?</h2>
              <p className="text-[11px] text-slate-500">Step guide PDF in your language</p>
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
