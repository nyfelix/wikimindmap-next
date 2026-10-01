import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";
import { GITHUB_URL } from "./links.ts";
import { Logo } from "./Logo.tsx";
import styles from "./LogoMenu.module.css";

/** Clicking the logo opens a small menu: About, How lenses work, GitHub (US-12). */
export function LogoMenu() {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (
        e instanceof KeyboardEvent ? e.key === "Escape" : !root.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div className={styles.root} ref={root}>
      <button
        type="button"
        className={styles.button}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        aria-label="WikiMindMap menu"
        onClick={() => setOpen((o) => !o)}
      >
        <Logo height={20} />
      </button>
      {open && (
        <ul id={id} className={styles.menu} role="menu">
          <li role="none">
            <Link role="menuitem" to="/about" onClick={() => setOpen(false)}>
              About
            </Link>
          </li>
          <li role="none">
            <Link role="menuitem" to="/help/lenses" onClick={() => setOpen(false)}>
              How lenses work
            </Link>
          </li>
          <li role="none">
            <a role="menuitem" href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              GitHub ↗
            </a>
          </li>
        </ul>
      )}
    </div>
  );
}
