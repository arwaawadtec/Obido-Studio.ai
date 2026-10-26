import React, { useState, useEffect, useRef } from 'react';
import { X, CheckCircle2, AlertCircle, RefreshCw, Eye, Sparkles, ShieldAlert } from 'lucide-react';
import { storage } from '../../services/storage';

export const TypographyInspectorModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const lang = storage.getLanguagePreference();
  const [googleFontsReachable, setGoogleFontsReachable] = useState<boolean | null>(null);
  const [localFontsAvailable, setLocalFontsAvailable] = useState<boolean | null>(null);
  const [fontsLoadedStatus, setFontsLoadedStatus] = useState<Record<string, boolean>>({});
  const [computedStyles, setComputedStyles] = useState<{
    displayComputed: string;
    bodyComputed: string;
    arabicComputed: string;
    monoComputed: string;
    resetComputed: string;
    resetWidth: number;
    fallbackWidth: number;
  }>({
    displayComputed: '',
    bodyComputed: '',
    arabicComputed: '',
    monoComputed: '',
    resetComputed: '',
    resetWidth: 0,
    fallbackWidth: 0,
  });

  const testResetRef = useRef<HTMLDivElement>(null);
  const testFallbackRef = useRef<HTMLDivElement>(null);
  const testDisplayRef = useRef<HTMLHeadingElement>(null);
  const testBodyRef = useRef<HTMLParagraphElement>(null);
  const testArabicRef = useRef<HTMLDivElement>(null);
  const testMonoRef = useRef<HTMLSpanElement>(null);

  const runDiagnostics = async () => {
    // 1. Test Google Fonts CDN Reachability
    try {
      const gfontsTest = await fetch(
        'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500&display=swap',
        { method: 'HEAD', mode: 'no-cors' }
      );
      setGoogleFontsReachable(true);
    } catch {
      setGoogleFontsReachable(false);
    }

    // 2. Test Local .woff2 Reachability
    try {
      const localTest = await fetch('/fonts/plus-jakarta-sans-700-latin.woff2', { method: 'HEAD' });
      setLocalFontsAvailable(localTest.ok || localTest.status === 200 || localTest.status === 304);
    } catch {
      setLocalFontsAvailable(false);
    }

    // 3. Document.fonts API checks
    if (typeof document !== 'undefined' && 'fonts' in document) {
      await (document as any).fonts.ready;
      const checks: Record<string, boolean> = {
        'Plus Jakarta Sans': document.fonts.check('16px "Plus Jakarta Sans"'),
        'Noto Kufi Arabic': document.fonts.check('16px "Noto Kufi Arabic"'),
        'IBM Plex Sans Arabic': document.fonts.check('16px "IBM Plex Sans Arabic"'),
        'Inter': document.fonts.check('16px "Inter"'),
        'JetBrains Mono': document.fonts.check('16px "JetBrains Mono"'),
      };
      setFontsLoadedStatus(checks);

      // Console audit table for direct browser inspection
      console.group('[Typography Audit — Runtime Diagnostics]');
      console.log('Document.fonts status:', (document as any).fonts.status);
      console.table(checks);
      console.groupEnd();
    }

    // 4. Measure Computed Styles & Glyph Metrics
    if (testResetRef.current && testFallbackRef.current) {
      const resetStyle = window.getComputedStyle(testResetRef.current);
      const displayStyle = testDisplayRef.current ? window.getComputedStyle(testDisplayRef.current) : null;
      const bodyStyle = testBodyRef.current ? window.getComputedStyle(testBodyRef.current) : null;
      const arabicStyle = testArabicRef.current ? window.getComputedStyle(testArabicRef.current) : null;
      const monoStyle = testMonoRef.current ? window.getComputedStyle(testMonoRef.current) : null;

      const rWidth = testResetRef.current.getBoundingClientRect().width;
      const fWidth = testFallbackRef.current.getBoundingClientRect().width;

      setComputedStyles({
        resetComputed: resetStyle.fontFamily,
        displayComputed: displayStyle?.fontFamily || '',
        bodyComputed: bodyStyle?.fontFamily || '',
        arabicComputed: arabicStyle?.fontFamily || '',
        monoComputed: monoStyle?.fontFamily || '',
        resetWidth: Math.round(rWidth * 10) / 10,
        fallbackWidth: Math.round(fWidth * 10) / 10,
      });

      console.log('[Typography Audit — Computed Styles]:', {
        forcedResetFont: resetStyle.fontFamily,
        displayHeadingFont: displayStyle?.fontFamily,
        bodyTextFont: bodyStyle?.fontFamily,
        arabicHeadingFont: arabicStyle?.fontFamily,
        monoFont: monoStyle?.fontFamily,
        resetElementWidth: rWidth,
        systemFallbackWidth: fWidth,
        isCustomFontRendering: Math.abs(rWidth - fWidth) > 0.5,
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      runDiagnostics();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isCustomRendering = Math.abs(computedStyles.resetWidth - computedStyles.fallbackWidth) > 0.5;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-[#E3E6EF] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-[#E3E6EF] flex items-center justify-between bg-[#F6F7FB]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#11152B] flex items-center justify-center text-white">
              <Eye className="w-4 h-4 text-[#38D9F9]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#11152B] font-display">
                {lang === 'ar' ? 'فاحص الخطوط والتنسيقات المحوسبة' : 'Typography & Font Inspector'}
              </h2>
              <p className="text-xs text-[#62677A]">
                {lang === 'ar'
                  ? 'تشخيص شبكة الخطوط، وفحص إعادة التعيين القسري (Style Reset)، والأنماط المحوسبة'
                  : 'Live network audit, forced style reset test, and computed cascade analysis'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#62677A] hover:text-[#11152B] hover:bg-white rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-[#171A2B]">
          {/* Section 1: Network & Origin Delivery Status */}
          <div className="p-4 bg-[#F6F7FB] border border-[#E3E6EF] rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#11152B] uppercase tracking-wider text-[11px] font-mono">
                1. Network & Delivery Audit
              </span>
              <button
                onClick={runDiagnostics}
                className="flex items-center gap-1 text-[11px] text-[#635BFF] hover:underline font-semibold"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Re-run Test</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-3 bg-white rounded-lg border border-[#E3E6EF] flex items-center justify-between">
                <div>
                  <span className="font-semibold block text-[#11152B]">Google Fonts CDN</span>
                  <span className="text-[10px] text-[#62677A]">fonts.googleapis.com</span>
                </div>
                {googleFontsReachable === null ? (
                  <span className="text-amber-500 font-mono text-[10px]">Testing...</span>
                ) : googleFontsReachable ? (
                  <span className="flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Reachable
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-600 font-semibold text-[11px]">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Blocked / Offline
                  </span>
                )}
              </div>

              <div className="p-3 bg-white rounded-lg border border-[#E3E6EF] flex items-center justify-between">
                <div>
                  <span className="font-semibold block text-[#11152B]">Local Same-Origin .woff2</span>
                  <span className="text-[10px] text-[#62677A]">/public/fonts/ (Zero-block)</span>
                </div>
                {localFontsAvailable === null ? (
                  <span className="text-amber-500 font-mono text-[10px]">Checking...</span>
                ) : localFontsAvailable ? (
                  <span className="flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Active (Same-Origin)
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-rose-600 font-semibold text-[11px]">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Unavailable
                  </span>
                )}
              </div>
            </div>

            {/* document.fonts.check summary */}
            <div className="pt-2 border-t border-[#E3E6EF]">
              <span className="text-[10px] text-[#62677A] block mb-1 font-mono uppercase">
                Browser Font Loading API (document.fonts.check):
              </span>
              <div className="flex flex-wrap gap-2">
                {Object.entries(fontsLoadedStatus).map(([fontName, isLoaded]) => (
                  <span
                    key={fontName}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 border ${
                      isLoaded
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    <span>{fontName}:</span>
                    <strong>{isLoaded ? 'Loaded' : 'Pending/Fallback'}</strong>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Section 2: FORCED STYLE RESET TEST ELEMENT */}
          <div className="p-4 bg-white border border-[#E3E6EF] rounded-xl space-y-4">
            <div>
              <span className="font-bold text-[#11152B] uppercase tracking-wider text-[11px] font-mono block">
                2. Forced Style Reset Isolation Test
              </span>
              <p className="text-[11px] text-[#62677A] mt-0.5">
                The test element below applies <code className="bg-[#F6F7FB] px-1 py-0.5 rounded font-mono">all: unset</code> to strip away ALL Tailwind utilities and framework cascade rules, testing purely whether the custom font renders in isolation.
              </p>
            </div>

            {/* Side by side comparison: Forced Reset vs Fallback Baseline */}
            <div className="space-y-3">
              {/* Forced Reset Element */}
              <div className="p-4 bg-[#F6F7FB] rounded-xl border border-[#635BFF]/30">
                <span className="text-[10px] text-[#635BFF] font-mono uppercase font-semibold block mb-1.5">
                  [Forced Reset Element] — all: unset; font-family: var(--font-display);
                </span>
                <div
                  ref={testResetRef}
                  style={{
                    all: 'unset',
                    display: 'block',
                    fontFamily: 'var(--font-display)',
                    fontSize: '22px',
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    color: '#11152B',
                  }}
                >
                  Obido Studio — Film & Production Architecture 2026
                </div>
                <div className="mt-2 text-[10px] text-[#62677A] font-mono flex items-center justify-between border-t border-[#E3E6EF] pt-1.5">
                  <span>Computed: <strong className="text-[#11152B]">{computedStyles.resetComputed || 'Measuring...'}</strong></span>
                  <span>Rendered width: <strong>{computedStyles.resetWidth}px</strong></span>
                </div>
              </div>

              {/* Baseline Fallback Element for Glyph Metric Comparison */}
              <div className="p-3 bg-white rounded-lg border border-dashed border-[#E3E6EF]">
                <span className="text-[10px] text-[#62677A] font-mono uppercase block mb-1">
                  [Baseline Fallback for Glyph Metrics] — font-family: sans-serif;
                </span>
                <div
                  ref={testFallbackRef}
                  style={{
                    all: 'unset',
                    display: 'block',
                    fontFamily: 'sans-serif',
                    fontSize: '22px',
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    color: '#62677A',
                  }}
                >
                  Obido Studio — Film & Production Architecture 2026
                </div>
                <div className="mt-1 text-[10px] text-[#62677A] font-mono flex items-center justify-between">
                  <span>Fallback width: <strong>{computedStyles.fallbackWidth}px</strong></span>
                  <span className={`font-semibold ${isCustomRendering ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {isCustomRendering ? '✓ Custom Font Glyphs Confirmed' : '⚠ Metrics Match Generic Sans'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Live Component-Level Cascade Audit */}
          <div className="p-4 bg-[#F6F7FB] border border-[#E3E6EF] rounded-xl space-y-3">
            <span className="font-bold text-[#11152B] uppercase tracking-wider text-[11px] font-mono block">
              3. Component-Level Computed Typography
            </span>

            <div className="space-y-2">
              <div className="p-2.5 bg-white rounded-lg border border-[#E3E6EF] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-[#62677A] block font-mono">English Display Headings (h1 - h6, .font-display):</span>
                  <h3 ref={testDisplayRef} className="font-display font-bold text-sm text-[#11152B]">
                    From Concept to Film Timeline
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-[#635BFF] max-w-[220px] text-right truncate">
                  {computedStyles.displayComputed}
                </span>
              </div>

              <div className="p-2.5 bg-white rounded-lg border border-[#E3E6EF] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-[#62677A] block font-mono">Arabic Display Headings (dir=&quot;rtl&quot; h1 - h6):</span>
                  <div ref={testArabicRef} dir="rtl" className="font-display font-bold text-sm text-[#11152B]">
                    استوديو أوبيدو لإنتاج الفيديو الذكي
                  </div>
                </div>
                <span className="text-[10px] font-mono text-[#635BFF] max-w-[220px] text-right truncate">
                  {computedStyles.arabicComputed}
                </span>
              </div>

              <div className="p-2.5 bg-white rounded-lg border border-[#E3E6EF] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-[#62677A] block font-mono">Standard Body & UI Controls (p, button, input):</span>
                  <p ref={testBodyRef} className="text-xs text-[#171A2B]">
                    Multi-track video sequencing with generative prompt engineering.
                  </p>
                </div>
                <span className="text-[10px] font-mono text-[#62677A] max-w-[220px] text-right truncate">
                  {computedStyles.bodyComputed}
                </span>
              </div>

              <div className="p-2.5 bg-white rounded-lg border border-[#E3E6EF] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-[#62677A] block font-mono">Monospace & Tabular Numerals (.font-mono, .tabular-nums):</span>
                  <span ref={testMonoRef} className="font-mono tabular-nums text-xs text-[#11152B] font-bold">
                    00:45 · 16:9 · 1080p · 24fps
                  </span>
                </div>
                <span className="text-[10px] font-mono text-[#62677A] max-w-[220px] text-right truncate">
                  {computedStyles.monoComputed}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#E3E6EF] bg-[#F6F7FB] flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-[#62677A]">
            <Sparkles className="w-3.5 h-3.5 text-[#635BFF]" />
            <span>Open DevTools Console to inspect full [Typography Audit] object.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#11152B] hover:bg-[#635BFF] rounded-lg transition-colors"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
