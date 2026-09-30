// Shared behaviour for the lens previews: SVG helpers, trail, preview card, recenter.
// Each page calls WMMStage.init({ render }) with its own layout function.
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const $ = (id) => document.getElementById(id);
  const { ARTICLES, KINDS } = window.WMM;

  const state = { trail: ["Mind map"], pos: 0, render: null };

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  const fmt = (n) => n.toLocaleString("en-US");
  const kindOf = (id) => KINDS.find((k) => k.id === id);
  // Node radius from monthly views, on a log scale: ~500 → 4px, ~300k → 11px.
  const radius = (v) => Math.max(3.5, Math.min(11, 3 + (Math.log10(v) - 2.5) * 2.6));

  function onActivate(node, fn) {
    node.addEventListener("click", fn);
    node.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); }
    });
  }

  // Node with label, placed right or left of the dot, plus a recenter button after the label.
  function node(g, { x, y, r, color, label, right, bold, link, onPeek }) {
    const n = el("g", { class: "node", tabindex: 0, role: "button", "aria-label": `Preview ${label}` }, g);
    el("circle", { cx: x, cy: y, r, fill: color }, n);
    const off = right ? r + 7 : -(r + 7);
    const t = el("text", { x: x + off, y: y + 5, "font-size": 15, "text-anchor": right ? "start" : "end", class: "lbl", "font-weight": bold ? 700 : 400 }, n);
    t.textContent = label;
    onActivate(n, onPeek);
    const w = t.getComputedTextLength ? t.getComputedTextLength() : label.length * 7;
    const cx = right ? x + off + w + 13 : x + off - w - 13;
    const rc = el("g", { class: "rc", tabindex: 0, role: "button", "aria-label": `Make ${label} the center` }, g);
    el("circle", { cx, cy: y, r: 8.5, fill: "var(--accent-soft)", stroke: "var(--accent)", "stroke-width": 1.2 }, rc);
    el("path", { d: `M${cx} ${y - 5}v3M${cx} ${y + 2}v3M${cx - 5} ${y}h3M${cx + 2} ${y}h3`, stroke: "var(--accent)", "stroke-width": 1.6, "stroke-linecap": "round" }, rc);
    onActivate(rc, () => recenter(link.t));
    return n;
  }

  function center(g, term) {
    const cw = Math.max(150, term.length * 12 + 44);
    const c = el("g", { class: "node", tabindex: 0, role: "button", "aria-label": `About ${term}` }, g);
    el("rect", { x: -cw / 2, y: -24, width: cw, height: 48, rx: 24, fill: "var(--ink)" }, c);
    const t = el("text", { x: 0, y: 7, "text-anchor": "middle", "font-size": 20, "font-weight": 800 }, c);
    t.style.fill = "var(--paper)";
    t.textContent = term;
    onActivate(c, () => peekCenter(term));
  }

  function draw(animate) {
    const svg = $("map");
    const term = state.trail[state.pos];
    const old = svg.querySelector(".g");
    const go = () => {
      svg.innerHTML = "";
      const g = el("g", { class: "g" + (animate ? " out" : "") }, svg);
      state.render(g, term, ARTICLES[term]);
      if (animate) { g.getBoundingClientRect(); setTimeout(() => g.classList.remove("out"), 20); }
    };
    if (old && animate) { old.classList.add("out"); setTimeout(go, 250); } else go();
    drawTrail();
    drawChips();
  }

  function recenter(term) {
    if (!ARTICLES[term]) { peekMissing(term); return; }
    closePeek();
    state.trail = state.trail.slice(0, state.pos + 1);
    state.trail.push(term);
    state.pos = state.trail.length - 1;
    draw(true);
  }

  function start(term) { state.trail = [term]; state.pos = 0; closePeek(); draw(true); }

  function drawTrail() {
    const tr = $("trail");
    tr.innerHTML = "";
    state.trail.forEach((t, i) => {
      if (i) { const s = document.createElement("i"); s.textContent = "›"; tr.appendChild(s); }
      const b = document.createElement("button");
      b.type = "button"; b.textContent = t;
      if (i === state.pos) b.setAttribute("aria-current", "true");
      else b.addEventListener("click", () => { state.pos = i; closePeek(); draw(true); });
      tr.appendChild(b);
    });
  }

  function drawChips() {
    const box = $("chips");
    if (!box) return;
    box.innerHTML = "";
    Object.keys(ARTICLES).forEach((k) => {
      const c = document.createElement("button");
      c.type = "button"; c.className = "chip"; c.textContent = k;
      c.setAttribute("aria-pressed", String(state.trail[state.pos] === k));
      c.addEventListener("click", () => start(k));
      box.appendChild(c);
    });
  }

  // ---- preview card ----
  // wiki: page to open on Wikipedia (defaults to title; "Page#Section" allowed; false hides the link)
  function openPeek({ eyebrow, title, text, facts, canRecenter, wiki }) {
    $("peekSec").textContent = eyebrow;
    $("peekT").textContent = title;
    $("peekP").textContent = text;
    const dl = $("peekFacts");
    dl.innerHTML = "";
    (facts || []).forEach(([k, v]) => {
      const dt = document.createElement("dt"); dt.textContent = k;
      const dd = document.createElement("dd"); dd.textContent = v;
      dl.append(dt, dd);
    });
    dl.hidden = !facts || !facts.length;
    const row = $("peekRow");
    row.innerHTML = "";
    if (canRecenter) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "primary"; b.textContent = "⊕ Make it the center";
      b.addEventListener("click", () => recenter(title));
      row.appendChild(b);
    }
    const target = wiki === undefined ? title : wiki;
    if (target) {
      const [page, anchor] = target.split("#");
      const a = document.createElement("a");
      a.href = "https://en.wikipedia.org/wiki/" + encodeURIComponent(page.replace(/ /g, "_")) + (anchor ? "#" + encodeURIComponent(anchor.replace(/ /g, "_")) : "");
      a.target = "_blank"; a.rel = "noopener"; a.textContent = "Open on Wikipedia ↗";
      row.appendChild(a);
    }
    $("peek").hidden = false;
  }
  function closePeek() { $("peek").hidden = true; }

  const DIR_TEXT = {
    out: "Linked from this article only",
    in: "Links here, but not linked back",
    both: "Links go both ways"
  };

  function peekLink(link, from) {
    const known = !!ARTICLES[link.t];
    openPeek({
      eyebrow: "Linked with · " + from,
      title: link.t,
      text: known ? ARTICLES[link.t].lead : "In the live app, the Wikipedia summary and thumbnail load here.",
      facts: [
        ["kind", kindOf(link.kind).label],
        ["instance of", link.p31],
        ["views / month", fmt(link.v)],
        ["direction", DIR_TEXT[link.dir]]
      ],
      canRecenter: true
    });
  }
  function peekCenter(term) {
    const a = ARTICLES[term];
    openPeek({
      eyebrow: "Center article",
      title: term,
      text: a.lead,
      facts: [
        ["instance of", a.p31],
        ["links here", fmt(a.totals.in)],
        ["links out", fmt(a.totals.out)],
        ["both ways", fmt(a.totals.both)]
      ]
    });
  }
  function peekMissing(term) {
    openPeek({
      eyebrow: "Not in the sample",
      title: term,
      text: "This preview carries three sample articles. In the live app, this would load the map for “" + term + "” from Wikipedia."
    });
  }

  function init({ render }) {
    state.render = render;
    $("peekX").addEventListener("click", closePeek);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePeek(); });
    const ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    ready.then(() => draw(false));
  }

  // Find a linked article's record by title; falls back to a bare record.
  function linkOf(article, title) {
    return article.links.find((l) => l.t === title) || { t: title, kind: "concepts", p31: "unknown", v: 1000, dir: "out" };
  }

  window.WMMStage = { init, el, node, center, radius, kindOf, fmt, peekLink, openPeek, recenter, onActivate, linkOf, redraw: () => draw(false) };
})();
