import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, data } = req.body;

  if (!to || !data) {
    return res.status(400).json({ error: 'Missing email or data' });
  }

  const fmt = (n) => {
    if (n === undefined || n === null || isNaN(n)) return '—';
    return n % 1 === 0 ? String(n) : Number(n).toFixed(1);
  };

  const fmtGap = (n) => {
    if (n === null || n === undefined || isNaN(n)) return '—';
    const pct = (n * 100).toFixed(1);
    return (n >= 0 ? '+' : '') + pct + '%';
  };

  const fmtRatioPct = (n) => {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return (n * 100).toFixed(1) + '%';
  };

  const gapColor = (gap, isMother) => {
    if (isMother || gap === null || gap === undefined) return '#bbb';
    if (gap >= 0) return '#4CAF50';
    if (gap > -0.05) return '#FF9800';
    return '#C0392B';
  };

  // ── Ladder rows ─────────────────────────────────────────────────
  const ladderRows = (steps, reps, unit) => steps.map((w, i) => {
    const isTop     = i === steps.length - 1;
    const isBot     = i === 0;
    const bg        = isTop ? '#1A1A1A' : isBot ? '#F0F0F0' : '#FAFAFA';
    const setColor  = isTop ? '#aaa' : '#bbb';
    const repsColor = isTop ? '#888' : '#bbb';
    const wColor    = isTop ? '#ffffff' : '#1A1A1A';
    const unitColor = isTop ? '#666' : '#bbb';
    const tagBg     = isTop ? '#333' : '#E0E0E0';
    const tagColor  = isTop ? '#888' : '#999';
    const tag       = isTop ? 'TOP SET' : isBot ? 'START' : '';
    return `
      <tr style="background:${bg};">
        <td style="padding:13px 16px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${setColor};font-weight:700;">SET ${i + 1}</td>
        <td style="padding:13px 8px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${repsColor};font-weight:700;">${reps} REPS</td>
        <td style="padding:13px 8px;font-size:22px;font-weight:900;color:${wColor};">${fmt(w)}<span style="font-size:12px;color:${unitColor};margin-left:3px;font-weight:400;">${unit}</span></td>
        <td style="padding:13px 16px;text-align:right;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:${tagColor};background:${tag ? tagBg : bg};font-weight:700;">${tag}</td>
      </tr>`;
  }).join('');

  // ── Week card ────────────────────────────────────────────────────
  const weekCard = (week, unit) => {
    const pctVal  = week.pctLabel || '';
    return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;border:1.5px solid #E8E8E8;border-radius:8px;overflow:hidden;">
      <col width="70"/><col width="80"/><col/><col width="80"/>
      <tr><td colspan="4" style="padding:0;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="padding:14px 16px;background:#F5F5F5;">
            <div style="font-size:22px;font-weight:900;color:#1A1A1A;text-transform:uppercase;letter-spacing:1px;">${week.label}</div>
            <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#bbb;font-weight:700;margin-top:3px;">${week.tag}</div>
          </td>
          <td style="padding:14px 16px;background:#F5F5F5;text-align:right;vertical-align:middle;">
            <span style="font-size:12px;color:#999;font-style:italic;white-space:nowrap;">${pctVal}</span>
          </td>
        </tr></table>
      </td></tr>
      <tr><td colspan="4" style="padding:9px 16px;background:#EFEFEF;font-size:13px;color:#666;">
        Top set: <strong style="color:#1A1A1A;">${fmt(week.topSet)}${unit}</strong> &nbsp;·&nbsp; ${week.sets} sets
      </td></tr>
      ${ladderRows(week.ladder, week.reps, unit)}
    </table>`;
  };

  // ── Single exercise block ────────────────────────────────────────
  const exerciseBlock = (ex, index, total) => {
    const unit       = ex.unit || data.unit || 'lbs';
    const exLabel    = ex.exercise || null;
    const hasLadder  = ex.ladder && ex.ladder.length > 0;
    const hasPhase   = ex.weeks && ex.weeks.length > 0 && ex.weeks.some(w => w.ladder && w.ladder.length > 0);
    const headerNum  = total > 1 ? `EXERCISE ${index + 1}` : null;

    return `
    ${headerNum ? `
    <tr><td style="background:#2A2A2A;padding:10px 40px;">
      <span style="font-size:10px;letter-spacing:4px;text-transform:uppercase;color:#666;font-weight:700;">${headerNum}</span>
    </td></tr>` : ''}

    <tr><td style="background:#111;padding:12px 40px;">
      <span style="font-size:11px;color:#666;letter-spacing:1px;">
        ${exLabel ? exLabel + ' &nbsp;·&nbsp; ' : ''}${fmt(ex.weight)}${unit} × ${ex.topReps} reps &nbsp;·&nbsp; Micro plates: ${ex.micro ? 'Yes' : 'No'}
      </span>
    </td></tr>

    <tr><td style="background:#fff;padding:32px 40px 24px;border-bottom:1px solid #EFEFEF;">
      ${exLabel ? `<div style="font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#bbb;font-weight:700;margin-bottom:4px;">${exLabel}</div>` : ''}
      <div style="font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#bbb;font-weight:700;margin-bottom:6px;">Estimated 1-Rep Max</div>
      <div style="font-size:64px;font-weight:900;color:#1A1A1A;line-height:1;letter-spacing:1px;">${fmt(ex.e1rm)}<span style="font-size:22px;color:#ccc;margin-left:6px;font-weight:400;">${unit}</span></div>
    </td></tr>

    ${ex.esRepMax ? `
    <tr><td style="background:#fff;padding:24px 40px;border-bottom:1px solid #EFEFEF;">
      <div style="font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#bbb;font-weight:700;margin-bottom:6px;">Estimated ${ex.targetReps}-Rep Max</div>
      <div style="font-size:64px;font-weight:900;color:#1A1A1A;line-height:1;letter-spacing:1px;">${fmt(ex.esRepMax)}<span style="font-size:22px;color:#ccc;margin-left:6px;font-weight:400;">${unit}</span></div>
    </td></tr>` : ''}

    ${hasLadder ? `
    <tr><td style="background:#fff;padding:24px 40px;border-bottom:1px solid #EFEFEF;">
      <div style="font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#bbb;font-weight:700;margin-bottom:16px;">Step Loading — ${ex.ladder.length} Sets × ${ex.targetReps} Reps</div>
      <table width="100%" cellpadding="0" cellspacing="0">
        <col width="70"/><col width="80"/><col/><col width="80"/>
        ${ladderRows(ex.ladder, ex.targetReps, unit)}
      </table>
    </td></tr>` : ''}

    ${hasPhase ? `
    <tr><td style="background:#fff;padding:24px 40px;border-bottom:2px solid #EFEFEF;">
      <div style="font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#bbb;font-weight:700;margin-bottom:16px;">3-Week Phase Plan</div>
      ${ex.weeks.map(w => weekCard(w, unit)).join('')}
    </td></tr>` : ''}`;
  };

  // ── Limiting lift group ──────────────────────────────────────────
  const liftGroupHTML = (lifts, groupLabel, limitingName, allOnTarget, unit) => `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;border:1.5px solid #E8E8E8;border-radius:8px;overflow:hidden;">
      <col/><col width="90"/><col width="80"/><col width="75"/><col width="70"/>
      <tr><td colspan="5" style="padding:0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#555;"><tr>
          <td style="padding:13px 16px;background:#555;">
            <span style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#fff;font-weight:700;">${groupLabel}</span>
          </td>
          <td style="padding:13px 16px;background:#555;text-align:right;">
            <span style="font-size:12px;color:${allOnTarget ? '#fff' : '#FFD580'};font-weight:700;white-space:nowrap;">
              ${allOnTarget ? 'All ratios on target' : 'Limiting: ' + limitingName}
            </span>
          </td>
        </tr></table>
      </td></tr>
      <tr style="background:#F0F0F0;">
        <td style="padding:8px 16px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#aaa;font-weight:700;">LIFT</td>
        <td style="padding:8px 8px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#aaa;font-weight:700;text-align:right;">ES1RM</td>
        <td style="padding:8px 8px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#aaa;font-weight:700;text-align:right;">ACTUAL</td>
        <td style="padding:8px 8px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#aaa;font-weight:700;text-align:right;">TARGET</td>
        <td style="padding:8px 16px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#aaa;font-weight:700;text-align:right;">GAP</td>
      </tr>
      ${lifts.map(lift => {
        if (!lift.e1rm) return '';
        const isMother   = !lift.motherKey;
        const isLimiting = !!lift.isLimiting;
        const rowBg      = isLimiting ? '#FFF0F0' : isMother ? '#F8F8F8' : '#FAFAFA';
        const textColor  = isLimiting ? '#C0392B' : '#1A1A1A';
        const gc         = gapColor(lift.gap, isMother);
        return `
        <tr style="background:${rowBg};">
          <td style="padding:12px 16px;font-size:13px;font-weight:${isLimiting ? 700 : 600};color:${textColor};">${lift.label}</td>
          <td style="padding:12px 8px;font-size:15px;font-weight:900;color:${textColor};text-align:right;white-space:nowrap;">${fmt(lift.e1rm)}<span style="font-size:10px;color:${isLimiting ? '#e88' : '#bbb'};margin-left:2px;font-weight:400;">${unit}</span></td>
          <td style="padding:12px 8px;font-size:13px;font-weight:${isMother ? 400 : 600};color:${isMother ? '#bbb' : textColor};text-align:right;">${isMother ? '—' : fmtRatioPct(lift.actualRatio)}</td>
          <td style="padding:12px 8px;font-size:13px;color:${isMother ? '#bbb' : isLimiting ? '#C0392B' : '#bbb'};text-align:right;">${isMother ? '—' : fmtRatioPct(lift.targetRatio)}</td>
          <td style="padding:12px 16px;font-size:13px;font-weight:700;color:${gc};text-align:right;">${isMother ? '—' : fmtGap(lift.gap)}</td>
        </tr>`;
      }).join('')}
    </table>`;

  // ── Resolve exercises array ──────────────────────────────────────
  // Supports both new format (data.exercises[]) and old single-exercise format
  const exercises = data.exercises && data.exercises.length > 0
    ? data.exercises
    : [{
        exercise:   data.exercise,
        weight:     data.weight,
        topReps:    data.topReps,
        unit:       data.unit,
        micro:      data.micro,
        e1rm:       data.e1rm,
        esRepMax:   data.esRepMax,
        targetReps: data.targetReps,
        targetSets: data.targetSets,
        ladder:     data.ladder || [],
        weeks:      data.weeks  || [],
      }];

  const llResults  = data.llResults || [];
  const upperLifts = llResults.filter(r => r.group === 'upper');
  const lowerLifts = llResults.filter(r => r.group === 'lower');
  const upperLimiting = upperLifts.find(r => r.isLimiting);
  const lowerLimiting = lowerLifts.find(r => r.isLimiting);
  const upperHasData  = upperLifts.some(r => r.e1rm);
  const lowerHasData  = lowerLifts.some(r => r.e1rm);
  const llUnit        = (exercises[0] && exercises[0].unit) || data.unit || 'lbs';

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#F2F2F2;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F2F2F2;padding:40px 0;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">

  <!-- HEADER -->
  <tr><td style="background:#1A1A1A;padding:36px 40px 28px;">
    <div style="font-size:10px;letter-spacing:5px;color:#666;text-transform:uppercase;font-weight:700;margin-bottom:10px;">40X0 TRAINING</div>
    <div style="font-size:48px;line-height:0.9;letter-spacing:2px;color:#fff;font-weight:900;text-transform:uppercase;margin-bottom:14px;">YOUR TRAINING<br/>RESULTS</div>
    <div style="font-size:11px;letter-spacing:2px;color:#555;text-transform:uppercase;font-weight:600;">ES1RM · Target Rep Max · Step Load · Phase Plan</div>
  </td></tr>

  <!-- EXERCISE BLOCKS -->
  ${exercises.map((ex, i) => exerciseBlock(ex, i, exercises.length)).join('')}

  <!-- LIMITING LIFT -->
  ${(upperHasData || lowerHasData) ? `
  <tr><td style="background:#fff;padding:24px 40px;">
    <div style="font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#bbb;font-weight:700;margin-bottom:16px;">Limiting Lift Analysis</div>
    ${upperHasData ? liftGroupHTML(upperLifts, 'Upper Body', upperLimiting ? upperLimiting.label : '', !upperLimiting, llUnit) : ''}
    ${lowerHasData ? liftGroupHTML(lowerLifts, 'Lower Body', lowerLimiting ? lowerLimiting.label : '', !lowerLimiting, llUnit) : ''}
  </td></tr>` : ''}

  <!-- FOOTER -->
  <tr><td style="background:#1A1A1A;padding:24px 40px;text-align:center;">
    <div style="font-size:10px;letter-spacing:5px;color:#444;text-transform:uppercase;font-weight:700;">40X0 TRAINING · MOVE BETTER</div>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  try {
    await resend.emails.send({
      from: 'aj@40x0training.com',
      to,
      subject: '40X0 Training — Your Results',
      html,
    });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to send email' });
  }
}
