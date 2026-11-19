"use client";

// Client-side store: every account the pipeline has researched, kept in this browser.
// First visit with no runs yet loads a labelled example run so the story pages are not empty.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CompanyResult, StyleExample } from "@/lib/types";

type Run = { id: string; at: string; domains: string[]; ms: number };

type Store = {
  accounts: Record<string, CompanyResult>;
  list: CompanyResult[];
  runs: Run[];
  isSample: boolean;
  ready: boolean;
  upsert: (r: CompanyResult) => void;
  addRun: (r: Run) => void;
  saveReview: (domain: string, review: CompanyResult["review"]) => void;
  saveEdit: (domain: string, subject: string, body: string) => void;
  clearAll: () => void;
  style: StyleExample[];
  hovered: string | null;
  setHovered: (d: string | null) => void;
  open: string | null;
  setOpen: (d: string | null) => void;
};

const Ctx = createContext<Store | null>(null);
const KEY = "sprinto.accounts.v2";
const RUNS = "sprinto.runs.v2";
const STYLE = "sprinto.style.v1";

function read<T>(k: string, fallback: T): T {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* storage full or blocked: the session still works */
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [accounts, setAccounts] = useState<Record<string, CompanyResult>>({});
  const [runs, setRuns] = useState<Run[]>([]);
  const [style, setStyle] = useState<StyleExample[]>([]);
  const [isSample, setIsSample] = useState(false);
  const [ready, setReady] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const a = read<Record<string, CompanyResult>>(KEY, {});
    setRuns(read<Run[]>(RUNS, []));
    setStyle(read<StyleExample[]>(STYLE, []));
    if (Object.keys(a).length) {
      setAccounts(a);
      setReady(true);
      return;
    }
    fetch("/sample.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((s: { accounts: CompanyResult[]; runs: Run[] } | null) => {
        if (s?.accounts?.length) {
          setAccounts(Object.fromEntries(s.accounts.map((x) => [x.domain, x])));
          setRuns(s.runs ?? []);
          setIsSample(true);
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const persist = useCallback((next: Record<string, CompanyResult>) => {
    write(KEY, next);
    return next;
  }, []);

  const upsert = useCallback(
    (r: CompanyResult) =>
      setAccounts((prev) => {
        // the first real run replaces the example data
        const base = isSample ? {} : prev;
        if (isSample) {
          setIsSample(false);
          setRuns([]);
        }
        const keep = base[r.domain]?.review;
        return persist({ ...base, [r.domain]: { ...r, review: keep ?? r.review } });
      }),
    [isSample, persist],
  );

  const addRun = useCallback((r: Run) => {
    setRuns((prev) => {
      const next = [r, ...prev].slice(0, 30);
      write(RUNS, next);
      return next;
    });
  }, []);

  const saveReview = useCallback(
    (domain: string, review: CompanyResult["review"]) =>
      setAccounts((prev) => (prev[domain] ? persist({ ...prev, [domain]: { ...prev[domain], review } }) : prev)),
    [persist],
  );

  const saveEdit = useCallback(
    (domain: string, subject: string, body: string) =>
      setAccounts((prev) => {
        const a = prev[domain];
        if (!a?.draft) return prev;
        if (a.draft.body !== body) {
          // learning loop: every human edit becomes a before/after example for the next drafts
          setStyle((s) => {
            const next = [...s, { before: a.draft!.body, after: body }].slice(-6);
            write(STYLE, next);
            return next;
          });
        }
        return persist({ ...prev, [domain]: { ...a, draft: { ...a.draft, subject, body } } });
      }),
    [persist],
  );

  const clearAll = useCallback(() => {
    setAccounts({});
    setRuns([]);
    write(KEY, {});
    write(RUNS, []);
  }, []);

  const list = useMemo(
    () => Object.values(accounts).sort((a, b) => (b.state.score_low ?? -1) - (a.state.score_low ?? -1)),
    [accounts],
  );

  return (
    <Ctx.Provider
      value={{ accounts, list, runs, isSample, ready, upsert, addRun, saveReview, saveEdit, clearAll, style, hovered, setHovered, open, setOpen }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside provider");
  return s;
}

// Shared hover/focus props: hovering or focusing an account highlights it in every view.
export function useLink(domain: string) {
  const { hovered, setHovered, setOpen } = useStore();
  return {
    className: hovered === domain ? "hl" : "",
    onMouseEnter: () => setHovered(domain),
    onMouseLeave: () => setHovered(null),
    onFocus: () => setHovered(domain),
    onBlur: () => setHovered(null),
    onClick: () => setOpen(domain),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(domain);
      }
    },
  };
}
