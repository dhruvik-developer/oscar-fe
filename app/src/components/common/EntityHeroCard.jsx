import React from 'react';
import { Phone, Mail, MapPin, Edit3, ArrowRightLeft, MoreHorizontal, User } from 'lucide-react';
import { StatusBadge } from '../ui/StatusBadge';

export const EntityHeroCard = ({
  avatar,
  avatarText,
  name,
  subtitle,
  status = 'Qualified',
  phone,
  email,
  location,
  metadata = [], // [{ label: 'Lead Number', value: 'L-001' }, { label: 'Source', value: 'Website' }, ...]
  actions,
  onEdit,
  onConvert,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        {/* Left Side: Avatar + Main Info */}
        <div className="flex items-start sm:items-center gap-4 min-w-0">
          {avatar ? (
            <img
              src={avatar}
              alt={name}
              className="w-16 h-16 rounded-full object-cover border-2 border-slate-100 shadow-sm shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-extrabold text-xl flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
              {avatarText || name?.slice(0, 2)?.toUpperCase() || 'EP'}
            </div>
          )}

          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-black text-slate-800 tracking-tight truncate">{name}</h1>
              <StatusBadge status={status} />
            </div>

            {subtitle && <p className="text-xs font-semibold text-slate-500">{subtitle}</p>}

            {/* Quick Contact Strip */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-0.5">
              {phone && (
                <span className="flex items-center gap-1.5 hover:text-blue-600 transition-colors">
                  <Phone size={13} className="text-blue-500" />
                  <span className="font-medium">{phone}</span>
                </span>
              )}
              {email && (
                <span className="flex items-center gap-1.5 hover:text-blue-600 transition-colors">
                  <Mail size={13} className="text-blue-500" />
                  <span className="font-medium">{email}</span>
                </span>
              )}
              {location && (
                <span className="flex items-center gap-1.5">
                  <MapPin size={13} className="text-blue-500" />
                  <span className="font-medium">{location}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Key Metadata Fields & Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-5 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
          {/* Metadata Grid */}
          {metadata.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              {metadata.map((item, idx) => (
                <div key={idx} className="space-y-0.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.label}</p>
                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    {item.avatar && (
                      <div className="w-4 h-4 rounded-full bg-slate-200 text-slate-600 text-[9px] flex items-center justify-center font-bold">
                        {item.avatar}
                      </div>
                    )}
                    <span>{item.value}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Action Toolbar */}
          <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              >
                <Edit3 size={13} className="text-slate-500" />
                <span>Edit</span>
              </button>
            )}

            {onConvert && (
              <button
                type="button"
                onClick={onConvert}
                className="px-3 py-1.5 bg-white border border-blue-200 hover:bg-blue-50 text-blue-600 font-semibold text-xs rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              >
                <ArrowRightLeft size={13} className="text-blue-500" />
                <span>Convert</span>
              </button>
            )}

            {actions}
          </div>
        </div>
      </div>
    </div>
  );
};
