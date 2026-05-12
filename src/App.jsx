import { useState } from "react";

// ── Continuum table ───────────────────────────────────────────────
const PCT = {
  1:1.00,2:0.94,3:0.90,4:0.88,5:0.85,6:0.83,7:0.80,8:0.78,
  9:0.76,10:0.74,11:0.72,12:0.70,13:0.68,14:0.67,15:0.66,
};
const getPct = (r) => PCT[Math.max(1, Math.min(15, r))] ?? 0.66;

const STEP_PCT = {
  2:0.05, 3:0.05, 4:0.075, 5:0.10, 6:0.125, 7:0.15,
  8:0.175, 9:0.20, 10:0.225, 11:0.25, 12:0.275,
};

const PHASE = [
  { week:1, label:"Week 1", pct:-0.05,  tag:"Building In",  pctLabel:"−5% vs ES rep max"   },
  { week:2, label:"Week 2", pct:+0.025, tag:"Coordinating", pctLabel:"+2.5% vs ES rep max" },
  { week:3, label:"Week 3", pct:+0.05,  tag:"Expressing",   pctLabel:"+5% vs ES rep max"   },
];

const PRESETS = [
  "Back Squat","Front Squat","Deadlift","Bench Press",
  "Incline Press","OHP","Dips","Chin-up",
];

const MAX_COMPLEX_SLOTS = 8;

// ── Rounding ──────────────────────────────────────────────────────
const roundHalf     = (n) => Math.round(n * 2) / 2;
const roundNearest5 = (n) => Math.round(n / 5) * 5;
const roundWhole    = (n) => Math.round(n);
const roundDisplay  = (val) => roundHalf(val);
const roundStep     = (val, micro) => micro ? roundWhole(val) : roundNearest5(val);

function fmt(n) {
  if (n === undefined || n === null || isNaN(n)) return "—";
  return n % 1 === 0 ? String(n) : n.toFixed(1);
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

// Standard ladder — fixed-width weight column so numbers align
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
            <span style={{ ...s.lSetLabel, ...(isTop ? { color:"#aaa" } : {}) }}>
              Set {i + 1}
            </span>
            <span style={{ ...s.lReps, ...(isTop ? { color:"#888" } : {}) }}>
              {targetReps} Reps
            </span>
            <span style={{ ...s.lWeightFixed, ...(isTop ? { color:"#fff" } : {}) }}>
              {fmt(w)}<span style={{ ...s.lUnit, ...(isTop ? { color:"#666" } : {}) }}>{unit}</span>
            </span>
            {isTop && <span style={s.lTagTop}>Top Set</span>}
            {isBot && <span style={s.lTagBot}>Start</span>}
          </div>
        );
      })}
    </div>
  );
}

// Complex per-set list — fixed-width weight column
function ComplexSetList({ sets, unit }) {
  return (
    <div style={s.ladder}>
      {sets.map((set, i) => (
        <div key={i} style={{ ...s.ladderRow, ...s.lMid }}>
          <span style={s.lSetLabel}>Set {i + 1}</span>
          <span style={s.lReps}>{set.repCount} Reps</span>
          <span style={s.lWeightFixed}>
            {fmt(set.weight)}<span style={s.lUnit}>{unit}</span>
          </span>
          <span style={s.complexTag}>ES{set.repCount}RM</span>
        </div>
      ))}
    </div>
  );
}

// Standard phase card
function PhaseCard({ phase, esRepMaxRaw, sets, targetReps, unit, micro }) {
  const topSetRaw     = esRepMaxRaw * (1 + phase.pct);
  const topSetDisplay = roundHalf(topSetRaw);
  const ladder        = buildLadder(topSetRaw, sets, micro);
  return (
    <div style={s.phaseCard}>
      <div style={s.phaseTop}>
        <div>
          <div style={s.phaseWeek}>{phase.label}</div>
          <div style={s.phaseTag}>{phase.tag}</div>
        </div>
        <div style={s.phasePct}>{phase.pctLabel}</div>
      </div>
      <div style={s.phaseTopSetRow}>
        Top set: <strong>{fmt(topSetDisplay)}{unit}</strong>
      </div>
      <Ladder steps={ladder} targetReps={targetReps} unit={unit} />
    </div>
  );
}

// Complex phase card
function ComplexPhaseCard({ phase, complexSets, unit, micro }) {
  const phasedSets = complexSets.map(set => ({
    repCount: set.repCount,
    weight: roundStep(set.weightRaw * (1 + phase.pct), micro),
  }));
  return (
    <div style={s.phaseCard}>
      <div style={s.phaseTop}>
        <div>
          <div style={s.phaseWeek}>{phase.label}</div>
          <div style={s.phaseTag}>{phase.tag}</div>
        </div>
        <div style={s.phasePct}>{phase.pctLabel}</div>
      </div>
      <ComplexSetList sets={phasedSets} unit={unit} />
    </div>
  );
}

// Complex input grid
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

// ── Main App ──────────────────────────────────────────────────────
export default function App() {
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

  const w  = parseFloat(weight);
  const r  = parseInt(topReps);
  const tr = parseInt(targetReps);
  const ts = parseInt(targetSets);

  const hasWeight  = w && w > 0;
  const hasReps    = r && r >= 1 && r <= 15;
  const hasTarget  = tr && tr >= 1 && tr <= 15;
  const hasSets    = ts && ts >= 2 && ts <= 12;

  const e1rmRaw      = (hasWeight && hasReps) ? calcE1RM(w, r) : null;
  const e1rmDisplay  = e1rmRaw ? roundDisplay(e1rmRaw) : null;

  const esRepMaxRaw     = (e1rmRaw && hasTarget) ? calcRepMax(e1rmRaw, tr) : null;
  const esRepMaxDisplay = esRepMaxRaw ? roundDisplay(esRepMaxRaw) : null;

  // Only build ladder when both sets AND reps entered
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

  const exLabel    = showCustom ? (customEx || "") : exercise;
  const hasStandardResults = !!esRepMaxDisplay;
  const hasResults = mode === "standard" ? hasStandardResults : hasComplex;

  // Phase plan needs sets for standard
  const canShowPhase = mode === "standard"
    ? (hasStandardResults && hasSets)
    : hasComplex;

  return (
    <div style={s.root}>
      <div style={s.wrap}>

        {/* HEADER */}
        <header style={s.header}>
          <div style={s.brand}>40X0 Training</div>
          <h1 style={s.title}>Training<br/>Calculator</h1>
          <p style={s.tagline}>ES1RM · Target Rep Max · Step Load · Phase Plan</p>
        </header>

        {/* ── STEP 1 ── */}
        <Section num="01" title="Estimated 1-Rep Max" show>
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
            <label style={s.label}>Reps Performed</label>
            <div style={s.repsWeightRow}>
              <input
                type="number" min="1" max="15" placeholder="5"
                value={topReps}
                onChange={e => setTopReps(e.target.value)}
                style={s.repsInput}
              />
              <span style={s.timesSymbol}>×</span>
              <input
                type="number" min="1" placeholder="100"
                value={weight}
                onChange={e => setWeight(e.target.value)}
                style={s.weightInput}
              />
              <span style={s.weightUnitLabel}>{unit}</span>
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

        {/* ── STEP 2: New Target Set × Reps ── */}
        <Section num="02" title="New Target Set × Reps" show={!!e1rmDisplay}>

          <div style={s.field}>
            <label style={s.label}>Rep Scheme Type</label>
            <Toggle
              value={mode}
              onChange={v => { setMode(v); setTargetReps(""); setTargetSets(""); }}
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

              {/* Sets × Reps inline */}
              <div style={s.field}>
                <label style={s.label}>Target Sets × Reps</label>
                <div style={s.repsWeightRow}>
                  <input
                    type="number" min="2" max="12" placeholder="Sets"
                    value={targetSets}
                    onChange={e => setTargetSets(e.target.value)}
                    style={s.repsInput}
                  />
                  <span style={s.timesSymbol}>×</span>
                  <input
                    type="number" min="1" max="15" placeholder="Reps"
                    value={targetReps}
                    onChange={e => setTargetReps(e.target.value)}
                    style={s.repsInput}
                  />
                </div>
              </div>

              {/* ES rep max result */}
              {esRepMaxDisplay && (
                <BigResult
                  label={`Estimated ${tr}-Rep Max`}
                  value={fmt(esRepMaxDisplay)}
                  unit={unit}
                />
              )}

              {/* Step loading — appears when both sets + reps entered */}
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

        {/* ── STEP 3: 3-Week Phase Plan ── */}
        <Section num="03" title="3-Week Phase Plan" show={canShowPhase}>
          {mode === "standard" && (
            <>
              <p style={s.desc}>
                Each week adjusts from your ES{tr}RM of <strong>{fmt(esRepMaxDisplay)}{unit}</strong>.
                Full step loading shown per week.
              </p>
              <div style={s.phaseGrid}>
                {PHASE.map(ph => (
                  <PhaseCard
                    key={ph.week}
                    phase={ph}
                    esRepMaxRaw={esRepMaxRaw}
                    sets={ts}
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
                Each week applies phase percentages to each set individually,
                based on its ES rep max.
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

  header: { marginBottom:44, paddingBottom:24, borderBottom:"2px solid #1A1A1A" },
  brand: { fontSize:11, letterSpacing:5, color:"#999", marginBottom:10, fontWeight:700, textTransform:"uppercase" },
  title: {
    fontFamily:"'Bebas Neue',sans-serif",
    fontSize:"clamp(52px,12vw,76px)", lineHeight:0.9,
    letterSpacing:2, color:"#1A1A1A", marginBottom:12,
  },
  tagline: { fontSize:11, color:"#bbb", letterSpacing:2, textTransform:"uppercase", fontWeight:600 },

  section: { borderTop:"1px solid #E8E8E8", paddingTop:32, paddingBottom:32 },
  sectionHead: { display:"flex", alignItems:"flex-start", gap:16, marginBottom:24 },
  sectionNumBig: {
    fontFamily:"'Bebas Neue',sans-serif",
    fontSize:72, lineHeight:0.82, letterSpacing:2,
    color:"#1A1A1A", flexShrink:0, userSelect:"none", marginTop:-4,
  },
  sectionTitle: {
    fontFamily:"'Bebas Neue',sans-serif",
    fontSize:26, letterSpacing:1.5, color:"#1A1A1A", paddingTop:12,
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

  repsWeightRow: { display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" },
  repsInput: {
    width:140, background:"#F8F8F8", border:"1.5px solid #E0E0E0",
    borderRadius:10, color:"#1A1A1A",
    fontSize:40, fontFamily:"'Bebas Neue',sans-serif",
    letterSpacing:2, padding:"10px 14px", textAlign:"center",
  },
  timesSymbol: {
    fontFamily:"'Bebas Neue',sans-serif",
    fontSize:32, color:"#ccc", letterSpacing:1, flexShrink:0,
  },
  weightInput: {
    width:150, background:"#F8F8F8", border:"1.5px solid #E0E0E0",
    borderRadius:10, color:"#1A1A1A",
    fontSize:40, fontFamily:"'Bebas Neue',sans-serif",
    letterSpacing:2, padding:"10px 14px",
  },
  weightUnitLabel: {
    fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:"#ccc", letterSpacing:2,
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
    padding:"13px 16px", borderBottom:"1px solid #F0F0F0", gap:8,
  },
  lTop: { background:"#1A1A1A", borderBottom:"none" },
  lMid: { background:"#FAFAFA" },
  lBot: { background:"#F0F0F0" },
  lSetLabel: {
    fontSize:10, letterSpacing:2, textTransform:"uppercase",
    color:"#bbb", width:46, flexShrink:0, fontWeight:700,
  },
  lReps: {
    fontSize:10, letterSpacing:2, textTransform:"uppercase",
    color:"#bbb", width:60, flexShrink:0, fontWeight:700,
  },
  // Fixed width so all numbers left-align to same position
  lWeightFixed: {
    fontFamily:"'Bebas Neue',sans-serif", fontSize:26,
    letterSpacing:1, color:"#1A1A1A",
    width:110, flexShrink:0,
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
    display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12,
  },
  phaseWeek: {
    fontFamily:"'Bebas Neue',sans-serif", fontSize:26, letterSpacing:2, color:"#1A1A1A",
  },
  phaseTag: {
    fontSize:10, letterSpacing:2, textTransform:"uppercase",
    color:"#bbb", fontWeight:700, marginTop:2,
  },
  phasePct: { fontSize:12, color:"#999", fontStyle:"italic", textAlign:"right" },
  phaseTopSetRow: {
    fontSize:13, color:"#666", marginBottom:14,
    padding:"8px 12px", background:"#EFEFEF", borderRadius:8, display:"inline-block",
  },

  footer: {
    textAlign:"center", marginTop:60, fontSize:10,
    letterSpacing:5, color:"#ddd", textTransform:"uppercase", fontWeight:700,
  },
};
