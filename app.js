const WX_COLOR_VAR = { '木': '--wood', '火': '--fire', '土': '--earth', '金': '--metal', '水': '--water' };
const PILLAR_LABEL = { year: '年柱', month: '月柱', day: '日柱', hour: '时柱' };
// 四柱在罗盘上的方位角（度，0=正右，顺时针），对应 上(年) 右(月) 下(日) 左(时)
const PILLAR_ANGLE = { year: -90, month: 0, day: 90, hour: 180 };

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function polarToXY(cx, cy, r, angleDeg) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function sectorPath(cx, cy, rInner, rOuter, startAngle, endAngle) {
  const p1 = polarToXY(cx, cy, rOuter, startAngle);
  const p2 = polarToXY(cx, cy, rOuter, endAngle);
  const p3 = polarToXY(cx, cy, rInner, endAngle);
  const p4 = polarToXY(cx, cy, rInner, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${p4.x} ${p4.y}`,
    'Z'
  ].join(' ');
}

function ringSectorPath(cx, cy, r, startAngle, endAngle, width) {
  return sectorPath(cx, cy, r - width, r, startAngle, endAngle);
}

function svgEl(tag, attrs, text) {
  const ns = 'http://www.w3.org/2000/svg';
  const el = document.createElementNS(ns, tag);
  Object.entries(attrs || {}).forEach(([k, v]) => el.setAttribute(k, v));
  if (text !== undefined) el.textContent = text;
  return el;
}

function buildDefs(svg) {
  const defs = svgEl('defs', {});

  const bgGlow = svgEl('radialGradient', { id: 'bgGlowBlue', cx: '72%', cy: '22%', r: '65%' });
  bgGlow.appendChild(svgEl('stop', { offset: '0%', 'stop-color': cssVar('--glow-blue'), 'stop-opacity': 0.35 }));
  bgGlow.appendChild(svgEl('stop', { offset: '100%', 'stop-color': cssVar('--glow-blue'), 'stop-opacity': 0 }));
  defs.appendChild(bgGlow);

  const bgGlow2 = svgEl('radialGradient', { id: 'bgGlowPink', cx: '22%', cy: '80%', r: '65%' });
  bgGlow2.appendChild(svgEl('stop', { offset: '0%', 'stop-color': cssVar('--glow-pink'), 'stop-opacity': 0.3 }));
  bgGlow2.appendChild(svgEl('stop', { offset: '100%', 'stop-color': cssVar('--glow-pink'), 'stop-opacity': 0 }));
  defs.appendChild(bgGlow2);

  const disc = svgEl('radialGradient', { id: 'discFill', cx: '50%', cy: '50%', r: '50%' });
  disc.appendChild(svgEl('stop', { offset: '0%', 'stop-color': '#141225' }));
  disc.appendChild(svgEl('stop', { offset: '78%', 'stop-color': '#0c0b18' }));
  disc.appendChild(svgEl('stop', { offset: '100%', 'stop-color': '#050408' }));
  defs.appendChild(disc);

  const knob = svgEl('radialGradient', { id: 'centerKnob', cx: '38%', cy: '32%', r: '70%' });
  knob.appendChild(svgEl('stop', { offset: '0%', 'stop-color': '#f6dfab' }));
  knob.appendChild(svgEl('stop', { offset: '35%', 'stop-color': cssVar('--accent') }));
  knob.appendChild(svgEl('stop', { offset: '75%', 'stop-color': '#7a4c22' }));
  knob.appendChild(svgEl('stop', { offset: '100%', 'stop-color': '#2c1a0d' }));
  defs.appendChild(knob);

  const glow = svgEl('filter', { id: 'softGlow', x: '-60%', y: '-60%', width: '220%', height: '220%' });
  glow.appendChild(svgEl('feGaussianBlur', { stdDeviation: 4, result: 'blur' }));
  const merge = svgEl('feMerge', {});
  merge.appendChild(svgEl('feMergeNode', { in: 'blur' }));
  merge.appendChild(svgEl('feMergeNode', { in: 'SourceGraphic' }));
  glow.appendChild(merge);
  defs.appendChild(glow);

  svg.appendChild(defs);
}

function renderCompass(bazi) {
  const svg = document.getElementById('compass');
  svg.innerHTML = '';
  const cx = 260, cy = 260;
  const outerTickR = 250, ringOuterR = 235, ringInnerR = 210;
  const pillarOuterR = 205, pillarInnerR = 92;
  const centerR = 85;

  buildDefs(svg);

  // 底盘：深色圆盘 + 两团色彩辉光，呼应参考图的暗底渐变氛围
  svg.appendChild(svgEl('circle', { cx, cy, r: outerTickR + 4, fill: 'url(#discFill)' }));
  svg.appendChild(svgEl('circle', { cx, cy, r: outerTickR + 4, fill: 'url(#bgGlowBlue)' }));
  svg.appendChild(svgEl('circle', { cx, cy, r: outerTickR + 4, fill: 'url(#bgGlowPink)' }));

  // 外圈密集刻度（装饰，呼应参考图的细密刻度环）
  const tickGroup = svgEl('g', {});
  for (let i = 0; i < 72; i++) {
    const ang = i * 5;
    const long = i % 6 === 0;
    const p1 = polarToXY(cx, cy, outerTickR, ang);
    const p2 = polarToXY(cx, cy, outerTickR - (long ? 12 : 5), ang);
    tickGroup.appendChild(svgEl('line', {
      x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
      stroke: cssVar('--accent'), 'stroke-width': long ? 1.4 : 0.7,
      opacity: long ? 0.65 : 0.32
    }));
  }
  svg.appendChild(tickGroup);
  svg.appendChild(svgEl('circle', { cx, cy, r: outerTickR, fill: 'none', stroke: cssVar('--accent'), 'stroke-width': 1, opacity: 0.5 }));
  svg.appendChild(svgEl('circle', { cx, cy, r: ringOuterR + 4, fill: 'none', stroke: cssVar('--border'), 'stroke-width': 1, 'stroke-dasharray': '1 3' }));
  svg.appendChild(svgEl('circle', { cx, cy, r: pillarOuterR + 3, fill: 'none', stroke: cssVar('--border'), 'stroke-width': 1, 'stroke-dasharray': '1 3' }));

  // 五行分布环（带柔光）
  const total = bazi.wuxingScore.reduce((a, b) => a + b, 0) || 1;
  let angleCursor = -90;
  const wxKeys = ['木', '火', '土', '金', '水'];
  wxKeys.forEach((wx, i) => {
    const frac = bazi.wuxingScore[i] / total;
    const span = frac * 360;
    if (span > 0.5) {
      const path = ringSectorPath(cx, cy, ringOuterR, angleCursor, angleCursor + span, ringOuterR - ringInnerR);
      svg.appendChild(svgEl('path', { d: path, fill: cssVar(WX_COLOR_VAR[wx]), opacity: 0.9, filter: 'url(#softGlow)' }));
    }
    angleCursor += span;
  });
  svg.appendChild(svgEl('circle', { cx, cy, r: ringOuterR, fill: 'none', stroke: cssVar('--accent'), 'stroke-width': 0.8, opacity: 0.5 }));
  svg.appendChild(svgEl('circle', { cx, cy, r: ringInnerR, fill: 'none', stroke: cssVar('--accent'), 'stroke-width': 0.8, opacity: 0.5 }));

  // 四柱扇区背景 + 分隔线（暗色底 + 五行辉光描边）
  Object.keys(PILLAR_ANGLE).forEach(key => {
    const center = PILLAR_ANGLE[key];
    const start = center - 45, end = center + 45;
    const detail = bazi.detail.find(d => d.key === key);
    const wxName = ['木', '火', '土', '金', '水'][elementOfGan(detail.ganIdx)];
    const path = sectorPath(cx, cy, pillarInnerR, pillarOuterR, start, end);
    svg.appendChild(svgEl('path', {
      d: path, fill: cssVar(WX_COLOR_VAR[wxName]), opacity: 0.1
    }));
    svg.appendChild(svgEl('path', {
      d: path, fill: 'none', stroke: cssVar(WX_COLOR_VAR[wxName]), 'stroke-width': 1, opacity: 0.55
    }));
  });

  // 中心日主圆：玻璃光泽圆钮
  svg.appendChild(svgEl('circle', { cx, cy, r: centerR + 6, fill: 'none', stroke: cssVar('--accent'), 'stroke-width': 1, opacity: 0.4 }));
  svg.appendChild(svgEl('circle', { cx, cy, r: centerR, fill: 'url(#centerKnob)', stroke: cssVar('--accent'), 'stroke-width': 1.5 }));
  const dayDetail = bazi.detail.find(d => d.key === 'day');
  const dayWx = ['木', '火', '土', '金', '水'][elementOfGan(dayDetail.ganIdx)];
  svg.appendChild(svgEl('text', {
    x: cx, y: cy - 8, 'text-anchor': 'middle', 'font-size': 13, fill: '#2c1a0d', opacity: 0.75
  }, '日主'));
  svg.appendChild(svgEl('text', {
    x: cx, y: cy + 24, 'text-anchor': 'middle', 'font-size': 30, 'font-weight': 700,
    fill: '#2c1a0d'
  }, dayDetail.gan + dayDetail.zhi));

  // 四柱文字（直排显示，保持水平可读）
  Object.keys(PILLAR_ANGLE).forEach(key => {
    const detail = bazi.detail.find(d => d.key === key);
    const center = PILLAR_ANGLE[key];
    const textR = (pillarInnerR + pillarOuterR) / 2;
    const pos = polarToXY(cx, cy, textR, center);
    const wxName = ['木', '火', '土', '金', '水'][elementOfGan(detail.ganIdx)];
    const g = svgEl('g', {});
    g.appendChild(svgEl('text', {
      x: pos.x, y: pos.y - 26, 'text-anchor': 'middle', 'font-size': 12, fill: cssVar('--text-dim')
    }, PILLAR_LABEL[key]));
    g.appendChild(svgEl('text', {
      x: pos.x, y: pos.y + 6, 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 700,
      fill: cssVar(WX_COLOR_VAR[wxName]), filter: 'url(#softGlow)'
    }, detail.gan + detail.zhi));
    g.appendChild(svgEl('text', {
      x: pos.x, y: pos.y + 26, 'text-anchor': 'middle', 'font-size': 11, fill: cssVar('--text-dim')
    }, detail.shishenGan));
    if (key === 'year') {
      g.appendChild(svgEl('text', {
        x: pos.x, y: pos.y + 42, 'text-anchor': 'middle', 'font-size': 11, fill: cssVar('--text-dim')
      }, '生肖·' + detail.shengxiao));
    }
    svg.appendChild(g);
  });

  renderLegend(bazi);
}

function renderLegend(bazi) {
  const legend = document.getElementById('legend');
  const wxKeys = ['木', '火', '土', '金', '水'];
  const total = bazi.wuxingScore.reduce((a, b) => a + b, 0) || 1;
  legend.innerHTML = wxKeys.map((wx, i) => {
    const pct = ((bazi.wuxingScore[i] / total) * 100).toFixed(0);
    return `<span><i style="background:${cssVar(WX_COLOR_VAR[wx])}"></i>${wx} ${pct}%</span>`;
  }).join('');
}

function renderPillarTable(bazi) {
  const wrap = document.getElementById('pillarDetail');
  const order = ['year', 'month', 'day', 'hour'];
  let html = '<table><thead><tr><th></th>' +
    order.map(k => `<th>${PILLAR_LABEL[k]}</th>`).join('') + '</tr></thead><tbody>';

  html += '<tr><th>干支</th>' + order.map(k => {
    const d = bazi.detail.find(x => x.key === k);
    const wx = ['木', '火', '土', '金', '水'][elementOfGan(d.ganIdx)];
    return `<td class="ganzhi-big wx-${wx}">${d.gan}${d.zhi}</td>`;
  }).join('') + '</tr>';

  html += '<tr><th>五行</th>' + order.map(k => {
    const d = bazi.detail.find(x => x.key === k);
    const ganWx = ['木', '火', '土', '金', '水'][elementOfGan(d.ganIdx)];
    const zhiWx = ['木', '火', '土', '金', '水'][elementOfZhi(d.zhiIdx)];
    return `<td class="wx-pair"><b class="wx-${ganWx}">${ganWx}</b><span class="sep">/</span><b class="wx-${zhiWx}">${zhiWx}</b></td>`;
  }).join('') + '</tr>';

  html += '<tr><th>十神</th>' + order.map(k => {
    const d = bazi.detail.find(x => x.key === k);
    return `<td>${d.shishenGan}</td>`;
  }).join('') + '</tr>';

  html += '<tr><th>生肖</th>' + order.map(k => {
    const d = bazi.detail.find(x => x.key === k);
    return `<td>${d.shengxiao}</td>`;
  }).join('') + '</tr>';

  html += '<tr><th>藏干十神</th>' + order.map(k => {
    const d = bazi.detail.find(x => x.key === k);
    const list = d.shishenZhi.map(h => `${h.gan}(${h.shishen})${h.main ? '' : ''}`).join('<br>');
    return `<td class="hidden-list">${list}</td>`;
  }).join('') + '</tr>';

  html += '</tbody></table>';
  wrap.innerHTML = html;
  wrap.classList.remove('placeholder');
}

function renderStrength(bazi, strength) {
  const dayDetail = bazi.detail.find(d => d.key === 'day');
  const wxClass = 'wx-' + strength.dayWxName;

  const summaryEl = document.getElementById('strengthSummary');
  summaryEl.innerHTML = `<span class="badge">日主 ${dayDetail.gan}<b class="${wxClass}">(${strength.dayWxName})</b>
    <span class="level">${strength.level}</span></span>`;

  const supportPct = (strength.ratio * 100).toFixed(0);
  const drainPct = (100 - strength.ratio * 100).toFixed(0);
  const detailEl = document.getElementById('strengthDetail');
  detailEl.innerHTML = `
    <div>${strength.monthRelation}，帮扶(比劫+印) ${strength.support.toFixed(1)} 分
      ： 耗克(食伤+财+官杀) ${strength.drain.toFixed(1)} 分</div>
    <div class="bar">
      <div class="support" style="width:${supportPct}%"></div>
      <div class="drain" style="width:${drainPct}%"></div>
    </div>
    <div>旺衰为简化参考算法（五行得分 + 月令加权推算），实际断语还需结合通根深浅、组合关系等综合考量，仅供参考。</div>
  `;
}

function renderDayun(dayun, birthDate) {
  const wrap = document.getElementById('dayunTimeline');
  const now = new Date();
  const currentAge = now.getFullYear() - birthDate.getFullYear() -
    ((now.getMonth() < birthDate.getMonth() || (now.getMonth() === birthDate.getMonth() && now.getDate() < birthDate.getDate())) ? 1 : 0);

  const meta = document.createElement('div');
  meta.className = 'dayun-meta';
  meta.textContent = `${dayun.isForward ? '顺排' : '逆排'} · 起运约 ${dayun.startAgeYears} 岁 ${dayun.startAgeMonths} 个月`;

  const track = document.createElement('div');
  track.className = 'dayun-timeline';
  dayun.list.forEach(item => {
    const card = document.createElement('div');
    card.className = 'dayun-card';
    const endAge = item.startAge + 10;
    if (currentAge >= item.startAge && currentAge < endAge) card.classList.add('current');
    card.innerHTML = `<div class="gz">${item.gan}${item.zhi}</div><div class="age">${item.startAge}-${endAge - 1}岁</div><div class="age">${item.startYear}起</div>`;
    track.appendChild(card);
  });

  wrap.innerHTML = '';
  wrap.classList.remove('placeholder');
  wrap.appendChild(meta);
  wrap.appendChild(track);
}

// ---- 农历输入控件初始化 ----
const lunarMonthSelect = document.getElementById('lunarMonth');
const lunarDaySelect = document.getElementById('lunarDay');
const lunarLeapWrap = document.getElementById('lunarLeapWrap');
const lunarLeapCheckbox = document.getElementById('lunarLeap');
const lunarYearInput = document.getElementById('lunarYear');
const solarFields = document.getElementById('solarFields');
const lunarFields = document.getElementById('lunarFields');
const calendarConvertEl = document.getElementById('calendarConvert');
const birthDateInput = document.getElementById('birthDate');
const birthTimeInput = document.getElementById('birthTime');

LUNAR_MONTH_NAMES.forEach((name, i) => {
  const opt = document.createElement('option');
  opt.value = i + 1;
  opt.textContent = name;
  lunarMonthSelect.appendChild(opt);
});

function fillLunarDayOptions(maxDay) {
  const prev = lunarDaySelect.value;
  lunarDaySelect.innerHTML = '';
  for (let d = 1; d <= maxDay; d++) {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = lunarDayName(d);
    lunarDaySelect.appendChild(opt);
  }
  if (prev && Number(prev) <= maxDay) lunarDaySelect.value = prev;
}

function refreshLunarLeapAvailability() {
  const y = Number(lunarYearInput.value);
  const m = Number(lunarMonthSelect.value);
  if (!y || !m) { lunarLeapWrap.style.display = 'none'; return; }
  const leapMonth = getLeapMonthOfYear(y);
  if (leapMonth === m) {
    lunarLeapWrap.style.display = '';
  } else {
    lunarLeapWrap.style.display = 'none';
    lunarLeapCheckbox.checked = false;
  }
  refreshLunarDayCount();
}

function refreshLunarDayCount() {
  const y = Number(lunarYearInput.value);
  const m = Number(lunarMonthSelect.value);
  if (!y || !m) { fillLunarDayOptions(30); return; }
  const len = getLunarMonthLength(y, m, lunarLeapCheckbox.checked);
  fillLunarDayOptions(len || 30);
}

fillLunarDayOptions(30);

lunarYearInput.addEventListener('input', refreshLunarLeapAvailability);
lunarMonthSelect.addEventListener('change', refreshLunarLeapAvailability);
lunarLeapCheckbox.addEventListener('change', refreshLunarDayCount);

document.querySelectorAll('input[name="calendarMode"]').forEach(r => {
  r.addEventListener('change', () => {
    const mode = document.querySelector('input[name="calendarMode"]:checked').value;
    solarFields.style.display = mode === 'solar' ? '' : 'none';
    lunarFields.style.display = mode === 'lunar' ? '' : 'none';
    birthDateInput.required = mode === 'solar';
    updateCalendarConvertPreview();
  });
});

function getBirthDateFromForm() {
  const mode = document.querySelector('input[name="calendarMode"]:checked').value;
  const timeVal = birthTimeInput.value;
  const [hh, mm] = timeVal ? timeVal.split(':').map(Number) : [0, 0];

  if (mode === 'solar') {
    const dateVal = birthDateInput.value;
    if (!dateVal) return null;
    const [y, m, d] = dateVal.split('-').map(Number);
    return new Date(y, m - 1, d, hh, mm, 0);
  }

  const y = Number(lunarYearInput.value);
  const m = Number(lunarMonthSelect.value);
  const d = Number(lunarDaySelect.value);
  const isLeap = lunarLeapCheckbox.checked;
  if (!y || !m || !d) return null;
  return lunarToSolar(y, m, isLeap, d, hh, mm);
}

function updateCalendarConvertPreview() {
  const birthDate = getBirthDateFromForm();
  if (!birthDate) { calendarConvertEl.textContent = ''; return; }
  const mode = document.querySelector('input[name="calendarMode"]:checked').value;
  if (mode === 'solar') {
    calendarConvertEl.textContent = '对应' + formatLunar(birthDate).text;
  } else {
    const y = birthDate.getFullYear(), m = birthDate.getMonth() + 1, d = birthDate.getDate();
    calendarConvertEl.textContent = `对应公历 ${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
}

[birthDateInput, birthTimeInput, lunarYearInput, lunarMonthSelect, lunarDaySelect, lunarLeapCheckbox]
  .forEach(el => el.addEventListener('input', updateCalendarConvertPreview));

document.getElementById('baziForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const gender = document.querySelector('input[name="gender"]:checked').value;
  const birthDate = getBirthDateFromForm();
  if (!birthDate) {
    calendarConvertEl.textContent = '请完整填写出生日期（该农历年月日组合可能不存在，请检查闰月勾选是否正确）';
    return;
  }

  const bazi = calcBazi(birthDate, gender);
  const dayun = calcDayun(birthDate, gender, bazi.pillars.year, bazi.pillars.month);
  const strength = judgeStrength(bazi);

  renderCompass(bazi);
  renderPillarTable(bazi);
  renderStrength(bazi, strength);
  renderDayun(dayun, birthDate);
  updateCalendarConvertPreview();
});
