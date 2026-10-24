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
    title: "How to Create a Lead",
    subtitle: "Follow these steps to add a new lead in CRM.",
    steps: [
      "Click the \"+ Create Lead\" button at the top-right of the Leads page.",
      "Enter the lead person name and company name.",
      "Add the phone number and email address for follow-up.",
      "Select the lead source (Walk-in, Advertisement, Partner) and assign a Lead Owner.",
      "Optionally attach products and team members to the lead.",
      "Click \"Create\" to save. The new lead appears at the top of the list with New status.",
      "Open the lead to add notes, create tasks, share quotations and track it till conversion.",
    ],
  },
  hi: {
    title: "लीड कैसे बनाएं",
    subtitle: "CRM में नई लीड जोड़ने के लिए ये स्टेप अपनाएं।",
    steps: [
      "Leads पेज पर ऊपर-दाईं ओर \"+ Create Lead\" बटन पर क्लिक करें।",
      "लीड व्यक्ति का नाम और कंपनी का नाम दर्ज करें।",
      "फॉलो-अप के लिए फोन नंबर और ईमेल पता जोड़ें।",
      "लीड सोर्स चुनें (Walk-in, Advertisement, Partner) और Lead Owner assign करें।",
      "चाहें तो लीड के साथ products और team members जोड़ें।",
      "\"Create\" पर क्लिक करके सेव करें। नई लीड New स्टेटस के साथ लिस्ट में सबसे ऊपर दिखेगी।",
      "लीड खोलकर notes जोड़ें, tasks बनाएं, quotation शेयर करें और conversion तक ट्रैक करें।",
    ],
  },
  gu: {
    title: "લીડ કેવી રીતે બનાવવી",
    subtitle: "CRM માં નવી લીડ ઉમેરવા માટે આ સ્ટેપ અનુસરો.",
    steps: [
      "Leads પેજ પર ઉપર-જમણી બાજુ \"+ Create Lead\" બટન પર ક્લિક કરો.",
      "લીડ વ્યક્તિનું નામ અને કંપનીનું નામ દાખલ કરો.",
      "ફોલો-અપ માટે ફોન નંબર અને ઈમેલ સરનામું ઉમેરો.",
      "લીડ સોર્સ પસંદ કરો (Walk-in, Advertisement, Partner) અને Lead Owner સોંપો.",
      "જરૂર હોય તો લીડ સાથે products અને team members ઉમેરો.",
      "\"Create\" પર ક્લિક કરીને સેવ કરો. નવી લીડ New સ્ટેટસ સાથે યાદીમાં સૌથી ઉપર દેખાશે.",
      "લીડ ખોલીને notes ઉમેરો, tasks બનાવો, quotation શેર કરો અને conversion સુધી ટ્રેક કરો.",
    ],
  },
};

const FORM_GUIDES = {
  en: {
    title: "How to Create a Lead Form",
    subtitle: "Follow these steps to design a new lead capture form.",
    steps: [
      "On the Manage Lead Create Forms page, click the + button at the top-right.",
      "Enter a form name (e.g. Website Inquiry Form) and an optional description.",
      "Click Create Form. The form builder opens for the new form.",
      "Add sections and fields (Single Line, Email, Phone, Dropdown, Date and more) to design the layout.",
      "Click Save Changes. The form appears in the list with ACTIVE status and is used for every new lead.",
    ],
  },
  hi: {
    title: "लीड फॉर्म कैसे बनाएं",
    subtitle: "नया लीड कैप्चर फॉर्म डिज़ाइन करने के लिए ये स्टेप अपनाएं।",
    steps: [
      "Manage Lead Create Forms पेज पर ऊपर-दाईं ओर + बटन पर क्लिक करें।",
      "फॉर्म का नाम (जैसे Website Inquiry Form) और चाहें तो description दर्ज करें।",
      "Create Form पर क्लिक करें। नए फॉर्म के लिए form builder खुल जाएगा।",
      "Layout डिज़ाइन करने के लिए sections और fields (Single Line, Email, Phone, Dropdown, Date आदि) जोड़ें।",
      "Save Changes पर क्लिक करें। फॉर्म ACTIVE स्टेटस के साथ लिस्ट में दिखेगा और हर नई लीड के लिए इस्तेमाल होगा।",
    ],
  },
  gu: {
    title: "લીડ ફોર્મ કેવી રીતે બનાવવું",
    subtitle: "નવું લીડ કેપ્ચર ફોર્મ ડિઝાઇન કરવા માટે આ સ્ટેપ અનુસરો.",
    steps: [
      "Manage Lead Create Forms પેજ પર ઉપર-જમણી બાજુ + બટન પર ક્લિક કરો.",
      "ફોર્મનું નામ (દા.ત. Website Inquiry Form) અને જરૂર હોય તો description દાખલ કરો.",
      "Create Form પર ક્લિક કરો. નવા ફોર્મ માટે form builder ખૂલશે.",
      "Layout ડિઝાઇન કરવા sections અને fields (Single Line, Email, Phone, Dropdown, Date વગેરે) ઉમેરો.",
      "Save Changes પર ક્લિક કરો. ફોર્મ ACTIVE સ્ટેટસ સાથે યાદીમાં દેખાશે અને દરેક નવી લીડ માટે વપરાશે.",
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
  lead: {
    0: "step-1.png",
    1: "step-2.png",
    3: "step-3.png",
    5: "step-4.png",
    6: "step-5.png",
  },
  form: {
    0: "form-1.png",
    1: "form-2.png",
    2: "form-3.png",
    3: "form-4.png",
  },
};

function downloadGuidePdf(lang, variant) {
  const guides = variant === "form" ? FORM_GUIDES : GUIDES;
  const images = STEP_IMAGES[variant] || STEP_IMAGES.lead;
  const guide = guides[lang] || guides.en;
  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) return;
  const items = guide.steps
    .map((step, i) => {
      const img = images[i] ? `<br /><img src="${guideImageUrl(images[i])}" style="width:100%;border:1px solid #e2e8f0;border-radius:10px;margin-top:8px;" />` : "";
      return `<li><strong>Step ${i + 1}:</strong> ${escapeHtml(step)}${img}</li>`;
    })
    .join("");
  const today = new Date().toLocaleDateString("en-GB");
  printWindow.document.write(
    `<!doctype html><html><head><title>${escapeHtml(guide.title)}</title><style>body{font-family:Arial,Nirmala UI,Noto Sans Gujarati,sans-serif;color:#172033;padding:40px;max-width:760px;margin:0 auto}h1{font-size:24px;margin:0 0 6px}p.sub{color:#64748b;margin:0 0 20px;font-size:14px}ol{padding-left:20px}li{font-size:14px;line-height:1.7;margin-bottom:10px}.foot{margin-top:28px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8}</style></head><body><h1>${escapeHtml(guide.title)}</h1><p class="sub">${escapeHtml(guide.subtitle)} | Evenmore CRM</p><ol>${items}</ol><p class="foot">Generated on ${today} | Evenmore CRM - Lead Guide</p></body></html>`
  );
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 350);
}

export default function LeadGuideModal({ isOpen, onClose, variant = "lead" }) {
  const [lang, setLang] = useState("en");
  if (!isOpen) return null;
  const guides = variant === "form" ? FORM_GUIDES : GUIDES;
  const images = STEP_IMAGES[variant] || STEP_IMAGES.lead;
  const guide = guides[lang] || guides.en;
  const modalHeading = variant === "form" ? "How to Create a Lead Form?" : "How to Create a Lead?";
  const modalAriaLabel = variant === "form" ? "How to create a lead form guide" : "How to create a lead guide";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 bg-slate-950/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={modalAriaLabel}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <BookOpen size={18} />
            </span>
            <div>
              <h2 className="text-[15px] font-bold text-slate-800">{modalHeading}</h2>
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
                    {images[i] && (
                      <img
                        src={guideImageUrl(images[i])}
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
            onClick={() => downloadGuidePdf(lang, variant)}
            className="h-10 px-5 rounded-lg bg-[#1f6bff] hover:bg-blue-700 text-white text-sm font-bold flex items-center gap-1.5"
          >
            <Download size={15} /> Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}
