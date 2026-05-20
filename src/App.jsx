import { useState } from "react";

// ── Continuum table (extended to 20 reps) ────────────────────────
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

const PHASE = [
  { week:1, label:"Week 1", defaultPct:-0.05,  tag:"Building In"  },
  { week:2, label:"Week 2", defaultPct:+0.025, tag:"Coordinating" },
  { week:3, label:"Week 3", defaultPct:+0.05,  tag:"Expressing"   },
];

const PRESETS = [
  "Back Squat","Front Squat","Deadlift","Bench Press",
  "Incline Press","OHP","Dips","Chin-up",
];

const MAX_COMPLEX_SLOTS = 8;

// ── Limiting Lift System ─────────────────────────────────────────
const LIFT_DEFS = [
  { key:"bench",    label:"Bench Press",        group:"upper", motherKey:null,     targetRatio:null },
  { key:"ohp",      label:"Overhead Press",      group:"upper", motherKey:"bench",  targetRatio:0.72 },
  { key:"incline",  label:"Incline Press",        group:"upper", motherKey:"bench",  targetRatio:0.91 },
  { key:"dips",     label:"Dips / Decline Press", group:"upper", motherKey:"bench",  targetRatio:1.17 },
  { key:"chinup",   label:"Chin-up",              group:"upper", motherKey:"bench",  targetRatio:0.87 },
  { key:"squat",    label:"Back Squat",           group:"lower", motherKey:null,     targetRatio:null },
  { key:"deadlift", label:"Deadlift",             group:"lower", motherKey:"squat",  targetRatio:1.25 },
  { key:"frontsq",  label:"Front Squat",          group:"lower", motherKey:"squat",  targetRatio:0.85 },
];

function calcLimitingLifts(inputs) {
  const e1rms = {};
  for (const def of LIFT_DEFS) {
    const inp = inputs[def.key];
    if (inp && inp.weight > 0 && inp.reps >= 1) {
      e1rms[def.key] = inp.weight / getPct(inp.reps);
    }
  }
  const results = LIFT_DEFS.map(def => {
    const e1rm = e1rms[def.key] ?? null;
    if (def.motherKey === null) {
      return { ...def, e1rm, actualRatio: null, gap: null };
    }
    const motherE1rm = e1rms[def.motherKey] ?? null;
    const actualRatio = (e1rm && motherE1rm) ? e1rm / motherE1rm : null;
    const gap = (actualRatio !== null) ? actualRatio - def.targetRatio : null;
    return { ...def, e1rm, actualRatio, gap };
  });

  for (const group of ["upper","lower"]) {
    const dependents = results.filter(r => r.group === group && r.motherKey !== null && r.gap !== null);
    if (dependents.length === 0) continue;
    const mostNegative = dependents.reduce((a, b) => (a.gap < b.gap ? a : b));
    if (mostNegative.gap < 0) mostNegative.isLimiting = true;
  }
  return results;
}

// ── Rounding ──────────────────────────────────────────────────────
const roundHalf     = (n) => Math.round(n * 2) / 2;
const roundNearest5 = (n) => Math.round(n / 5) * 5;
const roundWhole    = (n) => Math.round(n);
const roundDisplay  = (val) => roundHalf(val);
const roundStep     = (val, micro) => micro ? roundWhole(val) : roundNearest5(val);
const roundPct      = (n) => Math.round(n * 200) / 200;

function fmt(n) {
  if (n === undefined || n === null || isNaN(n)) return "—";
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}
function fmtPct(n) {
  const sign = n >= 0 ? "+" : "−";
  const abs  = Math.abs(n * 100);
  const str  = abs % 1 === 0 ? abs.toFixed(0) : abs.toFixed(1);
  return `${sign}${str}%`;
}
function fmtRatioPct(n) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return (n * 100).toFixed(1) + "%";
}
function fmtGap(n) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  const pct = (n * 100).toFixed(1);
  return (n >= 0 ? "+" : "") + pct + "%";
}

// ── Calculations ──────────────────────────────────────────────────
const calcE1RM   = (w, r)     => w / getPct(r);
const calcRepMax = (e1rm, tr) => e1rm * getPct(tr);

function buildLadder(topSetRaw, sets, micro) {
  const spread = STEP_PCT[sets] ?? 0.10;
  const bottom = topSetRaw * (1 - spread);
  return Array.from({ length: sets }, (_, i) => {
    const raw = sets === 1 ? topSetRaw : bottom + (topSetRaw - bottom) * (i / (sets - 1));
    return roundStep(raw, micro);
  });
}

function parseComplex(slots) {
  return slots
    .map(s => parseInt(s.trim()))
    .filter(n => !isNaN(n) && n >= 1 && n <= 15);
}

function buildWarmup(bottomSetWeight, micro) {
  return [
    { reps:6, pct:0.50 },
    { reps:4, pct:0.75 },
    { reps:2, pct:0.90 },
  ].map((wu, i) => ({
    setNum: i + 1,
    reps:   wu.reps,
    weight: roundStep(bottomSetWeight * wu.pct, micro),
  }));
}

const COL = { set:46, reps:72, weight:120 };

// ── Components ────────────────────────────────────────────────────
function Toggle({ options, value, onChange }) {
  return (
    <div style={s.toggleWrap}>
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)}
          style={{ ...s.toggleBtn, ...(value === o.value ? s.toggleOn : {}) }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Section({ num, title, children, show }) {
  if (!show) return null;
  return (
    <div style={s.section}>
      <div style={s.sectionHead}>
        <div style={s.sectionNumBig}>{num}</div>
        <div style={s.sectionTitle}>{title}</div>
      </div>
      <div>{children}</div>
    </div>
  );
}

function BigResult({ sublabel, label, value, unit }) {
  return (
    <div style={s.bigResult}>
      {sublabel && <div style={s.bigResultSub}>{sublabel}</div>}
      <div style={s.bigResultLabel}>{label}</div>
      <div style={s.bigResultNum}>
        {value}<span style={s.bigResultUnit}>{unit}</span>
      </div>
    </div>
  );
}

function WarmupBlock({ bottomSetWeight, unit, micro }) {
  const [open, setOpen] = useState(false);
  const warmup = buildWarmup(bottomSetWeight, micro);
  return (
    <div style={s.warmupWrap}>
      <button onClick={() => setOpen(v => !v)} style={s.warmupToggleBtn}>
        <span style={s.warmupBtnLabel}>
          {open ? "▲ Hide Warm-Up" : "▼ Show Warm-Up"}
        </span>
      </button>
      {open && (
        <div style={s.warmupPanel}>
          <div style={s.warmupHeader}>WARM-UP SETS</div>
          {warmup.map(wu => (
            <div key={wu.setNum} style={s.warmupRow}>
              <span style={{...s.warmupSetLabel, width:COL.set}}>Set {wu.setNum}</span>
              <span style={{...s.warmupReps, width:COL.reps}}>{wu.reps} Reps</span>
              <span style={{...s.warmupWeight, width:COL.weight}}>
                {fmt(wu.weight)}<span style={s.warmupUnit}>{unit}</span>
              </span>
            </div>
          ))}
          <div style={s.warmupDisclaimer}>
            * Warm-up sets are intended for A-Series lifts only
          </div>
        </div>
      )}
    </div>
  );
}

function Ladder({ steps, targetReps, unit }) {
  return (
    <div style={s.ladder}>
      {steps.map((w, i) => {
        const isTop = i === steps.length - 1;
        const isBot = i === 0;
        return (
          <div key={i} style={{
            ...s.ladderRow,
            ...(isTop ? s.lTop : isBot ? s.lBot : s.lMid),
          }}>
            <span style={{...s.lSetLabel, width:COL.set, ...(isTop?{color:"#aaa"}:{})}}>
              Set {i + 1}
            </span>
            <span style={{...s.lReps, width:COL.reps, ...(isTop?{color:"#888"}:{})}}>
              {targetReps} Reps
            </span>
            <span style={{...s.lWeightFixed, width:COL.weight, ...(isTop?{color:"#fff"}:{})}}>
              {fmt(w)}<span style={{...s.lUnit, ...(isTop?{color:"#666"}:{})}}>{unit}</span>
            </span>
            {isTop && <span style={s.lTagTop}>Top Set</span>}
            {isBot && <span style={s.lTagBot}>Start</span>}
          </div>
        );
      })}
    </div>
  );
}

function ComplexSetList({ sets, unit }) {
  return (
    <div style={s.ladder}>
      {sets.map((set, i) => (
        <div key={i} style={{...s.ladderRow, ...s.lMid}}>
          <span style={{...s.lSetLabel, width:COL.set}}>Set {i + 1}</span>
          <span style={{...s.lReps, width:COL.reps}}>{set.repCount} Reps</span>
          <span style={{...s.lWeightFixed, width:COL.weight}}>
            {fmt(set.weight)}<span style={s.lUnit}>{unit}</span>
          </span>
          <span style={s.complexTag}>ES{set.repCount}RM</span>
        </div>
      ))}
    </div>
  );
}

function PctAdjuster({ value, onChange }) {
  const step = 0.005;
  return (
    <div style={s.pctAdjRow}>
      <button onClick={() => onChange(roundPct(value - step))} style={s.pctBtn}>−</button>
      <div style={s.pctDisplay}>{fmtPct(value)}</div>
      <button onClick={() => onChange(roundPct(value + step))} style={s.pctBtn}>+</button>
    </div>
  );
}

function PhaseCard({ phase, esRepMaxRaw, defaultSets, targetReps, unit, micro }) {
  const [weekSetsInput, setWeekSetsInput] = useState("");
  const [pct, setPct] = useState(phase.defaultPct);
  const overrideSets = parseInt(weekSetsInput);
  const activeSets   = (overrideSets >= 2 && overrideSets <= 12) ? overrideSets : defaultSets;
  const topSetRaw     = esRepMaxRaw * (1 + pct);
  const topSetDisplay = roundHalf(topSetRaw);
  const ladder        = buildLadder(topSetRaw, activeSets, micro);
  const bottomSet     = ladder[0];
  return (
    <div style={s.phaseCard}>
      <div style={s.phaseTop}>
        <div>
          <div style={s.phaseWeek}>{phase.label}</div>
          <div style={s.phaseTag}>{phase.tag}</div>
        </div>
        <div style={s.phaseTopRight}>
          <PctAdjuster value={pct} onChange={setPct} />
          <input
            type="number" min="2" max="12"
            placeholder={`${defaultSets} sets`}
            value={weekSetsInput}
            onChange={e => setWeekSetsInput(e.target.value)}
            style={s.weekSetsInput}
          />
        </div>
      </div>
      <div style={s.phaseTopSetRow}>
        Top set: <strong>{fmt(topSetDisplay)}{unit}</strong>
        {" · "}{activeSets} sets
      </div>
      <WarmupBlock bottomSetWeight={bottomSet} unit={unit} micro={micro} />
      <Ladder steps={ladder} targetReps={targetReps} unit={unit} />
    </div>
  );
}

function ComplexPhaseCard({ phase, complexSets, unit, micro }) {
  const [pct, setPct] = useState(phase.defaultPct);
  const phasedSets = complexSets.map(set => ({
    repCount: set.repCount,
    weight: roundStep(set.weightRaw * (1 + pct), micro),
  }));
  const bottomSet = phasedSets.length > 0
    ? Math.min(...phasedSets.map(s => s.weight))
    : 0;
  return (
    <div style={s.phaseCard}>
      <div style={s.phaseTop}>
        <div>
          <div style={s.phaseWeek}>{phase.label}</div>
          <div style={s.phaseTag}>{phase.tag}</div>
        </div>
        <div style={s.phaseTopRight}>
          <PctAdjuster value={pct} onChange={setPct} />
        </div>
      </div>
      <WarmupBlock bottomSetWeight={bottomSet} unit={unit} micro={micro} />
      <ComplexSetList sets={phasedSets} unit={unit} />
    </div>
  );
}

function ComplexInput({ slots, onChange }) {
  return (
    <div style={s.complexWrap}>
      <label style={s.label}>
        Rep Scheme <span style={s.hint}>(enter reps per set, left to right)</span>
      </label>
      <div style={s.complexGrid}>
        {slots.map((val, i) => (
          <div key={i} style={s.complexSlot}>
            <div style={s.complexSlotLabel}>S{i + 1}</div>
            <input
              type="number" min="1" max="15" placeholder="—"
              value={val}
              onChange={e => {
                const next = [...slots];
                next[i] = e.target.value;
                onChange(next);
              }}
              style={s.complexInput}
            />
          </div>
        ))}
      </div>
      <div style={s.complexHintText}>1–15 reps per set · leave unused slots blank</div>
    </div>
  );
}

// ── Limiting Lift Components ──────────────────────────────────────
function LiftInputRow({ def, value, onChange, unit }) {
  const isMother = def.motherKey === null;
  return (
    <div style={s.llRow}>
      <div style={s.llLiftName}>
        <span style={s.llLiftLabel}>{def.label}</span>
        {isMother && <span style={s.llMotherBadge}>Mother Lift</span>}
      </div>
      <div style={s.llInputs}>
        <input
          type="number" min="1" max="20" placeholder="Reps"
          value={value.reps}
          onChange={e => onChange({ ...value, reps: e.target.value })}
          style={s.llRepsInput}
        />
        <span style={s.llTimes}>×</span>
        <input
          type="number" min="1" placeholder="Weight"
          value={value.weight}
          onChange={e => onChange({ ...value, weight: e.target.value })}
          style={s.llWeightInput}
        />
        <span style={s.llUnitLabel}>{unit}</span>
      </div>
    </div>
  );
}

function LimitingLiftResults({ results, unit }) {
  function GroupBlock({ lifts, groupLabel }) {
    const hasData = lifts.some(l => l.e1rm !== null);
    if (!hasData) return null;
    const limiting = lifts.find(l => l.isLimiting);
    return (
      <div style={s.llGroup}>
        <div style={s.llGroupHeader}>
          <span style={s.llGroupLabel}>{groupLabel}</span>
          {limiting && (
            <span style={s.llLimitingFlag}>⚡ Limiting: {limiting.label}</span>
          )}
        </div>
        <div style={s.llResultsTable}>
          <div style={{ ...s.llResultRow, ...s.llResultHeader }}>
            <span style={s.llColLift}>Lift</span>
            <span style={s.llColE1rm}>ES1RM</span>
            <span style={s.llColActual}>Actual</span>
            <span style={s.llColTarget}>Target</span>
            <span style={s.llColGap}>Gap</span>
          </div>
          {lifts.map(lift => {
            if (lift.e1rm === null) return null;
            const isMother   = lift.motherKey === null;
            const isLimiting = !!lift.isLimiting;
            const gap        = lift.gap;
            const gapColor   = isMother ? "#bbb"
              : gap === null   ? "#bbb"
              : gap >= 0       ? "#4CAF50"
              : gap > -0.05    ? "#FF9800"
              : "#F44336";
            return (
              <div key={lift.key} style={{
                ...s.llResultRow,
                ...(isLimiting ? s.llResultLimiting : {}),
                ...(isMother   ? s.llResultMother   : {}),
              }}>
                <span style={s.llColLift}>
                  {lift.label}
                  {isMother   && <span style={s.llMotherDot}>●</span>}
                  {isLimiting && <span style={s.llLimitingDot}>⚡</span>}
                </span>
                <span style={s.llColE1rm}>
                  {fmt(roundHalf(lift.e1rm))}<span style={s.llSmallUnit}>{unit}</span>
                </span>
                <span style={{ ...s.llColActual, color: isMother ? "#bbb" : "#1A1A1A" }}>
                  {isMother ? "—" : fmtRatioPct(lift.actualRatio)}
                </span>
                <span style={{ ...s.llColTarget, color:"#bbb" }}>
                  {isMother ? "—" : fmtRatioPct(lift.targetRatio)}
                </span>
                <span style={{ ...s.llColGap, color: gapColor }}>
                  {isMother ? "—" : fmtGap(gap)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const upper = results.filter(r => r.group === "upper");
  const lower = results.filter(r => r.group === "lower");
  return (
    <div>
      <GroupBlock lifts={upper} groupLabel="Upper Body" />
      <GroupBlock lifts={lower} groupLabel="Lower Body" />
      <div style={s.llLegend}>
        <span style={{ color:"#4CAF50" }}>■</span> At or above target &nbsp;&nbsp;
        <span style={{ color:"#FF9800" }}>■</span> Within 5% below &nbsp;&nbsp;
        <span style={{ color:"#F44336" }}>■</span> More than 5% below
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────
const EMPTY_LIFT = { reps: "", weight: "" };

export default function App() {
  // Tab state
  const [activeTab, setActiveTab] = useState("planner");

  // 1RM Planner state
  const [weight,       setWeight]       = useState("");
  const [topReps,      setTopReps]      = useState("");
  const [unit,         setUnit]         = useState("lbs");
  const [exercise,     setExercise]     = useState("");
  const [customEx,     setCustomEx]     = useState("");
  const [showCustom,   setShowCustom]   = useState(false);
  const [micro,        setMicro]        = useState(true);
  const [targetReps,   setTargetReps]   = useState("");
  const [targetSets,   setTargetSets]   = useState("");
  const [mode,         setMode]         = useState("standard");
  const [complexSlots, setComplexSlots] = useState(Array(MAX_COMPLEX_SLOTS).fill(""));

  // Limiting lift state
  const [llUnit,   setLlUnit]   = useState("lbs");
  const [llInputs, setLLInputs] = useState(
    Object.fromEntries(LIFT_DEFS.map(d => [d.key, { ...EMPTY_LIFT }]))
  );
  const setLLInput = (key, val) =>
    setLLInputs(prev => ({ ...prev, [key]: val }));

  // Planner calcs
  const w  = parseFloat(weight);
  const r  = parseInt(topReps);
  const tr = parseInt(targetReps);
  const ts = parseInt(targetSets);

  const hasWeight = w && w > 0;
  const hasReps   = r && r >= 1 && r <= 15;
  const hasTarget = tr && tr >= 1 && tr <= 15;
  const hasSets   = ts && ts >= 2 && ts <= 12;

  const e1rmRaw     = (hasWeight && hasReps) ? calcE1RM(w, r) : null;
  const e1rmDisplay = e1rmRaw ? roundDisplay(e1rmRaw) : null;

  const esRepMaxRaw     = (e1rmRaw && hasTarget) ? calcRepMax(e1rmRaw, tr) : null;
  const esRepMaxDisplay = esRepMaxRaw ? roundDisplay(esRepMaxRaw) : null;

  const ladder = (esRepMaxRaw && hasSets)
    ? buildLadder(esRepMaxRaw, ts, micro)
    : null;

  const complexReps = parseComplex(complexSlots);
  const hasComplex  = complexReps.length > 0 && e1rmRaw;
  const complexSets = hasComplex
    ? complexReps.map(rep => ({
        repCount:  rep,
        weightRaw: calcRepMax(e1rmRaw, rep),
        weight:    roundStep(calcRepMax(e1rmRaw, rep), micro),
      }))
    : [];

  const exLabel      = showCustom ? (customEx || "") : exercise;
  const canShowPhase = mode === "standard"
    ? (!!esRepMaxDisplay && hasSets)
    : hasComplex;

  // Limiting lift calcs
  const llParsed = Object.fromEntries(
    LIFT_DEFS.map(d => {
      const inp  = llInputs[d.key];
      const reps = parseInt(inp.reps);
      const wt   = parseFloat(inp.weight);
      return [d.key, (reps >= 1 && reps <= 20 && wt > 0) ? { reps, weight: wt } : null];
    })
  );
  const hasUpperLL = llParsed["bench"] && LIFT_DEFS
    .filter(d => d.group === "upper" && d.motherKey)
    .some(d => llParsed[d.key]);
  const hasLowerLL = llParsed["squat"] && LIFT_DEFS
    .filter(d => d.group === "lower" && d.motherKey)
    .some(d => llParsed[d.key]);
  const hasAnyLL  = hasUpperLL || hasLowerLL;
  const llResults = hasAnyLL ? calcLimitingLifts(llParsed) : null;

  return (
    <div style={s.root}>
      <div style={s.wrap}>

        {/* HEADER */}
        <header style={s.header}>
          <div style={s.brand}>40X0 Training</div>
          <h1 style={s.title}>
            {activeTab === "planner" ? <>1RM &amp; Load<br/>Planner</> : <>Limiting Lift<br/>Calculator</>}
          </h1>
          <p style={s.tagline}>
            {activeTab === "planner"
              ? "ES1RM · Target Rep Max · Step Load · Phase Plan"
              : "Upper & Lower Strength Ratio Analysis"}
          </p>
        </header>

        {/* ── TAB BUTTONS ── */}
        <div style={s.tabBar}>
          <button
            onClick={() => setActiveTab("planner")}
            style={{ ...s.tabBtn, ...(activeTab === "planner" ? s.tabBtnOn : {}) }}
          >
            1RM &amp; Load Planner
          </button>
          <button
            onClick={() => setActiveTab("limiting")}
            style={{ ...s.tabBtn, ...(activeTab === "limiting" ? s.tabBtnOn : {}) }}
          >
            Limiting Lift Calculator
          </button>
        </div>

        {/* ══════════════════════════════════════════
            TAB 1 — 1RM & LOAD PLANNER
        ══════════════════════════════════════════ */}
        {activeTab === "planner" && (
          <>
            {/* ── STEP 1 ── */}
            <Section num="01" title="Find Your Estimated 1-Rep Max" show>
              <div style={s.rowWrap}>
                <div style={s.field}>
                  <label style={s.label}>Unit</label>
                  <Toggle
                    value={unit}
                    onChange={setUnit}
                    options={[{ value:"lbs", label:"lbs" }, { value:"kg", label:"kg" }]}
                  />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Have Micro Plates?</label>
                  <Toggle
                    value={micro ? "yes" : "no"}
                    onChange={v => setMicro(v === "yes")}
                    options={[{ value:"yes", label:"Yes" }, { value:"no", label:"No" }]}
                  />
                </div>
              </div>

              <div style={s.field}>
                <label style={s.label}>
                  Exercise <span style={s.hint}>(optional — label only)</span>
                </label>
                <div style={s.exGrid}>
                  {PRESETS.map(p => (
                    <button key={p}
                      onClick={() => { setExercise(p); setShowCustom(false); }}
                      style={{ ...s.exBtn, ...(!showCustom && exercise === p ? s.exBtnOn : {}) }}>
                      {p}
                    </button>
                  ))}
                  <button onClick={() => setShowCustom(true)}
                    style={{ ...s.exBtn, ...(showCustom ? s.exBtnOn : {}), gridColumn:"span 2" }}>
                    + Custom
                  </button>
                </div>
                {showCustom && (
                  <input placeholder="Exercise name…" value={customEx}
                    onChange={e => setCustomEx(e.target.value)}
                    style={{ ...s.textInput, marginTop:8 }} />
                )}
              </div>

              <div style={s.field}>
                <label style={s.label}>Top Set</label>
                <div style={s.inputRow}>
                  <div style={s.inputGroup}>
                    <input
                      type="number" min="1" placeholder="100"
                      value={weight}
                      onChange={e => setWeight(e.target.value)}
                      className="no-spinner"
                      style={s.bigInput}
                    />
                    <span style={s.inputLabel}>{unit}</span>
                  </div>
                  <span style={s.timesSymbol}>×</span>
                  <div style={s.inputGroup}>
                    <input
                      type="number" min="1" max="15" placeholder="5"
                      value={topReps}
                      onChange={e => setTopReps(e.target.value)}
                      className="no-spinner"
                      style={s.bigInput}
                    />
                    <span style={s.inputLabel}>Reps</span>
                  </div>
                </div>
              </div>

              {e1rmDisplay && (
                <BigResult
                  sublabel={
                    exLabel
                      ? `${exLabel} · ${fmt(w)}${unit} × ${r} rep${r > 1 ? "s" : ""}`
                      : `${fmt(w)}${unit} × ${r} rep${r > 1 ? "s" : ""}`
                  }
                  label="Estimated 1-Rep Max"
                  value={fmt(e1rmDisplay)}
                  unit={unit}
                />
              )}
            </Section>

            {/* ── STEP 2 ── */}
            <Section num="02" title="New Mesocycle Sets × Reps" show={!!e1rmDisplay}>
              <div style={s.field}>
                <label style={s.label}>Rep Scheme Type</label>
                <Toggle
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value:"standard", label:"Standard Reps" },
                    { value:"complex",  label:"Complex Reps"  },
                  ]}
                />
              </div>

              {mode === "standard" && (
                <>
                  <p style={s.desc}>
                    Using your <strong>{fmt(e1rmDisplay)}{unit}</strong> ES1RM — enter your target sets and reps.
                  </p>
                  <div style={s.field}>
                    <label style={s.label}>Target Sets × Reps</label>
                    <div style={s.inputRow}>
                      <div style={s.inputGroup}>
                        <input
                          type="number" min="2" max="12" placeholder="Sets"
                          value={targetSets}
                          onChange={e => setTargetSets(e.target.value)}
                          style={s.step2Input}
                        />
                        <span style={s.inputLabel}>Sets</span>
                      </div>
                      <span style={s.timesSymbol}>×</span>
                      <div style={s.inputGroup}>
                        <input
                          type="number" min="1" max="15" placeholder="Reps"
                          value={targetReps}
                          onChange={e => setTargetReps(e.target.value)}
                          style={s.step2Input}
                        />
                        <span style={s.inputLabel}>Reps</span>
                      </div>
                    </div>
                  </div>

                  {esRepMaxDisplay && (
                    <BigResult
                      label={`Estimated ${tr}-Rep Max`}
                      value={fmt(esRepMaxDisplay)}
                      unit={unit}
                    />
                  )}

                  {ladder && (
                    <div style={{ marginTop:20 }}>
                      <div style={s.ladderMeta}>
                        <strong>{ts} sets</strong> · Spread: <strong>{Math.round((STEP_PCT[ts] ?? 0.10) * 100)}%</strong>
                        {" · "}Bottom: <strong>{fmt(ladder[0])}{unit}</strong>
                        {" · "}Top: <strong>{fmt(ladder[ladder.length - 1])}{unit}</strong>
                      </div>
                      <Ladder steps={ladder} targetReps={tr} unit={unit} />
                    </div>
                  )}
                </>
              )}

              {mode === "complex" && (
                <>
                  <p style={s.desc}>
                    Using your <strong>{fmt(e1rmDisplay)}{unit}</strong> ES1RM — enter your rep scheme.
                  </p>
                  <ComplexInput slots={complexSlots} onChange={setComplexSlots} />
                  {hasComplex && (
                    <div style={{ ...s.bigResult, marginTop:16 }}>
                      <div style={s.bigResultLabel}>Rep Scheme Weights</div>
                      <ComplexSetList sets={complexSets} unit={unit} />
                    </div>
                  )}
                </>
              )}
            </Section>

            {/* ── STEP 3 ── */}
            <Section num="03" title="3-Week Phase Plan" show={canShowPhase}>
              {mode === "standard" && (
                <>
                  <p style={s.desc}>
                    Each week adjusts from your ES{tr}RM of <strong>{fmt(esRepMaxDisplay)}{unit}</strong>.
                    Adjust percentages and sets per week as needed.
                  </p>
                  <div style={s.phaseGrid}>
                    {PHASE.map(ph => (
                      <PhaseCard
                        key={ph.week}
                        phase={ph}
                        esRepMaxRaw={esRepMaxRaw}
                        defaultSets={ts}
                        targetReps={tr}
                        unit={unit}
                        micro={micro}
                      />
                    ))}
                  </div>
                </>
              )}
              {mode === "complex" && hasComplex && (
                <>
                  <p style={s.desc}>
                    Each week applies phase percentages to each set individually.
                    Adjust percentages per week as needed.
                  </p>
                  <div style={s.phaseGrid}>
                    {PHASE.map(ph => (
                      <ComplexPhaseCard
                        key={ph.week}
                        phase={ph}
                        complexSets={complexSets}
                        unit={unit}
                        micro={micro}
                      />
                    ))}
                  </div>
                </>
              )}
            </Section>
          </>
        )}

        {/* ══════════════════════════════════════════
            TAB 2 — LIMITING LIFT CALCULATOR
        ══════════════════════════════════════════ */}
        {activeTab === "limiting" && (
          <>
            <Section num="01" title="Enter Lift Data" show>
              <div style={s.rowWrap}>
                <div style={s.field}>
                  <label style={s.label}>Unit</label>
                  <Toggle
                    value={llUnit}
                    onChange={setLlUnit}
                    options={[{ value:"lbs", label:"lbs" }, { value:"kg", label:"kg" }]}
                  />
                </div>
              </div>

              <p style={s.desc}>
                Enter reps × weight for each lift. The limiting lift per group is the one
                with the largest negative gap from its target ratio relative to the mother lift.
              </p>

              {/* Upper Body */}
              <div style={s.llBlock}>
                <div style={s.llBlockHeader}>Upper Body</div>
                {LIFT_DEFS.filter(d => d.group === "upper").map(def => (
                  <LiftInputRow
                    key={def.key}
                    def={def}
                    value={llInputs[def.key]}
                    onChange={val => setLLInput(def.key, val)}
                    unit={llUnit}
                  />
                ))}
              </div>

              {/* Lower Body */}
              <div style={{ ...s.llBlock, marginTop:20 }}>
                <div style={s.llBlockHeader}>Lower Body</div>
                {LIFT_DEFS.filter(d => d.group === "lower").map(def => (
                  <LiftInputRow
                    key={def.key}
                    def={def}
                    value={llInputs[def.key]}
                    onChange={val => setLLInput(def.key, val)}
                    unit={llUnit}
                  />
                ))}
              </div>

              {!hasAnyLL && (
                <div style={s.llEmptyState}>
                  Enter at least one mother lift (Bench Press or Back Squat) plus
                  one dependent lift to see the analysis.
                </div>
              )}
            </Section>

            {hasAnyLL && llResults && (
              <Section num="02" title="Ratio Analysis" show>
                <LimitingLiftResults results={llResults} unit={llUnit} />
              </Section>
            )}
          </>
        )}

        <div style={s.footer}>40X0 Training · Move Better</div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        body { background:#fff; }
        select { -webkit-appearance:none; appearance:none; }
        button { cursor:pointer; border:none; font-family:'Barlow',sans-serif; }
        button:active { transform:scale(0.97); }
        input:focus, select:focus { outline:2px solid #1A1A1A; outline-offset:1px; }
        input[type=number]::-webkit-inner-spin-button { opacity:0.3; }
        input.no-spinner::-webkit-inner-spin-button,
        input.no-spinner::-webkit-outer-spin-button { -webkit-appearance:none; appearance:none; margin:0; }
        input.no-spinner { -moz-appearance:textfield; }
      `}</style>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const s = {
  root: {
    minHeight:"100vh", background:"#fff",
    fontFamily:"'Barlow',sans-serif", color:"#1A1A1A",
  },
  wrap: { maxWidth:620, margin:"0 auto", padding:"36px 20px 80px" },

  header: { marginBottom:0, paddingBottom:24, borderBottom:"2px solid #1A1A1A" },
  brand: { fontSize:11, letterSpacing:5, color:"#999", marginBottom:10, fontWeight:700, textTransform:"uppercase" },
  title: {
    fontFamily:"'Bebas Neue',sans-serif",
    fontSize:"clamp(52px,12vw,76px)", lineHeight:0.9,
    letterSpacing:2, color:"#1A1A1A", marginBottom:12,
  },
  tagline: { fontSize:11, color:"#bbb", letterSpacing:2, textTransform:"uppercase", fontWeight:600 },

  // ── Tab bar ──────────────────────────────────────────────────────
  tabBar: {
    display:"flex", width:"100%",
    borderBottom:"1px solid #E8E8E8",
    marginBottom:0,
  },
  tabBtn: {
    flex:1, padding:"16px 8px",
    fontFamily:"'Barlow',sans-serif",
    fontSize:13, fontWeight:700, letterSpacing:0.5,
    textTransform:"uppercase",
    background:"#F5F5F5", border:"none",
    color:"#999", cursor:"pointer",
    transition:"all 0.13s",
    borderRight:"1px solid #E8E8E8",
  },
  tabBtnOn: {
    background:"#1A1A1A", color:"#fff",
    borderRight:"1px solid #1A1A1A",
  },

  section: { borderTop:"1px solid #E8E8E8", paddingTop:32, paddingBottom:32 },
  sectionHead: { display:"flex", alignItems:"flex-start", gap:16, marginBottom:24 },
  sectionNumBig: {
    fontFamily:"'Bebas Neue',sans-serif",
    fontSize:72, lineHeight:0.82, letterSpacing:2,
    color:"#1A1A1A", flexShrink:0, userSelect:"none", marginTop:-4,
  },
  sectionTitle: {
    fontFamily:"'Bebas Neue',sans-serif",
    fontSize:22, letterSpacing:1.5, color:"#1A1A1A", paddingTop:14,
  },
  desc: { fontSize:13, color:"#888", marginBottom:18, lineHeight:1.6, fontStyle:"italic" },

  field: { marginBottom:18 },
  rowWrap: { display:"flex", gap:20, flexWrap:"wrap", marginBottom:18 },
  label: {
    display:"block", fontSize:10, letterSpacing:2.5,
    textTransform:"uppercase", color:"#aaa", fontWeight:700, marginBottom:8,
  },
  hint: { color:"#ccc", fontWeight:400, letterSpacing:0.5, textTransform:"none" },

  toggleWrap: { display:"flex", gap:6, flexWrap:"wrap" },
  toggleBtn: {
    background:"#F5F5F5", border:"1.5px solid #E0E0E0",
    color:"#999", padding:"9px 18px", borderRadius:8,
    fontSize:13, fontWeight:600, transition:"all 0.13s", letterSpacing:0.3,
  },
  toggleOn: { background:"#1A1A1A", borderColor:"#1A1A1A", color:"#fff" },

  exGrid: { display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:5 },
  exBtn: {
    background:"#F8F8F8", border:"1.5px solid #E8E8E8",
    color:"#888", padding:"8px 4px", borderRadius:7,
    fontSize:10.5, fontWeight:600, textAlign:"center",
    transition:"all 0.13s", lineHeight:1.3,
  },
  exBtnOn: { background:"#1A1A1A", borderColor:"#1A1A1A", color:"#fff" },

  inputRow: { display:"flex", alignItems:"center", gap:8, flexWrap:"nowrap" },
  inputGroup: { display:"flex", alignItems:"center", gap:6, flexShrink:0 },

  bigInput: {
    width:120, background:"#F8F8F8", border:"1.5px solid #E0E0E0",
    borderRadius:10, color:"#1A1A1A",
    fontSize:38, fontFamily:"'Bebas Neue',sans-serif",
    letterSpacing:2, padding:"10px 12px", textAlign:"center", flexShrink:0,
  },
  step2Input: {
    width:120, background:"#F8F8F8", border:"1.5px solid #E0E0E0",
    borderRadius:10, color:"#1A1A1A",
    fontSize:22, fontFamily:"'Bebas Neue',sans-serif",
    letterSpacing:1, padding:"14px 12px", textAlign:"center", flexShrink:0,
  },
  inputLabel: {
    fontFamily:"'Bebas Neue',sans-serif",
    fontSize:18, color:"#bbb", letterSpacing:2, flexShrink:0,
  },
  timesSymbol: {
    fontFamily:"'Bebas Neue',sans-serif",
    fontSize:30, color:"#ccc", letterSpacing:1, flexShrink:0,
  },
  textInput: {
    width:"100%", background:"#F8F8F8", border:"1.5px solid #E0E0E0",
    borderRadius:10, color:"#1A1A1A", fontSize:15,
    padding:"12px 14px", fontFamily:"'Barlow',sans-serif",
  },

  bigResult: {
    marginTop:20, padding:"20px", background:"#F8F8F8",
    border:"1.5px solid #E8E8E8", borderRadius:14,
  },
  bigResultSub: { fontSize:11, color:"#bbb", letterSpacing:1, marginBottom:4 },
  bigResultLabel: {
    fontFamily:"'Bebas Neue',sans-serif",
    fontSize:12, letterSpacing:5, color:"#bbb", marginBottom:12,
  },
  bigResultNum: {
    fontFamily:"'Bebas Neue',sans-serif",
    fontSize:"clamp(54px,13vw,72px)", lineHeight:1, color:"#1A1A1A", letterSpacing:2,
  },
  bigResultUnit: {
    fontFamily:"'Bebas Neue',sans-serif", fontSize:22, color:"#ccc", marginLeft:6, letterSpacing:2,
  },

  ladderMeta: { fontSize:12, color:"#999", marginBottom:10 },

  ladder: { borderRadius:12, overflow:"hidden", border:"1.5px solid #E8E8E8" },
  ladderRow: {
    display:"flex", alignItems:"center",
    padding:"13px 16px", borderBottom:"1px solid #F0F0F0", gap:0,
  },
  lTop: { background:"#1A1A1A", borderBottom:"none" },
  lMid: { background:"#FAFAFA" },
  lBot: { background:"#F0F0F0" },
  lSetLabel: {
    fontSize:10, letterSpacing:2, textTransform:"uppercase",
    color:"#bbb", flexShrink:0, fontWeight:700,
  },
  lReps: {
    fontSize:10, letterSpacing:2, textTransform:"uppercase",
    color:"#bbb", flexShrink:0, fontWeight:700,
  },
  lWeightFixed: {
    fontFamily:"'Bebas Neue',sans-serif", fontSize:26,
    letterSpacing:1, color:"#1A1A1A", flexShrink:0,
  },
  lUnit: { fontSize:13, marginLeft:2, color:"#bbb" },
  lTagTop: {
    fontSize:10, letterSpacing:1.5, textTransform:"uppercase",
    color:"#888", background:"#333", padding:"3px 8px",
    borderRadius:4, fontWeight:700, flexShrink:0, marginLeft:"auto",
  },
  lTagBot: {
    fontSize:10, letterSpacing:1.5, textTransform:"uppercase",
    color:"#666", background:"#E0E0E0", padding:"3px 8px",
    borderRadius:4, fontWeight:700, flexShrink:0, marginLeft:"auto",
  },
  complexTag: {
    fontSize:10, letterSpacing:1.5, textTransform:"uppercase",
    color:"#888", background:"#E8E8E8", padding:"3px 8px",
    borderRadius:4, fontWeight:700, flexShrink:0, marginLeft:"auto",
  },

  complexWrap: { marginBottom:4 },
  complexGrid: { display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:8 },
  complexSlot: { display:"flex", flexDirection:"column", alignItems:"center", gap:4 },
  complexSlotLabel: {
    fontSize:9, letterSpacing:2, textTransform:"uppercase", color:"#ccc", fontWeight:700,
  },
  complexInput: {
    width:"100%", background:"#F8F8F8", border:"1.5px solid #E0E0E0",
    borderRadius:8, color:"#1A1A1A", fontSize:20,
    fontFamily:"'Bebas Neue',sans-serif", letterSpacing:1,
    padding:"10px 4px", textAlign:"center",
  },
  complexHintText: { fontSize:11, color:"#ccc", fontStyle:"italic", letterSpacing:0.3 },

  phaseGrid: { display:"flex", flexDirection:"column", gap:16 },
  phaseCard: {
    border:"1.5px solid #E8E8E8", borderRadius:16, padding:"20px", background:"#FAFAFA",
  },
  phaseTop: {
    display:"flex", justifyContent:"space-between",
    alignItems:"flex-start", marginBottom:12, gap:12,
  },
  phaseTopRight: {
    display:"flex", flexDirection:"column", alignItems:"flex-end", gap:8, flexShrink:0,
  },
  phaseWeek: {
    fontFamily:"'Bebas Neue',sans-serif", fontSize:26, letterSpacing:2, color:"#1A1A1A",
  },
  phaseTag: {
    fontSize:10, letterSpacing:2, textTransform:"uppercase",
    color:"#bbb", fontWeight:700, marginTop:2,
  },
  pctAdjRow: { display:"flex", alignItems:"center", gap:4 },
  pctBtn: {
    width:28, height:28, background:"#E8E8E8", border:"1.5px solid #D8D8D8",
    borderRadius:6, fontSize:16, color:"#555", fontWeight:700,
    display:"flex", alignItems:"center", justifyContent:"center",
    cursor:"pointer", flexShrink:0, lineHeight:1,
  },
  pctDisplay: {
    fontSize:13, fontWeight:700, color:"#1A1A1A",
    minWidth:52, textAlign:"center", letterSpacing:0.5,
    fontFamily:"'Barlow',sans-serif",
  },
  weekSetsInput: {
    width:90, background:"#fff", border:"1.5px solid #E0E0E0",
    borderRadius:8, color:"#1A1A1A", fontSize:12,
    padding:"5px 8px", fontFamily:"'Barlow',sans-serif",
    textAlign:"center", fontWeight:500,
  },
  phaseTopSetRow: {
    fontSize:13, color:"#666", marginBottom:12,
    padding:"8px 12px", background:"#EFEFEF",
    borderRadius:8, display:"inline-block",
    alignSelf:"flex-start",
  },
  warmupWrap: { marginBottom:12 },
  warmupToggleBtn: {
    background:"transparent", border:"1.5px solid #D0D0D0",
    borderRadius:8, padding:"7px 14px", cursor:"pointer",
    width:"100%",
  },
  warmupBtnLabel: {
    fontSize:11, letterSpacing:2, textTransform:"uppercase",
    color:"#888", fontWeight:700, fontFamily:"'Barlow',sans-serif",
  },
  warmupPanel: {
    background:"#3A3A3A", borderRadius:"0 0 10px 10px",
    overflow:"hidden", border:"1.5px solid #3A3A3A", borderTop:"none",
  },
  warmupHeader: {
    fontSize:10, letterSpacing:3, textTransform:"uppercase",
    color:"#888", fontWeight:700, padding:"10px 16px 6px",
    borderBottom:"1px solid #444",
  },
  warmupRow: {
    display:"flex", alignItems:"center",
    padding:"12px 16px", borderBottom:"1px solid #444", gap:0,
  },
  warmupSetLabel: {
    fontSize:10, letterSpacing:2, textTransform:"uppercase",
    color:"#888", flexShrink:0, fontWeight:700,
  },
  warmupReps: {
    fontSize:10, letterSpacing:2, textTransform:"uppercase",
    color:"#888", flexShrink:0, fontWeight:700,
  },
  warmupWeight: {
    fontFamily:"'Bebas Neue',sans-serif", fontSize:26,
    letterSpacing:1, color:"#F0F0F0", flexShrink:0,
  },
  warmupUnit: { fontSize:13, marginLeft:2, color:"#666" },
  warmupDisclaimer: {
    fontSize:11, color:"#666", fontStyle:"italic",
    padding:"8px 16px", borderTop:"1px solid #444",
  },

  // ── Limiting Lift styles ──────────────────────────────────────────
  llBlock: {
    border:"1.5px solid #E8E8E8", borderRadius:12, overflow:"hidden",
  },
  llBlockHeader: {
    fontFamily:"'Bebas Neue',sans-serif", fontSize:16, letterSpacing:4,
    textTransform:"uppercase", color:"#fff", background:"#555",
    padding:"12px 18px",
  },
  llRow: {
    display:"flex", alignItems:"center", justifyContent:"space-between",
    padding:"13px 18px", borderBottom:"1px solid #F0F0F0",
    background:"#FAFAFA", gap:12, flexWrap:"wrap",
  },
  llLiftName: { display:"flex", alignItems:"center", gap:10, minWidth:160 },
  llLiftLabel: { fontSize:15, fontWeight:600, color:"#1A1A1A" },
  llMotherBadge: {
    fontSize:10, letterSpacing:1.5, textTransform:"uppercase",
    color:"#999", background:"#EFEFEF", padding:"3px 8px",
    borderRadius:4, fontWeight:700,
  },
  llInputs: { display:"flex", alignItems:"center", gap:8, flexShrink:0 },
  llRepsInput: {
    width:72, background:"#F0F0F0", border:"1.5px solid #E0E0E0",
    borderRadius:8, color:"#1A1A1A", fontSize:20,
    fontFamily:"'Bebas Neue',sans-serif", letterSpacing:1,
    padding:"8px 6px", textAlign:"center",
  },
  llTimes: {
    fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:"#ccc",
  },
  llWeightInput: {
    width:96, background:"#F0F0F0", border:"1.5px solid #E0E0E0",
    borderRadius:8, color:"#1A1A1A", fontSize:20,
    fontFamily:"'Bebas Neue',sans-serif", letterSpacing:1,
    padding:"8px 6px", textAlign:"center",
  },
  llUnitLabel: {
    fontFamily:"'Bebas Neue',sans-serif", fontSize:15, color:"#bbb", letterSpacing:1,
  },

  // Results
  llGroup: { borderBottom:"1px solid #F0F0F0" },
  llGroupHeader: {
    display:"flex", alignItems:"center", justifyContent:"space-between",
    padding:"11px 16px", background:"#555", borderBottom:"1px solid #484848",
  },
  llGroupLabel: {
    fontSize:11, letterSpacing:3, textTransform:"uppercase",
    fontWeight:700, color:"#fff",
  },
  llLimitingFlag: {
    fontSize:12, fontWeight:700, color:"#FFD580", letterSpacing:0.3,
  },
  llResultsTable: {},
  llResultRow: {
    display:"grid",
    gridTemplateColumns:"1fr 90px 72px 72px 68px",
    alignItems:"center",
    padding:"11px 16px",
    borderBottom:"1px solid #F5F5F5",
    background:"#FAFAFA",
    gap:4,
  },
  llResultHeader: {
    background:"#F0F0F0", padding:"7px 16px",
    fontSize:10, letterSpacing:2, textTransform:"uppercase",
    color:"#aaa", fontWeight:700,
  },
  llResultLimiting: {
    background:"#FFF5F5", borderLeft:"3px solid #F44336",
  },
  llResultMother: { background:"#F8F8F8" },
  llColLift: {
    fontSize:13, fontWeight:600, color:"#1A1A1A",
    display:"flex", alignItems:"center", gap:6,
  },
  llColE1rm: {
    fontSize:15, fontFamily:"'Bebas Neue',sans-serif",
    letterSpacing:1, color:"#1A1A1A", textAlign:"right",
  },
  llColActual: { fontSize:13, fontWeight:600, textAlign:"right" },
  llColTarget: { fontSize:13, textAlign:"right" },
  llColGap:    { fontSize:13, fontWeight:700, textAlign:"right" },
  llSmallUnit: {
    fontSize:10, color:"#bbb", marginLeft:2,
    fontFamily:"'Barlow',sans-serif",
  },
  llMotherDot:   { fontSize:8,  color:"#bbb" },
  llLimitingDot: { fontSize:10 },
  llLegend: {
    padding:"12px 16px", fontSize:12, color:"#999",
    background:"#FAFAFA", borderTop:"1px solid #F0F0F0",
  },
  llEmptyState: {
    marginTop:16, padding:"14px 16px",
    background:"#F8F8F8", border:"1.5px solid #E8E8E8",
    borderRadius:10, fontSize:13, color:"#bbb", fontStyle:"italic", lineHeight:1.6,
  },

  footer: {
    textAlign:"center", marginTop:60, fontSize:10,
    letterSpacing:5, color:"#ddd", textTransform:"uppercase", fontWeight:700,
  },
};
