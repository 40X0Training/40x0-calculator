import { useState, useEffect, useRef } from "react";

// ═════════════════════════════════════════════════════════════════
// 40X0 Training Calculator
// 1RM & Load Planner + Limiting Lift Calculator
// ═════════════════════════════════════════════════════════════════

// ── Continuum table ───────────────────────────────────────────────
const PCT = {
  1:1.00, 2:0.94, 3:0.90, 4:0.88, 5:0.85, 6:0.83, 7:0.80, 8:0.78,
  9:0.76, 10:0.74, 11:0.72, 12:0.70, 13:0.68, 14:0.67, 15:0.66,
  16:0.65, 17:0.63, 18:0.62, 19:0.61, 20:0.60,
};
const getPct = (r) => PCT[Math.max(1, Math.min(20, r))] ?? 0.60;

const STEP_PCT = {
  2:0.05, 3:0.05, 4:0.075, 5:0.10, 6:0.125, 7:0.15,
  8:0.175, 9:0.20, 10:0.225, 11:0.25, 12:0.275,
};

const WEEK_DEFAULTS = [
  { label:"Week 1", tag:"Building In",  pct:-0.05  },
  { label:"Week 2", tag:"Coordinating", pct:0      },
  { label:"Week 3", tag:"Expressing",   pct:0.025  },
  { label:"Week 4", tag:"Peaking",      pct:0.05   },
];

const WARMUP = [
  { reps:6, pct:0.50 },
  { reps:4, pct:0.75 },
  { reps:2, pct:0.90 },
];

const UPPER = ["Overhead Press", "Incline Press", "Bench Press", "Dips / Decline", "Chin-up"];
const LOWER = ["Front Squat", "Squat", "Deadlift"];

const KG = 2.20462;
const MIN_SLOTS = 6;
const MAX_SLOTS = 12;
const MAX_EXERCISES = 8;
const STORE_KEY = "40x0-calculator-v2";

// ── Limiting Lift definitions ─────────────────────────────────────
const LIFT_DEFS = [
  { key:"ohp",      label:"Overhead Press",       group:"upper", motherKey:"bench", targetRatio:0.72 },
  { key:"incline",  label:"Incline Press",        group:"upper", motherKey:"bench", targetRatio:0.91 },
  { key:"bench",    label:"Bench Press",          group:"upper", motherKey:null,    targetRatio:null },
  { key:"dips",     label:"Dips / Decline Press", group:"upper", motherKey:"bench", targetRatio:1.17 },
  { key:"chinup",   label:"Chin-up",              group:"upper", motherKey:"bench", targetRatio:0.87 },
  { key:"frontsq",  label:"Front Squat",          group:"lower", motherKey:"squat", targetRatio:0.85 },
  { key:"squat",    label:"Squat",                group:"lower", motherKey:null,    targetRatio:null },
  { key:"deadlift", label:"Deadlift",             group:"lower", motherKey:"squat", targetRatio:1.25 },
];
const GROUPS = [
  { key:"upper", label:"Upper Body" },
  { key:"lower", label:"Lower Body" },
];

// ── Number helpers ────────────────────────────────────────────────
const roundHalf = (n) => Math.round(n * 2) / 2;
const factor    = (unit) => (unit === "kg" ? 1 / KG : 1);

// Load rounding: lbs → whole number with micro plates, nearest 5 without.
// kg → nearest 0.5 with micro plates, nearest 2.5 without.
function roundLoad(v, unit, micro) {
  if (unit === "kg") return micro ? Math.round(v * 2) / 2 : Math.round(v / 2.5) * 2.5;
  return micro ? Math.round(v) : Math.round(v / 5) * 5;
}

function fmt(n) {
  if (n === undefined || n === null || isNaN(n)) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
function fmtPct(p) {
  const v = Math.round(p * 1000) / 10;
  const abs = Math.abs(v);
  const str = Number.isInteger(abs) ? String(abs) : abs.toFixed(1);
  return (v > 0 ? "+" : v < 0 ? "−" : "") + str + "%";
}
const fmtRatio = (n) => (n === null || n === undefined || isNaN(n) ? "—" : (n * 100).toFixed(1) + "%");
const fmtGap   = (n) => (n === null || n === undefined || isNaN(n) ? "—" : (n >= 0 ? "+" : "−") + Math.abs(n * 100).toFixed(1) + "%");
const roundPct = (n) => Math.round(n * 1000) / 1000;
const repWord  = (n) => (n === 1 ? "1 Rep" : `${n} Reps`);

// Keep only digits (and one decimal point when allowed)
function cleanNum(str, decimal) {
  let v = String(str).replace(decimal ? /[^\d.]/g : /\D/g, "");
  if (decimal) {
    const parts = v.split(".");
    if (parts.length > 2) v = parts[0] + "." + parts.slice(1).join("");
  }
  return v;
}

// ── Training math ─────────────────────────────────────────────────
function rawLadder(top, sets) {
  if (sets === 1) return [top];
  const bottom = top * (1 - (STEP_PCT[sets] ?? 0.10));
  return Array.from({ length: sets }, (_, i) => bottom + (top - bottom) * (i / (sets - 1)));
}

function parseComplex(slots) {
  return slots.map((s) => parseInt(s)).filter((n) => !isNaN(n) && n >= 1 && n <= 15);
}

const BAR = { lbs:45, kg:20 };
function platesPerSide(weight, unit, micro) {
  const list = unit === "lbs"
    ? [45, 35, 25, 10, 5, 2.5].concat(micro ? [1, 0.5] : [])
    : [25, 20, 15, 10, 5, 2.5, 1.25].concat(micro ? [1, 0.5, 0.25] : []);
  let per = (weight - BAR[unit]) / 2;
  if (per < -1e-6) return "Under bar";
  if (per < 1e-6) return "Bar only";
  const out = [];
  for (const p of list) {
    while (per >= p - 1e-6) { out.push(p); per -= p; }
  }
  const g = (x) => String(+x.toFixed(2));
  return out.map(g).join(", ") + (per > 0.01 ? ` (+${g(per)})` : "");
}

// Plate row rules: hidden for Chin-up, labelled for Dips / Decline
function plateRule(exName) {
  if (exName === "Chin-up") return { show:false };
  if (exName === "Dips / Decline") return { show:true, note:"if Decline Press" };
  return { show:true, note:"" };
}

function exerciseName(ex) {
  return (ex.customEx || "").trim() || ex.exercise || "";
}

// Everything the planner shows for one exercise, in the exercise's unit
function computeExercise(ex) {
  const unit = ex.unit;
  const f = factor(unit);
  const r = parseInt(ex.topReps);
  const topOk   = ex.weightLbs > 0 && r >= 1 && r <= 20;
  const knownOk = ex.knownLbs > 0;
  const e1Lbs = knownOk ? ex.knownLbs : topOk ? ex.weightLbs / getPct(r) : null;
  const e1 = e1Lbs ? e1Lbs * f : null;

  const ts = parseInt(ex.targetSets);
  const tr = parseInt(ex.targetReps);
  const stdOk = ts >= 2 && ts <= 12 && tr >= 1 && tr <= 20;
  const cxReps = parseComplex(ex.complexSlots);

  const out = {
    unit, e1, e1Lbs, source: knownOk ? "known" : topOk ? "top" : null,
    topReps: r, ts, tr, stdOk, cxReps,
    rm: null, stepLadder: null, weeks: null,
  };
  if (!e1) return out;

  const rl = (v) => roundLoad(v, unit, ex.micro);

  if (ex.mode === "standard") {
    if (!stdOk) return out;
    const rm = e1 * getPct(tr);
    out.rm = rm;
    out.stepLadder = rawLadder(rm, ts).map(rl);
    out.weeks = ex.weeks.map((w, k) => {
      const sets = w.sets ?? ts;
      const raw = rawLadder(rm * (1 + w.pct), sets);
      const loads = raw.map(rl);
      return {
        ...WEEK_DEFAULTS[k], pct: w.pct, setsCount: sets,
        rows: loads.map((load) => ({ reps: tr, load })),
        warmups: WARMUP.map((x) => ({ reps: x.reps, load: rl(raw[0] * x.pct) })),
        heavy: loads[loads.length - 1],
      };
    });
  } else {
    if (!cxReps.length) return out;
    out.weeks = ex.weeks.map((w, k) => {
      const raw = cxReps.map((rep) => e1 * getPct(rep) * (1 + w.pct));
      const loads = raw.map(rl);
      return {
        ...WEEK_DEFAULTS[k], pct: w.pct, setsCount: loads.length,
        rows: loads.map((load, i) => ({ reps: cxReps[i], load })),
        warmups: WARMUP.map((x) => ({ reps: x.reps, load: rl(raw[0] * x.pct) })),
        heavy: Math.max(...loads),
      };
    });
  }
  return out;
}

// ── Limiting lift math ────────────────────────────────────────────
// Each lift uses one source: a known 1RM or weight and reps.
function liftSource(inp) {
  const r = parseInt(inp.r);
  const calcOk = inp.wLbs > 0 && r >= 1 && r <= 20;
  const knownOk = inp.kLbs > 0;
  if (inp.src === "known" && knownOk) return { e1: inp.kLbs, known: true };
  if (inp.src === "calc" && calcOk) return { e1: inp.wLbs / getPct(r), known: false };
  if (calcOk) return { e1: inp.wLbs / getPct(r), known: false };
  if (knownOk) return { e1: inp.kLbs, known: true };
  return null;
}

function computeLL(ll) {
  const src = {};
  LIFT_DEFS.forEach((d) => { src[d.key] = liftSource(ll[d.key]); });
  const results = LIFT_DEFS.map((d) => {
    const s = src[d.key];
    const e1 = s ? s.e1 : null;
    if (!d.motherKey) return { ...d, e1, known: s?.known ?? false, ratio:null, gap:null };
    const m = src[d.motherKey];
    const ratio = e1 && m ? e1 / m.e1 : null;
    return { ...d, e1, known: s?.known ?? false, ratio, gap: ratio !== null ? ratio - d.targetRatio : null };
  });
  for (const g of GROUPS) {
    const dep = results.filter((x) => x.group === g.key && x.motherKey && x.gap !== null);
    if (!dep.length) continue;
    const worst = dep.reduce((a, b) => (a.gap < b.gap ? a : b));
    if (worst.gap < 0) worst.isLimiting = true;
  }
  const hasAny = results.some((x) => x.motherKey && x.gap !== null);
  return { results, hasAny };
}
const gapStatus = (gap) => (gap === null ? "none" : gap >= 0 ? "good" : gap > -0.05 ? "warn" : "bad");

// ── State factories ───────────────────────────────────────────────
let idSeq = 0;
const newId = () => `ex${Date.now().toString(36)}${(idSeq++).toString(36)}`;

function makeWeeks(n = 3) {
  return WEEK_DEFAULTS.slice(0, n).map((w) => ({ pct: w.pct, sets: null }));
}

function makeExercise(overrides = {}) {
  return {
    id:           newId(),
    exercise:     "",
    customEx:     "",
    weight:       "", weightLbs: null,
    topReps:      "",
    known:        "", knownLbs: null,
    mode:         "standard",
    targetSets:   "",
    targetReps:   "",
    complexSlots: Array(MIN_SLOTS).fill(""),
    unit:         "lbs",
    micro:        true,
    weeks:        makeWeeks(3),
    warmOpen:     false,
    stepOpen:     false,
    collapsed:    false,
    ...overrides,
  };
}

const EMPTY_LIFT = { w:"", wLbs:null, r:"", k:"", kLbs:null, src:null };
const makeLL = () => Object.fromEntries(LIFT_DEFS.map((d) => [d.key, { ...EMPTY_LIFT }]));

function loadSaved() {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || !Array.isArray(d.exercises) || !d.exercises.length) return null;
    const ll = makeLL();
    if (d.ll) LIFT_DEFS.forEach((x) => { if (d.ll[x.key]) ll[x.key] = { ...EMPTY_LIFT, ...d.ll[x.key] }; });
    return {
      ...d,
      exercises: d.exercises.map((ex) => makeExercise({ ...ex, id: newId() })),
      ll,
    };
  } catch {
    return null;
  }
}

// ── Plain-text builders (copy buttons) ────────────────────────────
function planText(exercises, clientName) {
  const blocks = [];
  exercises.forEach((ex, i) => {
    const c = computeExercise(ex);
    if (!c.e1 || !c.weeks) return;
    const u = c.unit;
    const name = exerciseName(ex) || `Exercise ${i + 1}`;
    let t = `${name.toUpperCase()}\n`;
    t += `Estimated 1RM: ${fmt(roundHalf(c.e1))} ${u}`;
    t += c.source === "known" ? " (known)\n" : ` (from ${fmt(roundHalf(ex.weightLbs * factor(u)))} ${u} for ${c.topReps} reps)\n`;
    if (ex.mode === "standard") t += `${c.ts} sets of ${c.tr} reps · Estimated ${c.tr}RM: ${fmt(roundHalf(c.rm))} ${u}\n`;
    else t += `Complex scheme: ${c.cxReps.join(", ")} reps\n`;
    c.weeks.forEach((w) => {
      t += `\n${w.label} (${fmtPct(w.pct)})\n`;
      if (ex.warmOpen) t += "Warm-up: " + w.warmups.map((x) => `${x.reps} reps at ${fmt(x.load)}`).join(", ") + ` ${u}\n`;
      w.rows.forEach((row, j) => { t += `Set ${j + 1}: ${row.reps} reps at ${fmt(row.load)} ${u}\n`; });
    });
    blocks.push(t);
  });
  if (!blocks.length) return "";
  const head = clientName.trim() ? `${clientName.trim()}\n\n` : "";
  return head + blocks.join("\n\n") + "\n\n40X0 Training · Move Better";
}

function llText(ll, llUnit, clientName) {
  const { results, hasAny } = computeLL(ll);
  if (!hasAny) return "";
  const f = factor(llUnit);
  let t = (clientName.trim() ? clientName.trim() + "\n" : "") + `Strength ratios (${llUnit})\n`;
  GROUPS.forEach((g) => {
    const lifts = results.filter((x) => x.group === g.key && x.e1);
    if (!lifts.length) return;
    const lim = lifts.find((x) => x.isLimiting);
    const mother = LIFT_DEFS.find((d) => d.group === g.key && !d.motherKey).label;
    t += `\n\n${g.label.toUpperCase()}\n${lim ? "Limiting lift: " + lim.label + "\n" : ""}`;
    lifts.forEach((x) => {
      t += `\n${x.label}${x.motherKey ? "" : " (mother lift)"}${x.isLimiting ? " · LIMITING" : ""}\n`;
      t += `1RM: ${fmt(roundHalf(x.e1 * f))} ${llUnit}${x.known ? " (known)" : ""}\n`;
      if (x.motherKey) {
        t += x.ratio !== null
          ? `Ratio to ${mother}: ${fmtRatio(x.ratio)} (target ${fmtRatio(x.targetRatio)})\nGap: ${fmtGap(x.gap)}\n`
          : `Ratio: needs a ${mother} number\n`;
      }
    });
  });
  return t + "\n\n40X0 Training · Move Better";
}

// ── Email payload (all values pre-formatted) ──────────────────────
function buildEmailData(exercises, ll, llUnit, clientName) {
  const ex = exercises.map((e, i) => {
    const c = computeExercise(e);
    if (!c.e1) return null;
    const u = c.unit;
    const name = exerciseName(e);
    const rule = plateRule(name);
    return {
      title: name || `Exercise ${i + 1}`,
      unit: u,
      source: c.source === "known"
        ? "Known 1-rep max"
        : `${fmt(roundHalf(e.weightLbs * factor(u)))} ${u} for ${c.topReps} rep${c.topReps > 1 ? "s" : ""}`,
      micro: e.micro,
      e1rm: fmt(roundHalf(c.e1)),
      prescription: e.mode === "standard"
        ? (c.stdOk ? `${c.ts} sets of ${c.tr} reps` : null)
        : (c.cxReps.length ? `Complex: ${c.cxReps.join(", ")} reps` : null),
      repMaxLabel: e.mode === "standard" && c.rm ? `Estimated ${c.tr}-rep max` : null,
      repMax: c.rm ? fmt(roundHalf(c.rm)) : null,
      stepLoading: c.stepLadder
        ? `${c.ts} sets of ${c.tr} reps · ${fmt(c.stepLadder[0])} to ${fmt(c.stepLadder[c.stepLadder.length - 1])} ${u}`
        : null,
      mode: e.mode,
      showWarmups: e.warmOpen,
      plates: rule.show && c.weeks
        ? { note: rule.note, bar: `${BAR[u]} ${u}`, label: e.mode === "standard" ? "Top set" : "Heaviest", perWeek: c.weeks.map((w) => platesPerSide(w.heavy, u, e.micro)) }
        : null,
      weeks: c.weeks
        ? c.weeks.map((w) => ({
            label: w.label, tag: w.tag, pct: fmtPct(w.pct),
            rows: w.rows.map((row, j) => ({
              reps: row.reps, load: fmt(row.load),
              top: e.mode === "standard" && j === w.rows.length - 1,
            })),
            warmups: w.warmups.map((x) => ({ reps: x.reps, load: fmt(x.load) })),
          }))
        : [],
    };
  }).filter(Boolean);

  const { results, hasAny } = computeLL(ll);
  const f = factor(llUnit);
  const llGroups = hasAny
    ? GROUPS.map((g) => {
        const lifts = results.filter((x) => x.group === g.key && x.e1);
        if (!lifts.length) return null;
        const lim = lifts.find((x) => x.isLimiting);
        return {
          label: g.label,
          limiting: lim ? lim.label : null,
          rows: lifts.map((x) => ({
            label: x.label,
            mother: !x.motherKey,
            known: x.known,
            e1rm: fmt(roundHalf(x.e1 * f)),
            actual: x.motherKey ? fmtRatio(x.ratio) : "—",
            target: x.motherKey ? fmtRatio(x.targetRatio) : "—",
            gap: x.motherKey ? fmtGap(x.gap) : "—",
            status: x.motherKey ? gapStatus(x.gap) : "none",
            limiting: !!x.isLimiting,
          })),
        };
      }).filter(Boolean)
    : [];

  return {
    version: 2,
    clientName: clientName.trim() || null,
    exercises: ex,
    limiting: llGroups.length ? { unit: llUnit, groups: llGroups } : null,
  };
}

// ── Clipboard helper ──────────────────────────────────────────────
function CopyButton({ label, getText }) {
  const [state, setState] = useState("idle");
  const [fallback, setFallback] = useState("");
  const areaRef = useRef(null);
  const copy = () => {
    const text = getText();
    if (!text) return;
    const ok = () => { setState("copied"); setFallback(""); setTimeout(() => setState("idle"), 1800); };
    const fail = () => {
      setFallback(text);
      setTimeout(() => { areaRef.current?.focus(); areaRef.current?.select(); }, 0);
    };
    try { navigator.clipboard.writeText(text).then(ok, fail); } catch { fail(); }
  };
  return (
    <div>
      <div className="copyrow">
        <button className="pill" onClick={copy}>{label}</button>
        {state === "copied" && <span className="copied">Copied</span>}
      </div>
      {fallback && (
        <>
          <p className="note">Your browser blocked copying. Select the text below and copy it.</p>
          <textarea ref={areaRef} className="copyfb" readOnly value={fallback} />
        </>
      )}
    </div>
  );
}

// ── Small components ──────────────────────────────────────────────
function Pills({ options, value, onChange }) {
  return (
    <div className="row gap6">
      {options.map((o) => (
        <button key={o.value} className={"pill" + (value === o.value ? " on" : "")} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SectionHead({ num, title }) {
  return (
    <div className="shead">
      <div className="snum">{num}</div>
      <h2 className="stitle">{title}</h2>
    </div>
  );
}

function ResultCard({ sub, label, value, unit }) {
  return (
    <div className="card">
      {sub && <div className="card-sub">{sub}</div>}
      <div className="card-label">{label}</div>
      <div className="card-num">{value}<span>{unit}</span></div>
    </div>
  );
}

// ── Phase plan grid ───────────────────────────────────────────────
function PhaseGrid({ ex, c, update }) {
  const u = c.unit;
  const std = ex.mode === "standard";
  const weeks = c.weeks;
  const maxRows = Math.max(...weeks.map((w) => w.rows.length));
  const rule = plateRule(exerciseName(ex));

  const setWeek = (k, patch) => update({ weeks: ex.weeks.map((w, i) => (i === k ? { ...w, ...patch } : w)) });
  const changePct = (k, d) => setWeek(k, { pct: roundPct(Math.max(-0.3, Math.min(0.3, ex.weeks[k].pct + d * 0.005))) });
  const changeSets = (k, d) => {
    const cur = ex.weeks[k].sets ?? c.ts;
    setWeek(k, { sets: Math.max(2, Math.min(12, cur + d)) });
  };

  const cols = { gridTemplateColumns: `var(--setcol) repeat(${weeks.length}, var(--wkcol))` };
  const cells = [];

  // Header row
  cells.push(<div key="h0" className="c lc" />);
  weeks.forEach((w, k) => cells.push(
    <div key={"h" + (k + 1)} className="c hd">
      <div className="wt">{w.label}</div>
      <div className="tg">{w.tag}</div>
      <div className="ctl">
        <button className="pb" onClick={() => changePct(k, -1)} aria-label={`Lower ${w.label} percentage`}>−</button>
        <span className="pct">{fmtPct(w.pct)}</span>
        <button className="pb" onClick={() => changePct(k, 1)} aria-label={`Raise ${w.label} percentage`}>+</button>
      </div>
      <button className={"wub" + (ex.warmOpen ? " on" : "")} onClick={() => update({ warmOpen: !ex.warmOpen })} aria-expanded={ex.warmOpen}>
        {ex.warmOpen ? "▲" : "▼"} Warm-up
      </button>
    </div>
  ));

  // Warm-up rows (all weeks open and close together)
  if (ex.warmOpen) {
    WARMUP.forEach((x, j) => {
      cells.push(<div key={"wl" + j} className="c lc"><div className="sk">WU {j + 1}</div><div className="sr">{x.reps} Reps</div></div>);
      weeks.forEach((w, k) => cells.push(
        <div key={`w${j}-${k}`} className="c wu"><div className="val">{fmt(w.warmups[j].load)}<span> {u}</span></div></div>
      ));
    });
  }

  // Working sets
  for (let i = 0; i < maxRows; i++) {
    const repsLabel = std ? c.tr : c.cxReps[i];
    cells.push(<div key={"sl" + i} className="c lc"><div className="sk">Set {i + 1}</div><div className="sr bone">{repWord(repsLabel)}</div></div>);
    weeks.forEach((w, k) => {
      if (i >= w.rows.length) { cells.push(<div key={`s${i}-${k}`} />); return; }
      const top = std && i === w.rows.length - 1;
      cells.push(
        <div key={`s${i}-${k}`} className={"c" + (top ? " topc" : "")}>
          <div className="val">{fmt(w.rows[i].load)}<span> {u}</span></div>
          {top && <div className="tt">Top set</div>}
        </div>
      );
    });
  }

  // Per-week set counts (standard only)
  if (std) {
    cells.push(<div key="sets-l" className="c lc"><div className="sk">Sets</div></div>);
    weeks.forEach((w, k) => cells.push(
      <div key={"sets" + k} className="c sets">
        <div className="ctl tight">
          <button className="pb" onClick={() => changeSets(k, -1)} aria-label={`Remove a set from ${w.label}`}>−</button>
          <span className="setn">{w.setsCount}</span>
          <button className="pb" onClick={() => changeSets(k, 1)} aria-label={`Add a set to ${w.label}`}>+</button>
        </div>
      </div>
    ));
  }

  // Plates per side
  if (rule.show) {
    cells.push(<div key="pl-l" className="c lc"><div className="sk">Plates</div><div className="sr">{std ? "Top set" : "Heaviest"}</div></div>);
    weeks.forEach((w, k) => cells.push(
      <div key={"pl" + k} className="c plc"><div className="pl">{platesPerSide(w.heavy, u, ex.micro)}</div></div>
    ));
  }

  return (
    <>
      <div className={"pgwrap " + (weeks.length >= 4 ? "swipe" : "compact")}>
        <div className="pg" style={cols}>{cells}</div>
      </div>
      {rule.show && (
        <p className="note">
          Plates are per side on a {BAR[u]} {u} bar{rule.note ? ` (${rule.note})` : ""}.
        </p>
      )}
      <p className="note">Warm-up sets are intended for A-Series lifts only.</p>
    </>
  );
}

// ── Complex rep slots with auto-advance ───────────────────────────
function ComplexSlots({ ex, update }) {
  const timer = useRef(null);
  const slotId = (i) => `${ex.id}-slot-${i}`;
  const advance = (i) => {
    const next = document.getElementById(slotId(i + 1));
    if (next) next.focus();
    else document.getElementById(slotId(i))?.blur();
  };
  const onSlot = (i, raw) => {
    clearTimeout(timer.current);
    const v = cleanNum(raw, false).slice(0, 2);
    const slots = ex.complexSlots.map((s, j) => (j === i ? v : s));
    update({ complexSlots: slots });
    // 2 to 9 jump right away, two digits jump, a lone 1 waits briefly for 10 to 15
    if (v.length === 2 || (v.length === 1 && v !== "1")) setTimeout(() => advance(i), 0);
    else if (v === "1") {
      timer.current = setTimeout(() => {
        const el = document.getElementById(slotId(i));
        if (el && el.value === "1" && document.activeElement === el) advance(i);
      }, 700);
    }
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <>
      <div className="lab">Reps per set</div>
      <div className="slots">
        {ex.complexSlots.map((v, i) => (
          <div key={i}>
            <div className="slotlab">S{i + 1}</div>
            <input
              id={slotId(i)} className="field slot" inputMode="numeric" maxLength={2}
              placeholder="—" value={v} autoComplete="off" aria-label={`Reps for set ${i + 1}`}
              onFocus={(e) => e.target.select()}
              onChange={(e) => onSlot(i, e.target.value)}
            />
          </div>
        ))}
      </div>
      <div className="row gap8 mb6">
        <button
          className="pill" disabled={ex.complexSlots.length >= MAX_SLOTS}
          onClick={() => update({ complexSlots: [...ex.complexSlots, ""] })}
        >+ Add a set</button>
        {ex.complexSlots.length > MIN_SLOTS && (
          <button className="pill" onClick={() => update({ complexSlots: ex.complexSlots.slice(0, -1) })}>− Remove a set</button>
        )}
      </div>
      <p className="note mb12">1 to 15 reps per set. Leave unused slots blank.</p>
    </>
  );
}

// ── One exercise: Steps 01 to 03 ──────────────────────────────────
function ExercisePanel({ ex, onChange }) {
  const update = (patch) => onChange({ ...ex, ...patch });
  const c = computeExercise(ex);
  const u = ex.unit;
  const f = factor(u);
  const name = exerciseName(ex);
  const usingKnown = ex.knownLbs > 0;

  const setWeight = (raw) => {
    const v = cleanNum(raw, true);
    const n = parseFloat(v);
    update({ weight: v, weightLbs: n > 0 ? n / f : null });
  };
  const setKnown = (raw) => {
    const v = cleanNum(raw, true);
    const n = parseFloat(v);
    update({ known: v, knownLbs: n > 0 ? n / f : null });
  };
  const setUnit = (nu) => {
    if (nu === u) return;
    const nf = factor(nu);
    update({
      unit: nu,
      weight: ex.weightLbs > 0 ? fmt(roundHalf(ex.weightLbs * nf)) : ex.weight,
      known:  ex.knownLbs  > 0 ? fmt(roundHalf(ex.knownLbs  * nf)) : ex.known,
    });
  };
  const setTargetSets = (raw) => {
    const v = cleanNum(raw, false).slice(0, 2);
    // A new step 02 set count resets every week to that number
    update({ targetSets: v, weeks: ex.weeks.map((w) => ({ ...w, sets: null })) });
  };
  const pickExercise = (p) => update({ exercise: ex.exercise === p && !ex.customEx.trim() ? "" : p, customEx: "" });
  const addWeek = () => {
    if (ex.weeks.length < 4) update({ weeks: [...ex.weeks, { pct: WEEK_DEFAULTS[3].pct, sets: null }] });
    else update({ weeks: ex.weeks.slice(0, 3) });
  };

  const e1Sub = c.source === "known"
    ? "Entered directly"
    : c.source === "top" ? `${fmt(roundHalf(ex.weightLbs * f))}${u} for ${c.topReps} rep${c.topReps > 1 ? "s" : ""}` : "";

  return (
    <div className="panel">
      {/* STEP 01 */}
      <section className="section">
        <SectionHead num="01" title="Find your estimated 1-rep max" />

        <div className="lab">Exercise <small>(optional, label only)</small></div>
        <div className="grp">Upper body</div>
        <div className="exgrid">
          {UPPER.map((p) => (
            <button key={p} className={"pill" + (ex.exercise === p && !ex.customEx.trim() ? " on" : "")} onClick={() => pickExercise(p)}>{p}</button>
          ))}
        </div>
        <div className="grp">Lower body</div>
        <div className="exgrid">
          {LOWER.map((p) => (
            <button key={p} className={"pill" + (ex.exercise === p && !ex.customEx.trim() ? " on" : "")} onClick={() => pickExercise(p)}>{p}</button>
          ))}
        </div>
        <label className="grp" htmlFor={`${ex.id}-custom`}>Custom</label>
        <input
          id={`${ex.id}-custom`} className="field txt mb24" placeholder="Type an exercise name" autoComplete="off"
          value={ex.customEx} onChange={(e) => update({ customEx: e.target.value })}
        />

        <div className={"fadeable" + (usingKnown ? " faded" : "")}>
          <div className="lab">Top set</div>
          <div className="row gap12 mb10">
            <input
              className="field big-in" inputMode="decimal" placeholder="135" aria-label="Top set weight" autoComplete="off"
              value={ex.weight} onChange={(e) => setWeight(e.target.value)}
            />
            <span className="unit-l">{u} for</span>
            <input
              className="field big-in w84" inputMode="numeric" maxLength={2} placeholder="5" aria-label="Top set reps" autoComplete="off"
              value={ex.topReps} onChange={(e) => update({ topReps: cleanNum(e.target.value, false).slice(0, 2) })}
            />
            <span className="unit-l">reps</span>
          </div>
          <button className="pill sm" onClick={() => update({ weight: "", weightLbs: null, topReps: "" })}>Clear</button>
        </div>

        <div className="divider"><span>Or input it below</span></div>
        <label className="lab" htmlFor={`${ex.id}-known`}>Known 1-rep max</label>
        <div className="row gap12">
          <input
            id={`${ex.id}-known`} className="field big-in w150" inputMode="decimal" placeholder="185" autoComplete="off"
            value={ex.known} onChange={(e) => setKnown(e.target.value)}
          />
          <span className="unit-l">{u}</span>
          {ex.known && <button className="pill sm" onClick={() => update({ known: "", knownLbs: null })}>Clear</button>}
        </div>
        {usingKnown && <p className="note">Using your known 1-rep max. Clear it to go back to the top set.</p>}

        {c.e1 && (
          <ResultCard
            sub={(name ? name + " · " : "") + e1Sub}
            label="Estimated 1-rep max" value={fmt(roundHalf(c.e1))} unit={u}
          />
        )}
      </section>

      {/* STEP 02 */}
      {c.e1 && (
        <section className="section">
          <SectionHead num="02" title="New mesocycle sets and reps" />
          <div className="lab">Rep scheme type</div>
          <div className="mb18">
            <Pills
              value={ex.mode} onChange={(v) => update({ mode: v })}
              options={[{ value:"standard", label:"Standard Reps" }, { value:"complex", label:"Complex Reps" }]}
            />
          </div>
          <p className="help">
            Using your {fmt(roundHalf(c.e1))}{u} ES1RM. {ex.mode === "standard" ? "Enter your target sets and reps." : "Enter your rep scheme."}
          </p>

          {ex.mode === "standard" ? (
            <>
              <div className="lab">Target sets and reps</div>
              <div className="row gap12 mb10">
                <input
                  className="field big-in w96" inputMode="numeric" maxLength={2} placeholder="4" aria-label="Target sets" autoComplete="off"
                  value={ex.targetSets} onChange={(e) => setTargetSets(e.target.value)}
                />
                <span className="unit-l">sets of</span>
                <input
                  className="field big-in w96" inputMode="numeric" maxLength={2} placeholder="12" aria-label="Target reps" autoComplete="off"
                  value={ex.targetReps} onChange={(e) => update({ targetReps: cleanNum(e.target.value, false).slice(0, 2) })}
                />
                <span className="unit-l">reps</span>
              </div>
              <button className="pill sm" onClick={() => update({ targetSets: "", targetReps: "", weeks: ex.weeks.map((w) => ({ ...w, sets: null })) })}>Clear</button>

              {c.rm && (
                <>
                  <ResultCard label={`Estimated ${c.tr}-rep max`} value={fmt(roundHalf(c.rm))} unit={u} />
                  <div className="drop">
                    <button className="drop-h" onClick={() => update({ stepOpen: !ex.stepOpen })} aria-expanded={ex.stepOpen}>
                      <div>
                        <div className="drop-t">General Step Loading</div>
                        <div className="drop-s">
                          {c.ts} sets of {c.tr} reps · {fmt(c.stepLadder[0])} to {fmt(c.stepLadder[c.stepLadder.length - 1])} {u} · spread {Math.round((STEP_PCT[c.ts] ?? 0.1) * 100)}%
                        </div>
                      </div>
                      <svg className={"chev" + (ex.stepOpen ? " up" : "")} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                    </button>
                    {ex.stepOpen && (
                      <div className="lad">
                        {c.stepLadder.map((w, i) => {
                          const top = i === c.stepLadder.length - 1;
                          return (
                            <div key={i} className={"lrow" + (top ? " top" : "")}>
                              <span className="k">Set {i + 1}</span>
                              <span className="k w70">{repWord(c.tr)}</span>
                              <span className="w">{fmt(w)}<span>{u}</span></span>
                              {top ? <span className="t">Top set</span> : i === 0 ? <span className="t">Start</span> : null}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <ComplexSlots ex={ex} update={update} />
              <button className="pill sm" onClick={() => update({ complexSlots: ex.complexSlots.map(() => "") })}>Clear</button>
            </>
          )}
        </section>
      )}

      {/* STEP 03 */}
      {c.weeks && (
        <section className="section">
          <SectionHead num="03" title={`${ex.weeks.length} week phase plan`} />
          <p className="help">
            {ex.mode === "standard"
              ? `Each week adjusts from your ES${c.tr}RM of ${fmt(roundHalf(c.rm))}${u}.`
              : "Each set adjusts from its own estimated rep max."}
          </p>
          <div className="settings">
            <div>
              <div className="lab">Unit</div>
              <Pills value={u} onChange={setUnit} options={[{ value:"lbs", label:"lbs" }, { value:"kg", label:"kg" }]} />
            </div>
            <div>
              <div className="lab">Micro plates</div>
              <Pills value={ex.micro ? "yes" : "no"} onChange={(v) => update({ micro: v === "yes" })} options={[{ value:"yes", label:"Yes" }, { value:"no", label:"No" }]} />
            </div>
            <button className="pill addw" onClick={addWeek}>{ex.weeks.length < 4 ? "+ Add a week" : "− Remove week 4"}</button>
          </div>
          <PhaseGrid ex={ex} c={c} update={update} />
        </section>
      )}
    </div>
  );
}

// ── Collapsed exercise summary ────────────────────────────────────
function ExerciseBar({ ex, index, onExpand, onRemove }) {
  const c = computeExercise(ex);
  const name = exerciseName(ex) || "Exercise";
  let meta = ex.mode === "standard"
    ? (c.stdOk ? `${c.ts} sets of ${c.tr} reps` : "")
    : (c.cxReps.length ? `Complex: ${c.cxReps.join(", ")}` : "");
  if (c.e1) meta += (meta ? " · " : "") + `ES1RM ${fmt(roundHalf(c.e1))} ${c.unit}`;
  return (
    <div className="exbar">
      <div className="exbar-num">{index + 1}</div>
      <div className="exbar-txt">
        <div className="exbar-name">{name}</div>
        {meta && <div className="exbar-meta">{meta}</div>}
      </div>
      <button className="pill sm" onClick={onExpand}>Edit</button>
      <button className="pill sm" onClick={onRemove} aria-label={`Remove ${name}`}>✕</button>
    </div>
  );
}

// ── Limiting Lift tab ─────────────────────────────────────────────
function LimitingLift({ ll, setLL, llUnit, setLlUnit, clientName }) {
  const f = factor(llUnit);
  const { results, hasAny } = computeLL(ll);
  const statusClass = { good:"good", warn:"warn", bad:"bad", none:"dim" };

  // Typing in weight or reps makes that lift use them; typing a known 1RM switches it to the known max
  const setField = (key, field, raw) => {
    const next = { ...ll[key] };
    if (field === "w") { next.w = cleanNum(raw, true); const n = parseFloat(next.w); next.wLbs = n > 0 ? n / f : null; next.src = "calc"; }
    if (field === "r") { next.r = cleanNum(raw, false).slice(0, 2); next.src = "calc"; }
    if (field === "k") { next.k = cleanNum(raw, true); const n = parseFloat(next.k); next.kLbs = n > 0 ? n / f : null; next.src = "known"; }
    setLL({ ...ll, [key]: next });
  };
  const changeUnit = (nu) => {
    if (nu === llUnit) return;
    const nf = factor(nu);
    const next = {};
    LIFT_DEFS.forEach((d) => {
      const x = ll[d.key];
      next[d.key] = {
        ...x,
        w: x.wLbs > 0 ? fmt(roundHalf(x.wLbs * nf)) : x.w,
        k: x.kLbs > 0 ? fmt(roundHalf(x.kLbs * nf)) : x.k,
      };
    });
    setLL(next);
    setLlUnit(nu);
  };

  return (
    <>
      <section className="section">
        <SectionHead num="01" title="Enter lift data" />
        <div className="lab">Unit</div>
        <div className="mb18">
          <Pills value={llUnit} onChange={changeUnit} options={[{ value:"lbs", label:"lbs" }, { value:"kg", label:"kg" }]} />
        </div>
        <p className="help">
          Enter weight and reps for each lift, or a known 1-rep max. Each lift uses one or the other. The limiting lift in each group is the one furthest below its target ratio to the mother lift.
        </p>
        {GROUPS.map((g) => (
          <div key={g.key} className="llgrp">
            <div className="llgh"><span className="grp-t">{g.label}</span></div>
            <div className="lli colh">
              <span>Lift</span><span className="ctr">{llUnit}</span><span className="ctr">Reps</span><span className="ctr">Known 1RM</span>
            </div>
            {LIFT_DEFS.filter((d) => d.group === g.key).map((d) => {
              const x = ll[d.key];
              const calcDim = x.src === "known" && !!x.k;
              const knownDim = x.src === "calc" && !!(x.w || x.r);
              return (
                <div key={d.key} className="lli">
                  <div className="llname">{d.label}{!d.motherKey && <span className="badge">Mother lift</span>}</div>
                  <input
                    className={"field llin" + (calcDim ? " dimmed" : "")} inputMode="decimal" placeholder="—" autoComplete="off"
                    aria-label={`${d.label} weight`} value={x.w} onChange={(e) => setField(d.key, "w", e.target.value)}
                  />
                  <input
                    className={"field llin" + (calcDim ? " dimmed" : "")} inputMode="numeric" maxLength={2} placeholder="—" autoComplete="off"
                    aria-label={`${d.label} reps`} value={x.r} onChange={(e) => setField(d.key, "r", e.target.value)}
                  />
                  <input
                    className={"field llin kn" + (knownDim ? " dimmed" : "")} inputMode="decimal" placeholder="—" autoComplete="off"
                    aria-label={`${d.label} known 1-rep max`} value={x.k} onChange={(e) => setField(d.key, "k", e.target.value)}
                  />
                </div>
              );
            })}
          </div>
        ))}
        <button className="pill sm" onClick={() => setLL(makeLL())}>Clear</button>
        {!hasAny && <p className="note">Enter Bench Press or Squat plus at least one other lift in that group to see the analysis.</p>}
      </section>

      {hasAny && (
        <section className="section">
          <SectionHead num="02" title="Ratio analysis" />
          {GROUPS.map((g) => {
            const lifts = results.filter((x) => x.group === g.key && x.e1);
            if (!lifts.length) return null;
            const lim = lifts.find((x) => x.isLimiting);
            return (
              <div key={g.key} className="llgrp">
                <div className="llgh">
                  <span className="grp-t">{g.label}</span>
                  {lim && <span className="badge red">Limiting: {lim.label}</span>}
                </div>
                <div className="llres colh">
                  <span>Lift</span><span>1RM {llUnit}</span><span>Actual</span><span>Target</span><span>Gap</span>
                </div>
                {lifts.map((x) => (
                  <div key={x.key} className={"llres" + (x.isLimiting ? " lim" : "")}>
                    <div className="llname sm">{x.label}{!x.motherKey && <span className="badge">Mother</span>}</div>
                    <div>
                      <div className="v">{fmt(roundHalf(x.e1 * f))}</div>
                      {x.known && <div className="calc">Known</div>}
                    </div>
                    <div className="v">{x.motherKey ? fmtRatio(x.ratio) : "—"}</div>
                    <div className="v dim">{x.motherKey ? fmtRatio(x.targetRatio) : "—"}</div>
                    <div className={"v " + (x.motherKey ? statusClass[gapStatus(x.gap)] : "dim")}>{x.motherKey ? fmtGap(x.gap) : "—"}</div>
                  </div>
                ))}
              </div>
            );
          })}
          <div className="legend">
            <span><i className="sw good-bg" />At or above target</span>
            <span><i className="sw warn-bg" />Within 5% below</span>
            <span><i className="sw bad-bg" />More than 5% below</span>
          </div>
          <CopyButton label="Copy results as text" getText={() => llText(ll, llUnit, clientName)} />
        </section>
      )}
    </>
  );
}

// ── Email modal ───────────────────────────────────────────────────
function EmailModal({ onClose, emailData }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle");
  const valid = /\S+@\S+\.\S+/.test(email);

  const send = async () => {
    if (!valid) { setStatus("invalid"); return; }
    setStatus("sending");
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: email.trim(), data: emailData }),
      });
      setStatus(res.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  };

  const parts = [];
  if (emailData.exercises.length) parts.push(`${emailData.exercises.length} exercise plan${emailData.exercises.length > 1 ? "s" : ""}`);
  if (emailData.limiting) parts.push("strength ratios");

  return (
    <div className="ov" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Email results" onClick={(e) => e.stopPropagation()}>
        <button className="modal-x" onClick={onClose} aria-label="Close">✕</button>
        {status === "sent" ? (
          <>
            <div className="modal-t">Results sent</div>
            <p className="modal-d">Check the inbox for {email.trim()}.</p>
            <button className="pill on wide" onClick={onClose}>Done</button>
          </>
        ) : (
          <>
            <div className="modal-t">Email results</div>
            <p className="modal-d">Sends {parts.join(" and ")}{emailData.clientName ? ` for ${emailData.clientName}` : ""}.</p>
            <input
              type="email" className="field txt full" placeholder="name@email.com" autoFocus
              value={email} onChange={(e) => { setEmail(e.target.value); if (status === "invalid" || status === "error") setStatus("idle"); }}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            />
            {status === "invalid" && <p className="err">Enter a full email address, like name@email.com.</p>}
            {status === "error" && <p className="err">That didn't send. Check your connection and try again.</p>}
            <button className="pill on wide mt12" onClick={send} disabled={status === "sending"}>
              {status === "sending" ? "Sending…" : "Send results"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// Main App
// ═════════════════════════════════════════════════════════════════
export default function App() {
  const [saved] = useState(loadSaved);
  const [activeTab,  setActiveTab]  = useState(saved?.activeTab ?? "planner");
  const [clientName, setClientName] = useState(saved?.clientName ?? "");
  const [exercises,  setExercises]  = useState(saved?.exercises ?? [makeExercise()]);
  const [ll,         setLL]         = useState(saved?.ll ?? makeLL());
  const [llUnit,     setLlUnit]     = useState(saved?.llUnit ?? "lbs");
  const [showModal,  setShowModal]  = useState(false);

  // Remember the last plan on this device
  useEffect(() => {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify({ activeTab, clientName, exercises, ll, llUnit }));
    } catch { /* storage unavailable */ }
  }, [activeTab, clientName, exercises, ll, llUnit]);

  // Report page height to a parent page (for iframe embeds that listen)
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return undefined;
    const send = () => { try { window.parent.postMessage({ iframeHeight: document.body.scrollHeight }, "*"); } catch { /* ignore */ } };
    const ro = new ResizeObserver(send);
    ro.observe(document.body);
    send();
    return () => ro.disconnect();
  }, []);

  const updateExercise = (idx, updated) => setExercises((prev) => prev.map((ex, i) => (i === idx ? updated : ex)));
  const setCollapsed = (idx, collapsed) => setExercises((prev) => prev.map((ex, i) => (i === idx ? { ...ex, collapsed } : ex)));
  const expandExercise = (idx) => setExercises((prev) => prev.map((ex, i) => ({ ...ex, collapsed: i !== idx })));
  const removeExercise = (idx) => setExercises((prev) => {
    const next = prev.filter((_, i) => i !== idx);
    if (!next.length) return [makeExercise()];
    if (next.every((ex) => ex.collapsed)) next[next.length - 1] = { ...next[next.length - 1], collapsed: false };
    return next;
  });
  const addExercise = (fromIdx, keep) => {
    const cur = exercises[fromIdx];
    const base = { unit: cur.unit, micro: cur.micro };
    const extra = keep
      ? {
          mode: cur.mode, targetSets: cur.targetSets, targetReps: cur.targetReps,
          complexSlots: [...cur.complexSlots], weeks: cur.weeks.map((w) => ({ ...w })), warmOpen: cur.warmOpen,
        }
      : {};
    setExercises((prev) => [...prev.map((ex) => ({ ...ex, collapsed: true })), makeExercise({ ...base, ...extra })]);
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 0);
  };

  const anyPlan = exercises.some((ex) => computeExercise(ex).e1);
  const llAny = computeLL(ll).hasAny;
  const showMail = anyPlan || llAny;

  const resetAll = () => {
    setExercises([makeExercise()]);
    setLL(makeLL());
    setClientName("");
  };

  return (
    <div className="app">
      <style>{CSS}</style>
      <div className="wrap">
        <header>
          <div className="lab brand">40X0 Training</div>
          <h1 className="title">
            {activeTab === "planner" ? <>1RM &amp; Load<br />Planner</> : <>Limiting Lift<br />Calculator</>}
          </h1>
          <div className="lab tagline">
            {activeTab === "planner" ? "ES1RM · Target rep max · Step load · Phase plan" : "Upper and lower strength ratio analysis"}
          </div>
        </header>

        <nav className="tabs" aria-label="Calculator">
          <button className={"pill" + (activeTab === "planner" ? " on" : "")} onClick={() => setActiveTab("planner")}>1RM &amp; Load Planner</button>
          <button className={"pill" + (activeTab === "limiting" ? " on" : "")} onClick={() => setActiveTab("limiting")}>Limiting Lift Calculator</button>
        </nav>

        <label className="lab" htmlFor="client-name">Client name <small>(optional)</small></label>
        <input
          id="client-name" className="field txt" placeholder="Bryan" autoComplete="off"
          value={clientName} onChange={(e) => setClientName(e.target.value)}
        />

        {activeTab === "planner" && (
          <>
            {exercises.some((ex) => ex.collapsed) && (
              <div className="exbars">
                {exercises.map((ex, idx) => ex.collapsed && (
                  <ExerciseBar key={ex.id} ex={ex} index={idx} onExpand={() => expandExercise(idx)} onRemove={() => removeExercise(idx)} />
                ))}
              </div>
            )}

            {exercises.map((ex, idx) => {
              if (ex.collapsed) return null;
              const c = computeExercise(ex);
              return (
                <div key={ex.id}>
                  {exercises.length > 1 && (
                    <div className="exhead">
                      <span className="lab m0">Exercise {idx + 1}</span>
                      <div className="row gap8">
                        <button className="pill sm" onClick={() => setCollapsed(idx, true)}>Collapse</button>
                        <button className="pill sm" onClick={() => removeExercise(idx)}>Remove</button>
                      </div>
                    </div>
                  )}
                  <ExercisePanel ex={ex} onChange={(u) => updateExercise(idx, u)} />

                  {c.weeks && (
                    <>
                      <CopyButton label="Copy plan as text" getText={() => planText(exercises, clientName)} />
                      {exercises.length < MAX_EXERCISES && (
                        <div className="addex">
                          <div className="lab">Add another exercise</div>
                          <div className="addex-row">
                            <button className="addex-btn" onClick={() => addExercise(idx, true)}>
                              <span className="addex-t">Keep prescription</span>
                              <span className="addex-s">Same sets, reps and weeks. New weight.</span>
                            </button>
                            <button className="addex-btn" onClick={() => addExercise(idx, false)}>
                              <span className="addex-t">New prescription</span>
                              <span className="addex-s">Start fresh from step 01.</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </>
        )}

        {activeTab === "limiting" && (
          <LimitingLift ll={ll} setLL={setLL} llUnit={llUnit} setLlUnit={setLlUnit} clientName={clientName} />
        )}

        <div className="foot">40X0 Training · Move Better</div>
        <p className="note ctr">
          Your last plan is saved on this device. <button className="linkbtn" onClick={resetAll}>Start over</button>
        </p>
      </div>

      {showMail && (
        <button className="mail" onClick={() => setShowModal(true)} aria-label="Email results">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" />
          </svg>
        </button>
      )}

      {showModal && (
        <EmailModal onClose={() => setShowModal(false)} emailData={buildEmailData(exercises, ll, llUnit, clientName)} />
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// Styles: grey and bone
// ═════════════════════════════════════════════════════════════════
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');
:root{
  --bg:#3B3A38; --surface:#464542; --surface-2:#4F4D4A; --line:#5A5855; --row:#42413E;
  --bone:#E8E1D3; --bone-dim:#C9C2B4; --muted:#A39C8F; --faint:#7E786D; --ink:#2E2D2B;
  --good:#9CC98A; --warn:#E3B062; --bad:#E8877A;
  --display:'Bebas Neue',Impact,'Arial Narrow',sans-serif;
  --body:'Barlow','Helvetica Neue',Arial,sans-serif;
  color-scheme:dark;
}
html,body{background:var(--bg)!important;margin:0}
#root{width:auto!important;max-width:none!important;text-align:left!important;border:0!important;display:block!important;min-height:100vh}
.app *,.app *::before,.app *::after{box-sizing:border-box}
.app{background:var(--bg);color:var(--bone);font-family:var(--body);font-size:15px;line-height:1.45;min-height:100vh;letter-spacing:normal}
.app h1,.app h2{margin:0;font-weight:400;color:var(--bone)}
.app button{font-family:var(--body);cursor:pointer}
.app button:disabled{opacity:.45;cursor:default}
.app button:focus-visible,.app input:focus-visible{outline:2px solid var(--bone);outline-offset:2px}
.app input{font-family:var(--body);margin:0}
.wrap{max-width:720px;margin:0 auto;padding:28px 20px 130px}
.lab{display:block;font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:var(--muted);font-weight:600;margin-bottom:8px}
.lab small{text-transform:none;letter-spacing:.5px;color:var(--faint);font-weight:400;font-size:11px}
.m0{margin:0}
.brand{letter-spacing:5px}
.tagline{color:var(--faint);margin:0}
.title{font-family:var(--display)!important;font-size:clamp(52px,13vw,72px)!important;line-height:.9!important;letter-spacing:2px!important;margin:0 0 12px!important}
.grp{display:block;font-size:12px;letter-spacing:1.5px;color:var(--muted);margin-bottom:6px;text-transform:uppercase}
.help{font-size:14px;color:var(--muted);font-style:italic;margin:0 0 18px}
.note{font-size:12px;color:var(--faint);font-style:italic;margin:10px 0 0}
.ctr{text-align:center}
.row{display:flex;flex-wrap:wrap;align-items:center}
.gap6{gap:6px}.gap8{gap:8px}.gap12{gap:12px}
.mb6{margin-bottom:6px}.mb10{margin-bottom:10px}.mb12{margin-bottom:12px}.mb18{margin-bottom:18px}.mb24{margin-bottom:24px}.mt12{margin-top:12px}
.pill{background:var(--surface);border:1px solid var(--line);color:var(--bone-dim);border-radius:10px;padding:9px 16px;font-size:13px;font-weight:500;transition:background .15s,color .15s}
.pill.on{background:var(--bone);color:var(--ink);border-color:var(--bone)}
.pill.sm{padding:6px 16px;font-size:11px;letter-spacing:2px;font-weight:600;text-transform:uppercase}
.pill.wide{width:100%;padding:13px;font-size:15px;font-weight:600}
.field{background:var(--surface);border:1px solid var(--line);border-radius:12px;color:var(--bone)}
.field::placeholder{color:var(--faint);opacity:1}
.txt{font-size:15px;padding:12px 14px;width:100%;max-width:340px;display:block}
.txt.full{max-width:none}
.big-in{font-family:var(--display)!important;font-size:38px;letter-spacing:1.5px;padding:6px 18px;width:120px}
.w84{width:84px}.w96{width:96px}.w150{width:150px}.w70{width:70px!important}
.unit-l{font-family:var(--display);font-size:20px;color:var(--faint);letter-spacing:1.5px}
.fadeable{transition:opacity .2s}
.fadeable.faded{opacity:.4}
.tabs{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:26px 0}
.tabs .pill{border-radius:14px;padding:14px 8px;font-size:13px;letter-spacing:1px;font-weight:600;text-transform:uppercase}
.section{border-top:1px solid var(--line);padding-top:26px;margin-top:30px}
.shead{display:flex;align-items:flex-start;gap:16px;margin-bottom:22px}
.snum{font-family:var(--display);font-size:64px;line-height:.82;letter-spacing:1px}
.stitle{font-family:var(--display)!important;font-size:24px!important;letter-spacing:1.5px!important;padding-top:10px;text-wrap:balance;line-height:1.1!important}
.exgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:6px;margin-bottom:14px}
.exgrid .pill{padding:10px 6px;text-align:center}
.divider{display:flex;align-items:center;gap:12px;margin:22px 0 14px}
.divider::before,.divider::after{content:"";flex:1;height:1px;background:var(--line)}
.divider span{font-size:11px;letter-spacing:2.5px;color:var(--muted);font-weight:600;text-transform:uppercase}
.card{background:var(--surface);border:1px solid var(--line);border-radius:16px;text-align:center;padding:26px 18px 24px;margin-top:20px}
.card-sub{font-size:18px;color:var(--bone-dim);margin-bottom:6px}
.card-label{font-family:var(--display);font-size:22px;letter-spacing:5px;color:var(--muted);margin-bottom:6px}
.card-num{font-family:var(--display);font-size:clamp(64px,16vw,88px);line-height:1;letter-spacing:2px;font-variant-numeric:tabular-nums}
.card-num span{font-size:26px;color:var(--faint);margin-left:6px}
.drop{background:var(--surface);border:1px solid var(--line);border-radius:16px;overflow:hidden;margin-top:18px}
.drop-h{display:flex;align-items:center;gap:12px;padding:16px 18px;width:100%;background:none;border:0;color:var(--bone);text-align:left}
.drop-t{font-family:var(--display);font-size:22px;letter-spacing:1.5px}
.drop-s{font-size:13px;color:var(--muted)}
.chev{margin-left:auto;flex-shrink:0;transition:transform .2s}
.chev.up{transform:rotate(180deg)}
.lad{border-top:1px solid var(--line)}
.lrow{display:flex;align-items:center;gap:12px;padding:13px 18px;border-bottom:1px solid #4A4946;background:var(--row)}
.lrow:last-child{border-bottom:0}
.lrow .k{font-size:11px;letter-spacing:2px;color:var(--faint);font-weight:600;width:56px;flex-shrink:0;text-transform:uppercase}
.lrow .w{font-family:var(--display);font-size:26px;letter-spacing:1px;font-variant-numeric:tabular-nums}
.lrow .w span{font-size:13px;color:var(--faint);margin-left:3px}
.lrow .t{margin-left:auto;font-size:11px;letter-spacing:1.5px;font-weight:600;padding:4px 10px;border-radius:6px;background:var(--line);color:var(--bone-dim);text-transform:uppercase}
.lrow.top{background:var(--bone)}
.lrow.top .k{color:#5A554C}.lrow.top .w{color:var(--ink)}.lrow.top .w span{color:#6A6458}
.lrow.top .t{background:var(--ink);color:var(--bone)}
.slots{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:12px}
.slot{width:100%;height:54px;text-align:center;font-family:var(--display)!important;font-size:28px;letter-spacing:1px}
.slotlab{text-align:center;font-size:10px;letter-spacing:2px;color:var(--faint);font-weight:600;margin-bottom:4px}
.settings{display:flex;flex-wrap:wrap;gap:22px;align-items:flex-end;padding-bottom:18px;margin-bottom:18px;border-bottom:1px solid var(--line)}
.settings .addw{margin-left:auto}
.pgwrap{width:100%}
.pg{--setcol:64px;--wkcol:minmax(0,1fr);display:grid;gap:6px}
.pg .c{background:var(--row);border-radius:8px;padding:10px 4px;text-align:center;min-height:52px;display:flex;flex-direction:column;justify-content:center;min-width:0}
.pg .lc{background:var(--bg)}
.pg .hd{background:var(--surface);padding:12px 4px}
.pg .wt{font-family:var(--display);font-size:22px;letter-spacing:1.5px}
.pg .tg{font-size:10px;letter-spacing:2px;color:var(--faint);font-weight:600;text-transform:uppercase}
.pg .ctl{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:8px}
.pg .ctl.tight{margin:0}
.pg .pb{background:var(--surface-2);border:1px solid var(--line);color:var(--bone);border-radius:8px;width:30px;height:30px;font-size:16px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;padding:0}
.pg .pct{font-size:13px;font-weight:600;min-width:40px;font-variant-numeric:tabular-nums}
.pg .setn{font-family:var(--display);font-size:22px;min-width:22px}
.pg .wub{background:transparent;border:1px solid var(--line);color:var(--bone-dim);border-radius:8px;padding:6px 2px;font-size:10px;letter-spacing:1px;font-weight:600;width:100%;margin-top:8px;text-transform:uppercase}
.pg .wub.on{background:var(--surface-2)}
.pg .val{font-family:var(--display);font-size:24px;letter-spacing:1px;font-variant-numeric:tabular-nums}
.pg .val span{font-size:12px;color:var(--faint)}
.pg .sk{font-size:11px;letter-spacing:2px;color:var(--faint);font-weight:600;text-transform:uppercase;white-space:nowrap}
.pg .sr{font-size:11px;color:var(--faint);text-transform:uppercase;letter-spacing:1px;font-weight:600;white-space:nowrap}
.pg .sr.bone{color:var(--bone-dim)}
.pg .topc{background:var(--bone)}
.pg .topc .val{color:var(--ink)}.pg .topc .val span{color:#6A6458}
.pg .tt{font-size:10px;letter-spacing:1.5px;font-weight:600;color:#5A554C;text-transform:uppercase}
.pg .wu{background:rgba(232,225,211,.55);border:1px dashed rgba(232,225,211,.7)}
.pg .wu .val{color:var(--ink)}.pg .wu .val span{color:#4A4844}
.pg .sets{background:var(--surface)}
.pg .plc{background:transparent;border:1px solid var(--line)}
.pg .pl{font-size:11px;line-height:1.35;color:var(--bone-dim);font-variant-numeric:tabular-nums}
.copyrow{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:18px}
.copied{font-size:13px;color:var(--good)}
.copyfb{width:100%;min-height:180px;margin-top:10px;background:var(--surface);color:var(--bone);border:1px solid var(--line);border-radius:12px;padding:12px;font:13px/1.5 var(--body)}
.addex{margin-top:28px;padding-top:22px;border-top:1px solid var(--line)}
.addex-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.addex-btn{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:14px;text-align:left;color:var(--bone);display:flex;flex-direction:column;gap:4px}
.addex-t{font-weight:600;font-size:14px}
.addex-s{font-size:12px;color:var(--muted)}
.exbars{display:flex;flex-direction:column;gap:8px;margin-top:24px}
.exbar{display:flex;align-items:center;gap:10px;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:12px 14px}
.exbar-num{font-family:var(--display);font-size:28px;line-height:1;width:24px;color:var(--muted)}
.exbar-txt{flex:1;min-width:0}
.exbar-name{font-weight:600}
.exbar-meta{font-size:12px;color:var(--muted)}
.exhead{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-top:26px}
.llgrp{background:var(--surface);border:1px solid var(--line);border-radius:16px;overflow:hidden;margin-bottom:16px}
.llgh{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--line)}
.grp-t{font-family:var(--display);font-size:20px;letter-spacing:1.5px}
.badge{font-size:10px;letter-spacing:1.5px;font-weight:700;text-transform:uppercase;padding:3px 8px;border-radius:6px;background:var(--line);color:var(--bone-dim)}
.badge.red{background:#5C3F39;color:#F2B3A8}
.lli{display:grid;grid-template-columns:minmax(0,1fr) 88px 58px 88px;gap:8px;align-items:center;padding:10px 18px;border-bottom:1px solid #4A4946}
.lli:last-child{border-bottom:0}
.colh{font-size:10px;letter-spacing:1.5px;color:var(--muted);font-weight:600;text-transform:uppercase;padding-top:10px;padding-bottom:0;border-bottom:0!important}
.colh .ctr{text-align:center}
.llname{min-width:0;font-weight:600;font-size:15px;display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.llname.sm{font-size:14px}
.llin{font-family:var(--display)!important;font-size:24px;letter-spacing:1px;padding:4px 6px;width:100%;border-radius:10px;text-align:center;transition:opacity .2s}
.llin.kn{border-color:#6E6A62}
.llin.dimmed{opacity:.35}
.llres{display:grid;grid-template-columns:minmax(0,1.5fr) repeat(4,minmax(0,1fr));gap:6px;align-items:center;padding:12px 18px;border-bottom:1px solid #4A4946}
.llres:last-child{border-bottom:0}
.llres .v{font-family:var(--display);font-size:22px;letter-spacing:1px;font-variant-numeric:tabular-nums}
.llres .calc{font-size:10px;color:var(--faint);letter-spacing:.5px;font-weight:600;text-transform:uppercase}
.llres.lim{background:#4C3B37;border-radius:12px;margin:4px 8px;padding:8px 10px;border-bottom:0}
.good{color:var(--good)}.warn{color:var(--warn)}.bad{color:var(--bad)}.dim{color:var(--faint)}
.legend{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:12px;color:var(--muted)}
.sw{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px}
.good-bg{background:var(--good)}.warn-bg{background:var(--warn)}.bad-bg{background:var(--bad)}
.foot{text-align:center;margin-top:56px;font-size:10px;letter-spacing:5px;color:var(--faint);text-transform:uppercase;font-weight:600}
.linkbtn{background:none;border:0;padding:0;color:var(--muted);text-decoration:underline;font:inherit;font-style:italic}
.mail{position:fixed;left:20px;bottom:calc(20px + env(safe-area-inset-bottom,0px));width:58px;height:58px;border-radius:50%;background:var(--bone);color:var(--ink);border:0;display:flex;align-items:center;justify-content:center;z-index:10;box-shadow:0 4px 14px rgba(0,0,0,.35)}
.ov{position:fixed;inset:0;background:rgba(20,19,18,.72);z-index:20;display:flex;align-items:center;justify-content:center;padding:16px}
.modal{position:relative;width:100%;max-width:420px;background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:28px 22px 22px}
.modal-x{position:absolute;top:12px;right:12px;background:none;border:0;color:var(--muted);font-size:18px}
.modal-t{font-family:var(--display);font-size:30px;letter-spacing:1.5px;margin-bottom:6px}
.modal-d{font-size:14px;color:var(--bone-dim);margin:0 0 16px}
.err{font-size:13px;color:var(--bad);margin:8px 0 0}
@media (max-width:560px){
  .big-in{width:104px;font-size:34px}
  .tabs .pill{font-size:11px;padding:12px 6px}
  .addex-row{grid-template-columns:1fr}
  .compact .pg{--setcol:54px;gap:4px}
  .compact .pg .wt{font-size:17px}
  .compact .pg .tg{display:none}
  .compact .pg .val{font-size:19px}
  .compact .pg .val span{font-size:11px}
  .compact .pg .pb{width:28px;height:28px;font-size:14px;border-radius:7px}
  .compact .pg .ctl{gap:2px}
  .compact .pg .pct{font-size:11px;min-width:30px}
  .compact .pg .sk{font-size:10px;letter-spacing:1px}
  .compact .pg .sr{font-size:10px;letter-spacing:.5px}
  .compact .pg .tt{display:none}
  .compact .pg .pl{font-size:10px}
  .swipe{overflow-x:auto}
  .swipe .pg{--setcol:54px;--wkcol:124px;width:max-content}
  .swipe .pg .lc{position:sticky;left:0;z-index:1}
  .lli{grid-template-columns:minmax(0,1fr) 70px 46px 70px;gap:5px;padding:10px 12px}
  .lli .llin{font-size:21px;padding:4px 2px}
  .lli .llname{font-size:13px}
  .llres{padding:12px;gap:4px}
  .llres .v{font-size:19px}
  .llres.lim{margin:4px 6px;padding:7px 6px}
}
@media (prefers-reduced-motion:reduce){.app *{transition:none!important}}
`;
