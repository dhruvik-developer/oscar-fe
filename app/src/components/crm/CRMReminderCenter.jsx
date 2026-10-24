import { Link } from 'react-router-dom';
import { BellRing, Clock3, ArrowRight, CheckCircle2, TriangleAlert } from 'lucide-react';
import { useCrmNotificationDigest } from '../../hooks/useCrmNotificationDigest';

function toneClasses(tone) {
  if (tone === 'overdue') return 'border-[#ffc7d0] bg-[#fff5f7] text-[#e11d48]';
  if (tone === 'today') return 'border-[#ffd8b2] bg-[#fff8f1] text-[#ea580c]';
  return 'border-[#d8e5fb] bg-[#f7fbff] text-[#1d4ed8]';
}

export function CRMReminderCenter() {
  const digest = useCrmNotificationDigest();
  const { spotlight, counts, notifications } = digest;
  const headline = counts.urgent > 0
    ? `${counts.urgent} urgent CRM reminder${counts.urgent > 1 ? 's' : ''}`
    : counts.total > 0
      ? `${counts.total} CRM update${counts.total > 1 ? 's' : ''} ready`
      : 'CRM inbox is clear';

  return (
    <div className="px-4 sm:px-6 pt-4">
      <section className="overflow-hidden rounded-[30px] border border-[#d9e5f9] bg-[linear-gradient(180deg,#f8fbff_0%,#f4f8ff_100%)] shadow-[0_14px_32px_rgba(20,56,112,0.08)]">
        <div className="grid gap-4 px-4 py-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
          <div className="rounded-[28px] bg-[#264a80] px-5 py-5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                <BellRing size={19} />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#a8c2ef]">CRM Updates</p>
                <h2 className="mt-1 text-[16px] font-bold leading-5">{headline}</h2>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2.5">
              <div className="rounded-[18px] bg-white/8 px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#b8cff2]">Overdue</p>
                <p className="mt-1 text-[17px] font-bold">{counts.overdue}</p>
              </div>
              <div className="rounded-[18px] bg-white/8 px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#b8cff2]">Today</p>
                <p className="mt-1 text-[17px] font-bold">{counts.today}</p>
              </div>
              <div className="rounded-[18px] bg-white/8 px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#b8cff2]">Unread</p>
                <p className="mt-1 text-[17px] font-bold">{counts.unread}</p>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2.5">
              <Link to="/crm/tasks" className="inline-flex h-10 items-center justify-center gap-2 rounded-[18px] bg-white px-4 text-[13px] font-semibold text-[#163d73] transition hover:bg-[#eef5ff]">
                Open Tasks
                <ArrowRight size={14} />
              </Link>
              <Link to="/crm/tasks/allocation" className="inline-flex h-10 items-center justify-center gap-2 rounded-[18px] border border-white/15 bg-white/8 px-4 text-[13px] font-semibold text-white transition hover:bg-white/14">
                Task Allocation
              </Link>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex items-start justify-between gap-3 px-1 pt-1">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#5873a4]">Live Reminders</p>
                <p className="mt-1 text-[13px] font-semibold text-slate-900 sm:text-[15px]">Every CRM page now surfaces due work and follow-up alerts.</p>
              </div>
              <Link to="/crm/leads" className="inline-flex shrink-0 rounded-full border border-[#d8e3f6] bg-white px-4 py-2 text-[12px] font-semibold text-[#35527e] shadow-sm transition hover:border-[#b9cceb] hover:bg-[#f8fbff]">
                View Leads
              </Link>
            </div>

            <div className="grid gap-3 xl:grid-cols-3">
              {spotlight.length > 0 ? spotlight.map((item) => (
                <Link
                  key={item.id}
                  to={item.path}
                  className={`group rounded-[24px] border px-4 py-4 shadow-[0_6px_18px_rgba(226,232,240,0.45)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(244,63,94,0.12)] ${toneClasses(item.tone)}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.22em] opacity-75">{item.subtitle}</p>
                      <h3 className="mt-2 text-[15px] font-bold leading-5">{item.title}</h3>
                    </div>
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/88 text-current shadow-sm">
                      {item.tone === 'overdue' ? <TriangleAlert size={17} /> : <Clock3 size={17} />}
                    </span>
                  </div>
                  <p className="mt-3 text-[12px] leading-5 opacity-95">{item.desc}</p>
                  <div className="mt-5 flex items-center justify-between">
                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold shadow-sm">{item.time}</span>
                    <span className="inline-flex items-center gap-1 text-[12px] font-semibold">
                      Open
                      <ArrowRight size={13} className="transition group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              )) : (
                <div className="xl:col-span-3 rounded-[24px] border border-emerald-200 bg-white px-5 py-6 text-emerald-800 shadow-sm">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                      <CheckCircle2 size={20} />
                    </span>
                    <div>
                      <h3 className="text-[15px] font-bold">No urgent reminders right now</h3>
                      <p className="mt-1 text-[13px] leading-6 text-emerald-700/90">New CRM reminders will appear here automatically when tasks become due or follow-ups need attention.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {notifications.length > 0 && (
              <div className="grid gap-2 md:grid-cols-2">
                {notifications.slice(0, 2).map((item) => (
                  <Link key={item.id} to={item.path} className="flex items-center justify-between gap-3 rounded-[22px] border border-[#dbe4f0] bg-white px-4 py-3 text-slate-700 shadow-[0_5px_14px_rgba(148,163,184,0.14)] transition hover:border-[#c8d8ee] hover:bg-[#fbfdff]">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-0.5 truncate text-[12px] text-[#6a7f9f]">{item.desc}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-[#eff3f8] px-3 py-1 text-[11px] font-bold text-[#5d6d84]">{item.time}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
