import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// ── Palette (matches the app's grey and bone) ─────────────────────
const C = {
  page:    '#2F2E2C',
  bg:      '#3B3A38',
  surface: '#464542',
  row:     '#42413E',
  line:    '#5A5855',
  bone:    '#E8E1D3',
  boneDim: '#C9C2B4',
  muted:   '#A39C8F',
  faint:   '#7E786D',
  ink:     '#2E2D2B',
  warm:    '#9D9990',
  limRow:  '#4C3B37',
  limTag:  '#5C3F39',
  limText: '#F2B3A8',
  good:    '#9CC98A',
  warn:    '#E3B062',
  bad:     '#E8877A',
};
const DISPLAY = "'Bebas Neue','Oswald','Arial Narrow',Arial,sans-serif";
const BODY    = "'Barlow','Helvetica Neue',Helvetica,Arial,sans-serif";

// Escape anything typed by a person before it goes into the email
const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const repWord = (n) => (Number(n) === 1 ? '1 rep' : `${esc(n)} reps`);
const label = (txt, color = C.muted) =>
  `<div style="font-family:${BODY};font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:${color};font-weight:700;">${txt}</div>`;

// ── One exercise ──────────────────────────────────────────────────
function exerciseBlock(ex, index, total) {
  const u = esc(ex.unit);
  const weeks = Array.isArray(ex.weeks) ? ex.weeks : [];
  const std = ex.mode === 'standard';
  const cols = weeks.length;
  const cellW = cols ? Math.floor(440 / cols) : 0;

  const cell = (content, bg, color, extra = '') =>
    `<td align="center" style="background:${bg};color:${color};border-radius:6px;padding:9px 2px;font-family:${DISPLAY};font-size:20px;letter-spacing:1px;${extra}">${content}</td>`;
  const sideCell = (top, bottom, bottomColor = C.faint) =>
    `<td align="center" style="padding:6px 2px;font-family:${BODY};font-size:10px;letter-spacing:1px;text-transform:uppercase;font-weight:700;color:${C.faint};white-space:nowrap;">${top}${bottom ? `<br/><span style="color:${bottomColor};">${bottom}</span>` : ''}</td>`;

  let grid = '';
  if (cols) {
    grid += `<tr><td width="70"></td>${weeks.map((w) => `
      <td width="${cellW}" align="center" style="background:${C.surface};border-radius:6px;padding:10px 2px;">
        <div style="font-family:${DISPLAY};font-size:20px;letter-spacing:1.5px;color:${C.bone};">${esc(w.label)}</div>
        <div style="font-family:${BODY};font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:${C.faint};font-weight:700;">${esc(w.tag)}</div>
        <div style="font-family:${BODY};font-size:13px;font-weight:700;color:${C.boneDim};margin-top:4px;">${esc(w.pct)}</div>
      </td>`).join('')}</tr>`;

    if (ex.showWarmups) {
      [0, 1, 2].forEach((j) => {
        const reps = weeks[0]?.warmups?.[j]?.reps;
        grid += `<tr>${sideCell(`WU ${j + 1}`, reps ? repWord(reps) : '')}${weeks.map((w) =>
          cell(`${esc(w.warmups?.[j]?.load)}<span style="font-size:11px;color:#4A4844;"> ${u}</span>`, C.warm, C.ink)).join('')}</tr>`;
      });
    }

    const maxRows = Math.max(...weeks.map((w) => (w.rows || []).length));
    for (let i = 0; i < maxRows; i++) {
      const reps = weeks.find((w) => w.rows && w.rows[i])?.rows[i]?.reps;
      grid += `<tr>${sideCell(`Set ${i + 1}`, reps ? repWord(reps) : '', C.boneDim)}${weeks.map((w) => {
        const r = w.rows && w.rows[i];
        if (!r) return '<td></td>';
        return r.top
          ? cell(`${esc(r.load)}<span style="font-size:11px;color:#6A6458;"> ${u}</span><div style="font-family:${BODY};font-size:9px;letter-spacing:1.5px;font-weight:700;color:#5A554C;">TOP SET</div>`, C.bone, C.ink)
          : cell(`${esc(r.load)}<span style="font-size:11px;color:${C.faint};"> ${u}</span>`, C.row, C.bone);
      }).join('')}</tr>`;
    }

    if (ex.plates && Array.isArray(ex.plates.perWeek)) {
      grid += `<tr>${sideCell('Plates', esc(ex.plates.label))}${ex.plates.perWeek.map((p) =>
        `<td align="center" style="border:1px solid ${C.line};border-radius:6px;padding:8px 3px;font-family:${BODY};font-size:11px;line-height:1.35;color:${C.boneDim};">${esc(p)}</td>`).join('')}</tr>`;
    }
  }

  const notes = [];
  if (ex.plates) notes.push(`Plates are per side on a ${esc(ex.plates.bar)} bar${ex.plates.note ? ` (${esc(ex.plates.note)})` : ''}.`);
  if (ex.showWarmups) notes.push('Warm-up sets are intended for A-Series lifts only.');

  return `
  <tr><td style="padding:30px 32px 0;">
    ${total > 1 ? label(`Exercise ${index + 1}`) : ''}
    <div style="font-family:${DISPLAY};font-size:34px;line-height:1.05;letter-spacing:1.5px;color:${C.bone};margin-top:4px;">${esc(ex.title)}</div>
    <div style="font-family:${BODY};font-size:13px;color:${C.muted};margin-top:4px;">${esc(ex.source)} &nbsp;·&nbsp; Micro plates: ${ex.micro ? 'Yes' : 'No'}</div>
  </td></tr>

  <tr><td style="padding:16px 32px 0;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
      <td align="center" style="background:${C.surface};border:1px solid ${C.line};border-radius:14px;padding:18px 10px;">
        ${label('Estimated 1-rep max')}
        <div style="font-family:${DISPLAY};font-size:56px;line-height:1;letter-spacing:2px;color:${C.bone};margin-top:6px;">${esc(ex.e1rm)}<span style="font-size:20px;color:${C.faint};margin-left:4px;">${u}</span></div>
      </td>
      ${ex.repMax ? `<td width="12"></td>
      <td align="center" style="background:${C.surface};border:1px solid ${C.line};border-radius:14px;padding:18px 10px;">
        ${label(esc(ex.repMaxLabel))}
        <div style="font-family:${DISPLAY};font-size:56px;line-height:1;letter-spacing:2px;color:${C.bone};margin-top:6px;">${esc(ex.repMax)}<span style="font-size:20px;color:${C.faint};margin-left:4px;">${u}</span></div>
      </td>` : ''}
    </tr></table>
  </td></tr>

  ${ex.prescription || ex.stepLoading ? `
  <tr><td style="padding:14px 32px 0;font-family:${BODY};font-size:13px;color:${C.boneDim};">
    ${ex.stepLoading ? `General step loading: ${esc(ex.stepLoading)}` : esc(ex.prescription)}
  </td></tr>` : ''}

  ${cols ? `
  <tr><td style="padding:18px 32px 0;">
    ${label(`${cols} week phase plan`)}
    <table width="100%" cellpadding="0" cellspacing="4" role="presentation" style="margin-top:8px;border-collapse:separate;">${grid}</table>
    ${notes.length ? `<div style="font-family:${BODY};font-size:11px;font-style:italic;color:${C.faint};margin-top:8px;">${notes.join(' ')}</div>` : ''}
  </td></tr>` : ''}

  <tr><td style="padding:26px 32px 0;"><div style="height:1px;background:${C.line};line-height:1px;font-size:0;">&nbsp;</div></td></tr>`;
}

// ── Strength ratios ───────────────────────────────────────────────
function limitingBlock(lim) {
  const statusColor = { good: C.good, warn: C.warn, bad: C.bad, none: C.faint };
  const u = esc(lim.unit);
  const th = (t, align = 'center') =>
    `<td align="${align}" style="padding:6px 4px;font-family:${BODY};font-size:9px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;color:${C.muted};">${t}</td>`;

  const groups = (lim.groups || []).map((g) => `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${C.surface};border:1px solid ${C.line};border-radius:14px;margin-top:14px;">
      <tr><td style="padding:12px 14px;border-bottom:1px solid ${C.line};">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
          <td style="font-family:${DISPLAY};font-size:20px;letter-spacing:1.5px;color:${C.bone};">${esc(g.label)}</td>
          <td align="right">${g.limiting
            ? `<span style="background:${C.limTag};color:${C.limText};font-family:${BODY};font-size:10px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;padding:4px 8px;border-radius:6px;">Limiting: ${esc(g.limiting)}</span>`
            : `<span style="font-family:${BODY};font-size:11px;color:${C.good};font-weight:700;">All ratios on target</span>`}</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:4px 8px 8px;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:separate;border-spacing:0 3px;">
          <tr>${th('Lift', 'left')}${th(`1RM ${u}`)}${th('Actual')}${th('Target')}${th('Gap')}</tr>
          ${(g.rows || []).map((r) => {
            const bg = r.limiting ? C.limRow : 'transparent';
            const td = (content, color, extra = '') =>
              `<td align="center" style="background:${bg};padding:8px 4px;font-family:${DISPLAY};font-size:19px;letter-spacing:1px;color:${color};${extra}">${content}</td>`;
            return `<tr>
              <td style="background:${bg};padding:8px 6px;font-family:${BODY};font-size:13px;font-weight:700;color:${C.bone};border-radius:8px 0 0 8px;">${esc(r.label)}${r.mother ? `<div style="font-size:9px;letter-spacing:1px;color:${C.muted};text-transform:uppercase;">Mother lift</div>` : ''}</td>
              ${td(`${esc(r.e1rm)}${r.known ? `<div style="font-family:${BODY};font-size:9px;letter-spacing:1px;color:${C.faint};font-weight:700;">KNOWN</div>` : ''}`, C.bone)}
              ${td(esc(r.actual), C.bone)}
              ${td(esc(r.target), C.faint)}
              ${td(esc(r.gap), statusColor[r.status] || C.faint, 'border-radius:0 8px 8px 0;')}
            </tr>`;
          }).join('')}
        </table>
      </td></tr>
    </table>`).join('');

  return `
  <tr><td style="padding:30px 32px 0;">
    <div style="font-family:${DISPLAY};font-size:34px;line-height:1.05;letter-spacing:1.5px;color:${C.bone};">Strength ratios</div>
    <div style="font-family:${BODY};font-size:13px;color:${C.muted};margin-top:4px;">How each lift compares to its mother lift. The limiting lift is the one furthest below target.</div>
    ${groups}
    <div style="font-family:${BODY};font-size:11px;color:${C.muted};margin-top:10px;">
      <span style="color:${C.good};">■</span> At or above target &nbsp;&nbsp;
      <span style="color:${C.warn};">■</span> Within 5% below &nbsp;&nbsp;
      <span style="color:${C.bad};">■</span> More than 5% below
    </div>
  </td></tr>`;
}

// ── Handler ───────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, data } = req.body || {};
  if (!to || !data || !/\S+@\S+\.\S+/.test(String(to))) {
    return res.status(400).json({ error: 'Missing email or data' });
  }

  const exercises = Array.isArray(data.exercises) ? data.exercises : [];
  const lim = data.limiting && Array.isArray(data.limiting.groups) && data.limiting.groups.length ? data.limiting : null;
  if (!exercises.length && !lim) {
    return res.status(400).json({ error: 'Nothing to send' });
  }

  const name = data.clientName ? esc(data.clientName) : '';
  const heading = name ? `${name},<br/>here's your training plan` : 'Your training plan';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<meta name="color-scheme" content="dark"/>
<meta name="supported-color-schemes" content="dark"/>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@400;600;700&display=swap" rel="stylesheet"/>
</head>
<body style="margin:0;padding:0;background:${C.page};">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${C.page};padding:28px 0;">
<tr><td align="center" style="padding:0 10px;">
<table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background:${C.bg};border-radius:16px;">

  <tr><td style="padding:34px 32px 24px;border-bottom:1px solid ${C.line};">
    ${label('40X0 Training', C.muted)}
    <div style="font-family:${DISPLAY};font-size:46px;line-height:0.95;letter-spacing:2px;color:${C.bone};margin-top:10px;">${heading}</div>
    <div style="font-family:${BODY};font-size:10px;letter-spacing:2px;text-transform:uppercase;font-weight:700;color:${C.faint};margin-top:12px;">
      ${exercises.length ? 'ES1RM · Target rep max · Phase plan' : ''}${exercises.length && lim ? ' · ' : ''}${lim ? 'Strength ratios' : ''}
    </div>
  </td></tr>

  ${exercises.map((ex, i) => exerciseBlock(ex, i, exercises.length)).join('')}

  ${lim ? limitingBlock(lim) : ''}

  <tr><td style="padding:34px 32px 30px;" align="center">
    <div style="font-family:${BODY};font-size:10px;letter-spacing:5px;text-transform:uppercase;font-weight:700;color:${C.faint};">40X0 Training · Move Better</div>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  try {
    await resend.emails.send({
      from: 'aj@40x0training.com',
      to: String(to).trim(),
      subject: name ? `${String(data.clientName).replace(/[\r\n]+/g, ' ').slice(0, 60)}, your 40X0 Training plan` : 'Your 40X0 Training plan',
      html,
    });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to send email' });
  }
}
