import React from 'react';
import { FileText, Truck, DollarSign, ArrowUpRight, CheckCircle, Clock } from 'lucide-react';
export const RelatedDocumentsCard = ({ documents, title = 'Connected Transaction Documents', }) => {
    const getIcon = (type) => {
        switch (type) {
            case 'Delivery Challan':
                return <Truck className="w-4 h-4 text-indigo-500"/>;
            case 'Payment':
            case 'Debit Note':
            case 'Credit Note':
                return <DollarSign className="w-4 h-4 text-emerald-500"/>;
            default:
                return <FileText className="w-4 h-4 text-blue-500"/>;
        }
    };
    return (<div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
          <FileText className="w-4 h-4 text-slate-400"/>
          {title}
        </h4>
        <span className="text-[11px] font-medium text-slate-400">
          {documents.length} linked record{documents.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="divide-y divide-slate-100">
        {documents.length === 0 ? (<p className="text-xs text-slate-400 py-3 text-center">No linked documents found.</p>) : (documents.map((doc, idx) => (<div key={idx} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3 hover:bg-slate-50/60 rounded px-1.5 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/80">
                  {getIcon(doc.type)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-800 font-mono">
                      {doc.number}
                    </span>
                    <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      {doc.type}
                    </span>
                  </div>
                  {doc.date && <p className="text-[10px] text-slate-400">{doc.date}</p>}
                </div>
              </div>

              <div className="text-right flex items-center gap-3">
                {doc.amount !== undefined && (<div>
                    <span className="text-xs font-mono font-bold text-slate-900">
                      ${doc.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                    {doc.status && (<p className="text-[10px] font-medium text-slate-500 flex items-center justify-end gap-1">
                        {String(doc.status ?? '').toLowerCase() === 'paid' || String(doc.status ?? '').toLowerCase() === 'delivered' ? (<CheckCircle className="w-3 h-3 text-emerald-500 inline"/>) : (<Clock className="w-3 h-3 text-amber-500 inline"/>)}
                        {doc.status}
                      </p>)}
                  </div>)}
                {doc.linkTo && (<button type="button" className="p-1 text-slate-400 hover:text-blue-600 transition-colors" title="View Document">
                    <ArrowUpRight className="w-4 h-4"/>
                  </button>)}
              </div>
            </div>)))}
      </div>
    </div>);
};
