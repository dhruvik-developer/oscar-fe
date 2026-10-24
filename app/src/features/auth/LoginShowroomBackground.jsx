/**
 * LoginShowroomBackground — static, no animation, no 3D.
 * Uses your `public/login-bg.png` full-bleed (also accepts
 * `public/guide/login-bg.png` / `public/login-bg.jpg`).
 * Tailwind art underneath is fallback only.
 */
import { useState } from 'react';
import RibbonAnimation from './RibbonAnimation';

const PHOTO_SOURCES = ['/login-bg.png', '/guide/login-bg.png', '/login-bg.jpg'];

export default function LoginShowroomBackground() {
  const [srcIndex, setSrcIndex] = useState(0);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#f3efe8]">
      {/* ---- static Tailwind fallback scene ---- */}
      <div className="absolute inset-0 bg-gradient-to-br from-white via-[#f6f1e8] to-[#dfe6f2]" />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(at 12% 8%, rgba(255,255,255,0.95) 0px, transparent 45%),
            radial-gradient(at 78% 12%, rgba(191,219,254,0.55) 0px, transparent 50%),
            radial-gradient(at 55% 90%, rgba(30,64,175,0.10) 0px, transparent 55%)`,
        }}
      />

      {/* back wall + sun streaks (frozen) */}
      <div className="absolute inset-0">
        <div className="absolute top-0 bottom-[22%] left-[8%] right-[30%] bg-gradient-to-b from-white/90 to-[#ece5d8]/60" />
        <div className="absolute -top-[10%] left-[30%] h-[130%] w-[16%] rotate-[18deg] bg-gradient-to-b from-white/80 via-white/20 to-transparent blur-xl" />
        <div className="absolute -top-[10%] left-[52%] h-[130%] w-[9%] rotate-[18deg] bg-gradient-to-b from-white/70 via-white/10 to-transparent blur-2xl" />
        <div className="absolute top-[6%] right-[28%] h-[70%] w-[22%] rotate-[18deg] bg-white/25 blur-2xl" />
      </div>

      {/* vertical blinds */}
      <div className="absolute top-0 bottom-[24%] left-0 w-[9%]">
        <div
          className="h-full w-full opacity-90"
          style={{ background: 'repeating-linear-gradient(90deg, #fdfdfc 0px, #fdfdfc 7px, #c9cdd6 9px, #e9e7e1 12px)' }}
        />
      </div>

      {/* fluted arch */}
      <div className="absolute bottom-[24%] left-[7%] h-[52%] w-[26%]">
        <div
          className="h-full w-full rounded-t-full border border-white/70 shadow-[0_20px_60px_rgba(120,110,95,0.25)]"
          style={{ background: 'repeating-linear-gradient(90deg, #fbf8f2 0px, #fbf8f2 8px, #d9d2c4 10px, #efe9dc 13px)' }}
        />
      </div>

      {/* plant (frozen) */}
      <div className="absolute bottom-[30%] left-[1%] h-[34%] w-[10%]">
        {Array.from({ length: 9 }).map((_, i) => (
          <span
            key={i}
            className="absolute left-1/2 h-[46%] w-[26%] origin-bottom rounded-full bg-gradient-to-t from-[#2f5b2a] to-[#7ba05b]"
            style={{ transform: `rotate(${-52 + i * 13}deg) translateY(-38%)`, bottom: '8%', opacity: 0.9 - i * 0.03 }}
          />
        ))}
      </div>

      {/* marble podiums */}
      <div className="absolute bottom-[16%] left-[2%] right-[30%] h-[26%]">
        <div className="absolute bottom-0 left-0 h-full w-[42%] rounded-[4px] border border-white/70 bg-gradient-to-br from-white via-[#f7f3ec] to-[#e3dccf] shadow-[0_30px_60px_rgba(60,70,100,0.28)]">
          <div className="absolute inset-0 opacity-60" style={{ background: 'linear-gradient(115deg, transparent 42%, rgba(160,150,135,0.35) 43%, transparent 45%, transparent 62%, rgba(160,150,135,0.28) 63%, transparent 65%)' }} />
          <div className="absolute inset-x-0 top-0 h-[10%] bg-white/90" />
        </div>
        <div className="absolute bottom-[12%] left-[40%] h-[88%] w-[38%] rounded-[4px] border border-white/70 bg-gradient-to-br from-white via-[#faf6ef] to-[#ded5c4] shadow-[0_24px_50px_rgba(60,70,100,0.24)]">
          <div className="absolute inset-x-0 top-0 h-[10%] bg-white/90" />
        </div>
      </div>

      {/* fabric rolls (frozen) */}
      <div className="absolute bottom-[30%] left-[3%] w-[38%]">
        <div className="relative ml-[4%] h-14 w-[62%] sm:h-16">
          <div className="absolute inset-0 rounded-full bg-gradient-to-b from-[#4d7cab] via-[#2e5a86] to-[#1c3a5c] shadow-[0_14px_28px_rgba(28,58,92,0.45)]" />
          <div className="absolute top-1/2 right-1 h-11 w-11 -translate-y-1/2 rounded-full bg-[#0f2740] ring-4 ring-[#33587e] sm:h-12 sm:w-12">
            <div className="absolute inset-[18%] rounded-full border-2 border-[#5c87ad]/70" />
            <div className="absolute inset-[36%] rounded-full bg-[#0a1c30]" />
          </div>
        </div>
        <div className="relative -mt-1 ml-[1%] h-14 w-[66%] sm:h-16">
          <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white via-[#efe7d8] to-[#cfc3ae] shadow-[0_14px_28px_rgba(120,105,85,0.35)]" />
          <div className="absolute top-1/2 right-1 h-11 w-11 -translate-y-1/2 rounded-full bg-[#8d7f68] ring-4 ring-[#e9e0cf] sm:h-12 sm:w-12">
            <div className="absolute inset-[20%] rounded-full border-2 border-[#fffdf6]/90" />
            <div className="absolute inset-[38%] rounded-full bg-[#4d4232]" />
          </div>
        </div>
        <div className="relative -mt-1 flex w-[72%] items-center">
          <div className="relative h-14 flex-1 sm:h-16">
            <div className="absolute inset-0 rounded-full bg-gradient-to-b from-[#3f6d99] via-[#274e75] to-[#142c48] shadow-[0_16px_30px_rgba(20,44,72,0.5)]" />
          </div>
          <div className="relative -ml-6 h-12 w-[38%] shrink-0">
            <div className="absolute inset-0 rounded-full bg-gradient-to-b from-[#2b3a55] via-[#16233c] to-[#0a1224] shadow-lg" />
            <div className="absolute top-1/2 right-1 h-9 w-9 -translate-y-1/2 rounded-full bg-[#060b16] ring-4 ring-[#2c3d5c]">
              <div className="absolute inset-[30%] rounded-full bg-[#1a2942]" />
            </div>
          </div>
        </div>
        <div className="relative -mt-2 ml-[2%] h-36 w-[64%] sm:h-44">
          <div
            className="absolute inset-0 shadow-[0_24px_40px_rgba(30,58,95,0.4)]"
            style={{
              background: 'linear-gradient(160deg, #4a769f 0%, #2c587f 30%, #1d3f60 62%, #132c46 100%)',
              clipPath: 'polygon(0 0, 100% 4%, 78% 100%, 62% 100%, 70% 30%, 28% 26%, 12% 100%, 0 100%)',
              borderRadius: '18px',
            }}
          />
        </div>
      </div>

      {/* sheer ribbon — 3D animated ONLY here */}
      <div className="absolute top-[2%] left-[22%] right-[20%] h-[46%]">
        <RibbonAnimation className="h-full w-full drop-shadow-[0_18px_30px_rgba(120,170,255,0.45)]" />
      </div>

      {/* floor */}
      <div className="absolute inset-x-0 bottom-0 h-[24%] bg-gradient-to-b from-[#f8f5ef]/40 via-[#ece7dc] to-[#d9d4c9]">
        <div className="absolute inset-x-0 top-0 h-px bg-white/90" />
      </div>

      {/* right readability veil */}
      <div className="absolute inset-y-0 right-0 w-[46%] bg-gradient-to-l from-white/55 via-white/15 to-transparent" />

      {/* ---- exact photo: public/login-bg.png full-bleed, static, no animation ---- */}
      {srcIndex < PHOTO_SOURCES.length && (
        <img
          src={PHOTO_SOURCES[srcIndex]}
          alt=""
          onError={() => setSrcIndex((i) => i + 1)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </div>
  );
}
