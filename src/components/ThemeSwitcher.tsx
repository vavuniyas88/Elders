import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Palette } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { THEME_OPTIONS, useTheme } from '../contexts/ThemeContext';

export function ThemeSwitcher({
  variant = 'light',
}: {
  variant?: 'light' | 'dark-panel';
}) {
  const { lang } = useLanguage();
  const { theme, setTheme, activeThemeMeta } = useTheme();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const currentLabel =
    lang === 'ta' ? activeThemeMeta.nameTa : activeThemeMeta.nameEn;

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={lang === 'ta' ? 'தீம் மாற்றுக' : 'Switch Theme'}
        className={
          variant === 'dark-panel'
            ? 'inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-200 bg-white/10 hover:bg-white/15 border border-white/15 rounded-md transition-colors whitespace-nowrap shrink-0'
            : 'inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 app-surface app-border app-text hover:opacity-90'
        }
      >
        <Palette className="w-3.5 h-3.5 shrink-0 opacity-80" />
        <span
          className="w-2.5 h-2.5 rounded-sm shrink-0"
          style={{ backgroundColor: activeThemeMeta.primaryHex }}
        />
        <span className="hidden sm:inline max-w-[140px] truncate">
          {currentLabel}
        </span>
        <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-70" />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={lang === 'ta' ? 'தீம் தெரிவு' : 'Theme selector'}
          className="absolute right-0 mt-2 w-56 rounded-lg border shadow-lg py-1.5 z-50 app-surface app-border"
        >
          <div className="px-3 py-1.5 text-[11px] font-semibold app-text-muted border-b app-border">
            {lang === 'ta' ? 'தோற்றத் தீம் தெரிவு' : 'Select Visual Theme'}
          </div>
          {THEME_OPTIONS.map((opt) => {
            const selected = opt.id === theme;
            const label = lang === 'ta' ? opt.nameTa : opt.nameEn;
            return (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  setTheme(opt.id);
                  setOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between gap-2 transition-colors ${
                  selected
                    ? 'font-semibold app-accent-soft app-accent-text'
                    : 'app-text hover:bg-[var(--theme-surface-muted)]'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <span className="inline-flex items-center shrink-0 rounded overflow-hidden border border-black/15">
                    <span
                      className="w-2.5 h-3.5"
                      style={{ backgroundColor: opt.primaryHex }}
                    />
                    <span
                      className="w-2 h-3.5"
                      style={{ backgroundColor: opt.secondaryHex }}
                    />
                  </span>
                  <span className="truncate">{label}</span>
                </span>
                {selected && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
