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

// ── Rounding ──────────────────────────────────────────────────────
const roundHalf    = (n) => Math.round(n * 2) / 2;      // nearest 0.5 — ES1RM & rep max display
const roundNearest5 = (n) => Math.round(n / 5) * 5;     // nearest 5 — standard plates step loading
const roundWhole   = (n) => Math.round(n);               // nearest whole — micro plates step loading

function roundStep(val, micro) {
  return micro ? roundWhole(val) : roundNearest5(val);
}

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

function DropSelect({ label, value, onChange, options, hint }) {
  return (
    <div style={s.field}>
      {label && (
        <label style={s.label}>
          {label}{hint && <span style={s.hint}> {hint}</span>}
        </label>
      )}
      <div style={s.selectWrap}>
        <select value={value} onChange={e => onChange(Number(e.target.value))} style={s.select}>
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <span style={s.selectArrow}>▾</span>
      </div>
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

function Ladder({ steps, unit }) {
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
            <span style={{ ...s.lWeight, ...(isTop ? { color:"#fff" } : {}) }}>
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

function PhaseCard({ phase, esRepMaxRaw, sets, unit, micro }) {
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
      <Ladder steps={ladder} unit={unit} />
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────
export default function App() {
  const [weight,     setWeight]     = useState("");
  const [topReps,    setTopReps]    = useState(5);
  const [unit,       setUnit]       = useState("lbs");
  const [exercise,   setExercise]   = useState("");
  const [customEx,   setCustomEx]   = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [micro,      setMicro]      = useState(false);
  const [targetReps, setTargetReps] = useState(10);
  const [sets,       setSets]       = useState(5);

  const repOpts = Array.from({ length:15 }, (_, i) => ({
    value: i+1, label: `${i+1} rep${i > 0 ? "s" : ""}`,
  }));
  const setOpts = Array.from({ length:11 }, (_, i) => ({
    value: i+2, label: `${i+2} sets`,
  }));

  const w         = parseFloat(weight);
  const hasWeight = w && w > 0;

  const e1rmRaw      = hasWeight ? calcE1RM(w, topReps) : null;
  const esRepMaxRaw  = e1rmRaw   ? calcRepMax(e1rmRaw, targetReps) : null;

  const e1rmDisplay     = e1rmRaw     ? roundHalf(e1rmRaw)     : null;
  const esRepMaxDisplay = esRepMaxRaw ? roundHalf(esRepMaxRaw) : null;

  const ladder = esRepMaxRaw ? buildLadder(esRepMaxRaw, sets, micro) : null;

  const exLabel = showCustom ? (customEx || "") : exercise;

  return (
    <div style={s.root}>
      <div style={s.wrap}>

        {/* HEADER */}
        <header style={s.header}>
          <div style={s.brand}>40X0 Training</div>
          <h1 style={s.title}>Training<br/>Calculator</h1>
          <p style={s.tagline}>ES1RM · Target Rep Max · Step Load · Phase Plan</p>
        </header>

        {/* STEP 1 */}
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
                options={[{ value:"no", label:"No" }, { value:"yes", label:"Yes" }]}
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
            <label style={s.label}>Top Set Weight ({unit})</label>
            <div style={s.weightRow}>
              <input type="number" min="1" placeholder="e.g. 100"
                value={weight} onChange={e => setWeight(e.target.value)}
                style={s.weightInput} />
              <span style={s.weightUnitLabel}>{unit}</span>
            </div>
          </div>

          <DropSelect
            label="Reps Performed"
            value={topReps}
            onChange={setTopReps}
            options={repOpts}
          />

          {e1rmDisplay && (
            <BigResult
              sublabel={
                exLabel
                  ? `${exLabel} · ${fmt(w)}${unit} × ${topReps} rep${topReps > 1 ? "s" : ""}`
                  : `${fmt(w)}${unit} × ${topReps} rep${topReps > 1 ? "s" : ""}`
              }
              label="Estimated 1-Rep Max"
              value={fmt(e1rmDisplay)}
              unit={unit}
            />
          )}
        </Section>

        {/* STEP 2 */}
        <Section num="02" title="Target Rep Max" show={!!e1rmDisplay}>
          <p style={s.desc}>
            Using your <strong>{fmt(e1rmDisplay)}{unit}</strong> ES1RM — select your target reps.
          </p>
          <DropSelect
            label="Target Reps"
            value={targetReps}
            onChange={setTargetReps}
            options={repOpts}
          />
          {esRepMaxDisplay && (
            <BigResult
              label={`Estimated ${targetReps}-Rep Max`}
              value={fmt(esRepMaxDisplay)}
              unit={unit}
            />
          )}
        </Section>

        {/* STEP 3 */}
        <Section num="03" title="Step Loading" show={!!esRepMaxDisplay}>
          <p style={s.desc}>
            Your ES{targetReps}RM is <strong>{fmt(esRepMaxDisplay)}{unit}</strong>.
            Select your sets to build the loading ladder.
          </p>
          <DropSelect
            label="Number of Sets"
            value={sets}
            onChange={setSets}
            options={setOpts}
          />
          {ladder && (
            <>
              <div style={s.ladderMeta}>
                Spread: <strong>{Math.round((STEP_PCT[sets] ?? 0.10) * 100)}%</strong>
                {" · "}Bottom set: <strong>{fmt(ladder[0])}{unit}</strong>
                {" · "}Top set: <strong>{fmt(ladder[ladder.length - 1])}{unit}</strong>
              </div>
              <Ladder steps={ladder} unit={unit} />
            </>
          )}
        </Section>

        {/* STEP 4 */}
        <Section num="04" title="3-Week Phase Plan" show={!!esRepMaxDisplay}>
          <p style={s.desc}>
            Each week adjusts from your ES{targetReps}RM of <strong>{fmt(esRepMaxDisplay)}{unit}</strong>.
            Full step loading shown per week.
          </p>
          <div style={s.phaseGrid}>
            {PHASE.map(ph => (
              <PhaseCard
                key={ph.week}
                phase={ph}
                esRepMaxRaw={esRepMaxRaw}
                sets={sets}
                unit={unit}
                micro={micro}
              />
            ))}
          </div>
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

  selectWrap: { position:"relative" },
  select: {
    width:"100%", background:"#F8F8F8", border:"1.5px solid #E0E0E0",
    borderRadius:10, color:"#1A1A1A", fontSize:16,
    padding:"13px 40px 13px 14px",
    fontFamily:"'Barlow',sans-serif", fontWeight:500, cursor:"pointer",
  },
  selectArrow: {
    position:"absolute", right:14, top:"50%",
    transform:"translateY(-50%)", color:"#bbb", fontSize:14, pointerEvents:"none",
  },

  exGrid: { display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:5 },
  exBtn: {
    background:"#F8F8F8", border:"1.5px solid #E8E8E8",
    color:"#888", padding:"8px 4px", borderRadius:7,
    fontSize:10.5, fontWeight:600, textAlign:"center",
    transition:"all 0.13s", lineHeight:1.3,
  },
  exBtnOn: { background:"#1A1A1A", borderColor:"#1A1A1A", color:"#fff" },

  weightRow: { display:"flex", alignItems:"center", gap:10 },
  weightInput: {
    width:170, background:"#F8F8F8", border:"1.5px solid #E0E0E0",
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
    fontSize:12, letterSpacing:5, color:"#bbb", marginBottom:4,
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
    padding:"14px 16px", borderBottom:"1px solid #F0F0F0", gap:12,
  },
  lTop: { background:"#1A1A1A", borderBottom:"none" },
  lMid: { background:"#FAFAFA" },
  lBot: { background:"#F0F0F0" },
  lSetLabel: {
    fontSize:10, letterSpacing:2, textTransform:"uppercase",
    color:"#bbb", width:52, flexShrink:0, fontWeight:700,
  },
  lWeight: {
    fontFamily:"'Bebas Neue',sans-serif", fontSize:28, letterSpacing:1, color:"#1A1A1A", flex:1,
  },
  lUnit: { fontSize:14, marginLeft:2, color:"#bbb" },
  lTagTop: {
    fontSize:10, letterSpacing:1.5, textTransform:"uppercase",
    color:"#888", background:"#333", padding:"3px 8px", borderRadius:4, fontWeight:700,
  },
  lTagBot: {
    fontSize:10, letterSpacing:1.5, textTransform:"uppercase",
    color:"#666", background:"#E0E0E0", padding:"3px 8px", borderRadius:4, fontWeight:700,
  },

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
  phaseTag: { fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"#bbb", fontWeight:700, marginTop:2 },
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
