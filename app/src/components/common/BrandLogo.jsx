import React from 'react';
import { Infinity as InfinityIcon } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';

/**
 * The company logo from Settings → Branding, or the default infinity mark
 * when none is uploaded. `fallback` lets a screen keep its own decorated
 * default (e.g. the login card's infinity + dots).
 */
export default function BrandLogo({ size = 28, strokeWidth = 2.6, className = '', fallback = null }) {
  const logo = useAppStore((s) => s.branding?.logo);
  if (logo) {
    return (
      <img
        src={logo}
        alt="Company logo"
        draggable={false}
        className={`object-contain ${className}`}
        style={{ height: size, width: 'auto', maxWidth: size * 3 }}
      />
    );
  }
  return fallback || <InfinityIcon size={size} strokeWidth={strokeWidth} className={className} />;
}

/** Brand name from Settings → Branding, or `fallback` when none is set. */
export function useBrandName(fallback) {
  const name = useAppStore((s) => s.branding?.name);
  return (name && name.trim()) || fallback;
}
