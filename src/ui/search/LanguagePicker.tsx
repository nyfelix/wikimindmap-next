import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Lang } from "../../core/types.ts";
import type { Wikipedia } from "../../sources/languages.ts";
import { wikipediasQuery } from "../data/queries.ts";
import styles from "./LanguagePicker.module.css";

/** The largest Wikipedias come first; the rest follow by their own name. */
const COMMON = [
  "en",
  "de",
  "fr",
  "es",
  "it",
  "ja",
  "ru",
  "pt",
  "zh",
  "nl",
  "pl",
  "sv",
  "ar",
  "uk",
  "ko",
  "fa",
  "tr",
  "cs",
  "he",
  "id",
];

interface Props {
  lang: Lang;
  onChange: (lang: Lang) => void;
}

/** `EN ▾` in the search panel (US-09): every open Wikipedia, filterable. */
export function LanguagePicker({ lang, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const wikis = useQuery({ ...wikipediasQuery(), enabled: open });

  const options = useMemo(() => {
    const all = wikis.data ?? [];
    const q = filter.trim().toLowerCase();
    const match = (w: Wikipedia) =>
      !q ||
      w.lang.startsWith(q) ||
      w.name.toLowerCase().includes(q) ||
      w.englishName.toLowerCase().includes(q);
    const common = COMMON.flatMap((c) => all.filter((w) => w.lang === c));
    const rest = all.filter((w) => !COMMON.includes(w.lang));
    return [...common, ...rest].filter(match);
  }, [wikis.data, filter]);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const choose = (w: Wikipedia) => {
    setOpen(false);
    setFilter("");
    if (w.lang !== lang) onChange(w.lang);
  };

  return (
    <div className={styles.root} ref={root}>
      <button
        type="button"
        className={styles.button}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Wikipedia language: ${lang}. Change language`}
        onClick={() => {
          setOpen((o) => !o);
          setActive(0);
        }}
      >
        {lang} <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className={styles.popover}>
          <input
            className={styles.filter}
            type="search"
            role="combobox"
            aria-label="Find a language"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={
              options[active] ? `${listId}-${options[active].lang}` : undefined
            }
            placeholder="Find a language…"
            autoFocus
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(options.length - 1, a + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const w = options[active];
                if (w) choose(w);
              } else if (e.key === "Escape") {
                e.stopPropagation();
                setOpen(false);
              }
            }}
          />
          <ul id={listId} className={styles.list} role="listbox" aria-label="Wikipedia languages">
            {wikis.isPending && <li className={styles.note}>Loading languages…</li>}
            {wikis.isError && (
              <li className={styles.note}>Wikipedia didn’t answer. Try again later.</li>
            )}
            {wikis.isSuccess && options.length === 0 && (
              <li className={styles.note}>No language found.</li>
            )}
            {options.map((w, i) => (
              <li
                key={w.lang}
                id={`${listId}-${w.lang}`}
                role="option"
                aria-selected={i === active}
                aria-current={w.lang === lang ? "true" : undefined}
                className={styles.option}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(w)}
              >
                <span className={styles.code}>{w.lang}</span>
                <span className={styles.name} lang={w.lang}>
                  {w.name}
                </span>
                {w.englishName !== w.name && (
                  <span className={styles.english}>{w.englishName}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
