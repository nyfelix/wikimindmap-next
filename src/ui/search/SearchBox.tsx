import { useQuery } from "@tanstack/react-query";
import { useId, useRef, useState, type RefObject } from "react";
import type { Lang, Title } from "../../core/types.ts";
import { featuredArticle, randomArticle } from "../../sources/discover.ts";
import { searchTitles, type Suggestion } from "../../sources/search.ts";
import { HOUR } from "../data/cache.ts";
import styles from "./SearchBox.module.css";
import { useDebounced } from "./useDebounced.ts";

interface Props {
  lang: Lang;
  onPick: (title: Title) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  initialQuery?: string;
  /** The start page highlights the field (styleguide.md §15). */
  highlight?: boolean;
  autoFocus?: boolean;
}

const MIN_CHARS = 2;

interface Option {
  id: string;
  label: string;
  detail?: string;
  pick: () => void;
}

/** Search with suggestions (US-04): after 2 characters, debounced by 200 ms. */
export function SearchBox({
  lang,
  onPick,
  inputRef,
  initialQuery = "",
  highlight,
  autoFocus,
}: Props) {
  const listId = useId();
  const ownRef = useRef<HTMLInputElement>(null);
  const input = inputRef ?? ownRef;
  const [query, setQuery] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // Closing waits a moment after blur so a click on a suggestion still lands; focusing or
  // typing again cancels that pending close.
  const closing = useRef<ReturnType<typeof setTimeout>>(undefined);
  const reopen = () => {
    clearTimeout(closing.current);
    setOpen(true);
  };
  const trimmed = query.trim();
  const settled = useDebounced(trimmed, 200);

  const search = useQuery({
    queryKey: ["search", lang, settled],
    queryFn: ({ signal }) => searchTitles(lang, settled, { signal }),
    enabled: settled.length >= MIN_CHARS,
    staleTime: HOUR,
    gcTime: HOUR,
  });
  const today = new Date().toISOString().slice(0, 10);
  const featured = useQuery({
    queryKey: ["featured", lang, today],
    queryFn: () => featuredArticle(lang, new Date()),
    enabled: open && trimmed.length === 0,
    staleTime: HOUR,
  });

  const pick = (title: Title) => {
    setOpen(false);
    setQuery("");
    setActive(-1);
    onPick(title);
  };
  const blur = () => input.current?.blur();

  const suggestions: Suggestion[] =
    trimmed.length >= MIN_CHARS && settled === trimmed ? (search.data ?? []) : [];
  const options: Option[] =
    trimmed.length === 0
      ? [
          ...(featured.data
            ? [
                {
                  id: "featured",
                  label: featured.data,
                  detail: "Today’s featured article",
                  pick: () => pick(featured.data as Title),
                },
              ]
            : []),
          {
            id: "random",
            label: "Random article",
            detail: "Surprise me",
            pick: () => {
              void randomArticle(lang).then(pick, () => {});
            },
          },
        ]
      : suggestions.map((s, i) => {
          const option: Option = { id: `s${i}`, label: s.title, pick: () => pick(s.title) };
          if (s.description) option.detail = s.description;
          return option;
        });

  const searching = trimmed.length >= MIN_CHARS && (settled !== trimmed || search.isFetching);
  const noResults =
    trimmed.length >= MIN_CHARS && !searching && search.isSuccess && suggestions.length === 0;
  const showList = open && (options.length > 0 || noResults);

  return (
    <form
      className={`${styles.search} ${highlight ? styles.highlight : ""}`}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        // Enter without choosing picks the active, or else the first suggestion.
        const option = options[active] ?? (trimmed ? options[0] : undefined);
        if (option) {
          blur();
          option.pick();
        }
      }}
    >
      <span className={styles.lang} aria-label={`Wikipedia language: ${lang}`}>
        {lang}
      </span>
      <input
        ref={input}
        className={styles.input}
        type="search"
        role="combobox"
        aria-label="Search Wikipedia"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          active >= 0 && options[active] ? `${listId}-${options[active].id}` : undefined
        }
        placeholder="Search Wikipedia…"
        autoComplete="off"
        spellCheck={false}
        autoFocus={autoFocus}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          reopen();
          setActive(-1);
        }}
        onFocus={reopen}
        onBlur={() => {
          closing.current = setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            reopen();
            setActive((a) => Math.min(options.length - 1, a + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(-1, a - 1));
          } else if (e.key === "Escape") {
            e.stopPropagation();
            if (open && (query || showList)) {
              setOpen(false);
              setActive(-1);
            } else {
              input.current?.blur();
            }
          }
        }}
      />
      <kbd className={styles.kbd} aria-hidden="true">
        /
      </kbd>
      {showList && (
        <ul id={listId} className={styles.list} role="listbox" aria-label="Suggestions">
          {options.map((o, i) => (
            <li
              key={o.id}
              id={`${listId}-${o.id}`}
              role="option"
              aria-selected={i === active}
              className={styles.option}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                blur();
                o.pick();
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span className={styles.optionTitle}>{o.label}</span>
              {o.detail && <span className={styles.optionDetail}>{o.detail}</span>}
            </li>
          ))}
          {noResults && (
            <li className={styles.empty} role="presentation">
              No article found for ‘{trimmed}’
            </li>
          )}
        </ul>
      )}
    </form>
  );
}
