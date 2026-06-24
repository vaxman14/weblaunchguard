import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "wlg_a11y";

type A11yPrefs = {
  fontSize: "normal" | "large" | "xl";
  highContrast: boolean;
  reduceMotion: boolean;
  dyslexicFont: boolean;
};

const defaults: A11yPrefs = {
  fontSize: "normal",
  highContrast: false,
  reduceMotion: false,
  dyslexicFont: false
};

function loadPrefs(): A11yPrefs {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...(JSON.parse(raw) as Partial<A11yPrefs>) };
  } catch {
    return defaults;
  }
}

function savePrefs(prefs: A11yPrefs) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    return;
  }
}

function applyPrefs(prefs: A11yPrefs) {
  const root = document.documentElement;
  root.setAttribute("data-a11y-font-size", prefs.fontSize);
  root.setAttribute("data-a11y-contrast", prefs.highContrast ? "high" : "normal");
  root.setAttribute("data-a11y-motion", prefs.reduceMotion ? "reduce" : "normal");
  root.setAttribute("data-a11y-dyslexic", prefs.dyslexicFont ? "true" : "false");

  const fontSizeMap = { normal: "16px", large: "18px", xl: "21px" };
  root.style.setProperty("--a11y-base-font-size", fontSizeMap[prefs.fontSize]);
}

export function A11yWidget() {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<A11yPrefs>(loadPrefs);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    applyPrefs(prefs);
    savePrefs(prefs);
  }, [prefs]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) setOpen(false);
    }

    function onClickOut(e: MouseEvent) {
      if (open && panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClickOut);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClickOut);
    };
  }, [open]);

  function update<K extends keyof A11yPrefs>(key: K, value: A11yPrefs[K]) {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  }

  function reset() {
    setPrefs(defaults);
  }

  const fontSizes: Array<{ label: string; value: A11yPrefs["fontSize"] }> = [
    { label: "A", value: "normal" },
    { label: "A+", value: "large" },
    { label: "A++", value: "xl" }
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50" ref={panelRef}>
      {open && (
        <div
          role="dialog"
          aria-label="Accessibility options"
          className="mb-3 w-64 rounded-xl border border-line bg-panel p-4 shadow-soft"
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">Accessibility</p>
            <button
              aria-label="Close accessibility panel"
              className="text-muted hover:text-ink"
              onClick={() => setOpen(false)}
            >
              ✕
            </button>
          </div>

          {/* Font size */}
          <div className="mb-3">
            <p className="mb-1.5 text-xs font-medium text-muted">Text size</p>
            <div className="flex gap-2">
              {fontSizes.map(({ label, value }) => (
                <button
                  key={value}
                  aria-pressed={prefs.fontSize === value}
                  onClick={() => update("fontSize", value)}
                  className={`flex-1 rounded-lg border py-1.5 text-xs font-semibold transition-colors ${
                    prefs.fontSize === value
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-line text-muted hover:border-accent hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          {(
            [
              { key: "highContrast", label: "High contrast" },
              { key: "reduceMotion", label: "Reduce motion" },
              { key: "dyslexicFont", label: "Dyslexia-friendly font" }
            ] as Array<{ key: keyof A11yPrefs; label: string }>
          ).map(({ key, label }) => (
            <label key={key} className="mb-2 flex cursor-pointer items-center justify-between last:mb-0">
              <span className="text-sm text-ink">{label}</span>
              <button
                role="switch"
                aria-checked={Boolean(prefs[key])}
                onClick={() => update(key, !prefs[key] as A11yPrefs[typeof key])}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                  prefs[key] ? "bg-accent" : "bg-line"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                    prefs[key] ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </label>
          ))}

          {/* Reset */}
          <button
            onClick={reset}
            className="mt-3 w-full rounded-lg border border-line py-1.5 text-xs text-muted hover:border-accent hover:text-ink"
          >
            Reset to defaults
          </button>
        </div>
      )}

      <button
        aria-label={open ? "Close accessibility options" : "Open accessibility options"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-[58px] w-[58px] items-center justify-center rounded-full bg-accent text-white shadow-soft ring-2 ring-white/15 transition hover:brightness-110 focus-visible:outline focus-visible:outline-3 focus-visible:outline-accent"
      >
        <svg aria-hidden="true" className="h-8 w-8" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm9 5H3v2h6v13h2v-6h2v6h2V9h6V7z" />
        </svg>
      </button>
    </div>
  );
}
