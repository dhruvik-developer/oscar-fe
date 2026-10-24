import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, Download, ExternalLink, X } from 'lucide-react';
import guides from './administrationGuides.json';
import { guideImageUrl } from '../../utils/guideImageUrl';

export default function AdministrationGuideButton({ entity }) {
  const dialogRef = useRef(null);
  const [language, setLanguage] = useState('en');
  const title = `How to create a ${entity}?`;
  const guide = guides[entity][language];
  const pdfUrl = guideImageUrl(`admin-${entity}-${language}.pdf`);
  const labels = {
    en: { subtitle: 'Step-by-step guide with screenshot examples', open: 'Open PDF', download: 'Download PDF', close: 'Close', example: 'Screenshot example with demo data' },
    gu: { subtitle: 'સ્ક્રીનશૉટ ઉદાહરણો સાથે પગલું-દર-પગલું માર્ગદર્શિકા', open: 'PDF ખોલો', download: 'PDF ડાઉનલોડ કરો', close: 'બંધ કરો', example: 'નમૂનાના ડેટા સાથે સ્ક્રીનશૉટ ઉદાહરણ' },
    hi: { subtitle: 'स्क्रीनशॉट उदाहरणों के साथ चरण-दर-चरण गाइड', open: 'PDF खोलें', download: 'PDF डाउनलोड करें', close: 'बंद करें', example: 'नमूना डेटा के साथ स्क्रीनशॉट उदाहरण' },
  }[language];

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        aria-haspopup="dialog"
        className="inline-flex items-center gap-2 rounded-[12px] border-2 border-[#1d6bff] bg-[#f2f7ff] px-3 py-2.5 text-[13px] font-semibold text-[#1d6bff] hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        <span aria-hidden="true" className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1d6bff] text-[12px] font-bold text-white">?</span>
        <span>{title}</span>
      </button>
      {createPortal(
        <dialog
          ref={dialogRef}
          aria-label={guide.title}
          lang={language}
          className="fixed inset-0 m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl border-0 bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-slate-950/50"
          onClick={(event) => {
            if (event.target === event.currentTarget) dialogRef.current.close();
          }}
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <BookOpen size={20} className="shrink-0 text-blue-600" />
              <div>
                <h2 className="text-[15px] font-bold">{guide.title}</h2>
                <p className="mt-1 text-xs text-slate-500">{labels.subtitle}</p>
              </div>
            </div>
            <button type="button" onClick={() => dialogRef.current.close()} aria-label="Close guide" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
              <X size={18} />
            </button>
          </div>
          <div className="sticky top-0 z-10 flex gap-2 border-b border-slate-100 bg-white px-5 py-3" role="group" aria-label="Guide language">
            {[['en', 'English'], ['gu', 'ગુજરાતી'], ['hi', 'हिन्दी']].map(([code, label]) => (
              <button key={code} type="button" lang={code} aria-pressed={language === code} onClick={() => setLanguage(code)} className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-semibold ${language === code ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 text-slate-600 hover:bg-blue-50'}`}>{label}</button>
            ))}
          </div>
          <ol className="space-y-5 px-5 py-5">
            {guide.steps.map((step, index) => (
              <li key={step} className="flex gap-3 text-[13px] leading-relaxed text-slate-700">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1d6bff] text-xs font-bold text-white">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p>{step}</p>
                  <a href={guideImageUrl(`admin-${entity}-${index + 1}.png`)} target="_blank" rel="noopener noreferrer" aria-label={`${labels.example} ${index + 1}`}>
                    <img src={guideImageUrl(`admin-${entity}-${index + 1}.png`)} alt={`${labels.example} ${index + 1}`} className="mt-3 w-full rounded-lg border border-slate-200" />
                  </a>
                </div>
              </li>
            ))}
          </ol>
          <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-white px-5 py-4">
            <button type="button" onClick={() => dialogRef.current.close()} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600">{labels.close}</button>
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-blue-600 px-4 py-2.5 text-sm font-semibold text-blue-600"><ExternalLink size={16} />{labels.open}</a>
            <a href={pdfUrl} download={`Evenmore-${entity}-guide-${language}.pdf`} className="inline-flex items-center gap-2 rounded-lg bg-[#1d6bff] px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"><Download size={16} />{labels.download}</a>
          </div>
        </dialog>,
        document.body,
      )}
    </>
  );
}
