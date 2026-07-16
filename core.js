/*
 * 八字命盘核心计算引擎
 * 不依赖农历查表，只用公历日期 + 节气天文近似公式推算四柱，
 * 避免手抄农历数据表带来的错误风险。
 */

const TIANGAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const DIZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const WUXING_NAMES = ['木', '火', '土', '金', '水'];
const SHENGXIAO = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];

// 24 节气名称，n=0 对应小寒，按公历顺序排列
const JIEQI_NAMES = [
  '小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨',
  '立夏', '小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑',
  '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至'
];

// 节气偏移表（分钟），源自通用天文近似算法，1900-2100 年误差通常在 1 天以内
const S_TERM_INFO = [
  0, 21208, 42467, 63836, 85337, 107014, 128867, 150921, 173149, 195551,
  218072, 240693, 263343, 285989, 308563, 331033, 353350, 375494, 397447,
  419210, 440795, 462224, 483532, 504758
];

// 计算某年第 n 个节气（n: 0-23）对应的北京时间
// 说明：算法本身以"名义 UTC 字段"承载北京时间数值（业界通行写法），
// 这里统一转换为"本地字段等值"的 Date 对象，使其可以直接与
// 用户输入的出生时间（同样按本地字段构造，代表北京时间）比较大小，
// 从而与运行环境的实际系统时区无关，避免出现时区错位。
function getJieqiDate(year, n) {
  const base = Date.UTC(1900, 0, 6, 2, 5, 0);
  const ms = base + 31556925974.7 * (year - 1900) + S_TERM_INFO[n] * 60000;
  const u = new Date(ms);
  return new Date(
    u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate(),
    u.getUTCHours(), u.getUTCMinutes(), u.getUTCSeconds()
  );
}

/* ------------------------------------------------------------------
 * 农历转换（用于展示，不参与八字排盘计算）
 * 八字排盘本身只依赖节气（见上），与农历无关；这里额外实现公历<->农历
 * 转换，方便用户核对/输入农历生日。采用 Meeus《天文算法》的朔望月近似
 * 公式现算新月时刻，而不是手抄一份 1900-2100 年农历数据表，
 * 避免手抄表格出错的风险，计算依据可查证、可复核。
 * ------------------------------------------------------------------ */

const LUNAR_MONTH_NAMES = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '腊月'];

// 中气：24节气中偶数序号为"节"，奇数序号为"气"（中气），冬至(n=23)属中气
function isZhongqiIndex(n) {
  return n % 2 === 1;
}

// 将"本地字段代表北京时间"的 Date 转换为真实儒略日（UT 基准）
function dateToJD(date) {
  let Y = date.getFullYear();
  let M = date.getMonth() + 1;
  const D = date.getDate() +
    (date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600) / 24
    - 8 / 24; // 扣除北京时间与 UT 的 8 小时差
  if (M <= 2) { Y -= 1; M += 12; }
  const A = Math.floor(Y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (Y + 4716)) + Math.floor(30.6001 * (M + 1)) + D + B - 1524.5;
}

// 儒略日（真实 UT 基准）转换为"本地字段代表北京时间"的 Date
function jdToDate(jd) {
  const jdB = jd + 8 / 24; // 转为北京时间名义儒略日
  const Z = Math.floor(jdB + 0.5);
  const F = jdB + 0.5 - Z;
  let A = Z;
  if (Z >= 2299161) {
    const alpha = Math.floor((Z - 1867216.25) / 36524.25);
    A = Z + 1 + alpha - Math.floor(alpha / 4);
  }
  const B = A + 1524;
  const C = Math.floor((B - 122.1) / 365.25);
  const D = Math.floor(365.25 * C);
  const E = Math.floor((B - D) / 30.6001);
  const dayFrac = B - D - Math.floor(30.6001 * E) + F;
  const day = Math.floor(dayFrac);
  const month = E < 14 ? E - 1 : E - 13;
  const year = month > 2 ? C - 4716 : C - 4715;
  const hoursFrac = (dayFrac - day) * 24;
  const hours = Math.floor(hoursFrac);
  const minutes = Math.floor((hoursFrac - hours) * 60);
  return new Date(year, month - 1, day, hours, minutes);
}

// 儒略日 -> 北京日历日序号（用于判定"同一天"，JD 以正午为界，+0.5 对齐到午夜）
function beijingDayNumber(jdUT) {
  return Math.floor(jdUT + 8 / 24 + 0.5);
}

// Meeus 朔望月近似公式，返回第 k 个新月（以 2000 年附近为 k=0）对应的真实儒略日（力学时，近似 UT）
function newMoonJD(k) {
  const T = k / 1236.85;
  const T2 = T * T, T3 = T2 * T, T4 = T3 * T;
  let jde = 2451550.09766 + 29.530588861 * k
    + 0.00015437 * T2 - 0.000000150 * T3 + 0.00000000073 * T4;

  const E = 1 - 0.002516 * T - 0.0000074 * T2;
  const D2R = Math.PI / 180;
  const M = (2.5534 + 29.10535669 * k - 0.0000014 * T2 - 0.00000011 * T3) * D2R;
  const Mp = (201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4) * D2R;
  const F = (160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4) * D2R;
  const Omega = (124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3) * D2R;

  jde += -0.40720 * Math.sin(Mp)
    + 0.17241 * E * Math.sin(M)
    + 0.01608 * Math.sin(2 * Mp)
    + 0.01039 * Math.sin(2 * F)
    + 0.00739 * E * Math.sin(Mp - M)
    - 0.00514 * E * Math.sin(Mp + M)
    + 0.00208 * E * E * Math.sin(2 * M)
    - 0.00111 * Math.sin(Mp - 2 * F)
    - 0.00057 * Math.sin(Mp + 2 * F)
    + 0.00056 * E * Math.sin(2 * Mp + M)
    - 0.00042 * Math.sin(3 * Mp)
    + 0.00042 * E * Math.sin(M + 2 * F)
    + 0.00038 * E * Math.sin(M - 2 * F)
    - 0.00024 * E * Math.sin(2 * Mp - M)
    - 0.00017 * Math.sin(Omega)
    - 0.00007 * Math.sin(Mp + 2 * M)
    + 0.00004 * Math.sin(2 * Mp - 2 * F)
    + 0.00004 * Math.sin(3 * M)
    + 0.00003 * Math.sin(Mp + M - 2 * F)
    + 0.00003 * Math.sin(2 * Mp + 2 * F)
    - 0.00003 * Math.sin(Mp + M + 2 * F)
    + 0.00003 * Math.sin(Mp - M + 2 * F)
    - 0.00002 * Math.sin(Mp - M - 2 * F)
    - 0.00002 * Math.sin(3 * Mp + M)
    + 0.00002 * Math.sin(4 * Mp);

  return jde;
}

function lunarDayName(d) {
  if (d === 20) return '二十';
  if (d === 30) return '三十';
  const tensChar = ['初', '十', '廿'][Math.floor((d - 1) / 10)];
  const numChar = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][(d - 1) % 10];
  return tensChar + numChar;
}

function findNewMoonK(targetJD) {
  const targetDay = beijingDayNumber(targetJD);
  let k = Math.floor((targetJD - 2451550.09766) / 29.530588861) - 1;
  while (beijingDayNumber(newMoonJD(k + 1)) <= targetDay) k++;
  while (beijingDayNumber(newMoonJD(k)) > targetDay) k--;
  return k;
}

/**
 * 给定跨越一次冬至到下一次冬至的区间 [dz1, dz2)，构建其间每个农历月
 * （以新月为月首）的月序号、是否闰月，用于公历<->农历互转共享。
 */
function buildLunarMonthList(dz1, dz2) {
  const k11 = findNewMoonK(dateToJD(dz1));
  const k11Next = findNewMoonK(dateToJD(dz2));
  const monthCount = k11Next - k11; // 12 或 13
  const y = dz1.getFullYear();

  let leapOffset = -1;
  if (monthCount === 13) {
    for (let off = 1; off < monthCount; off++) {
      const mStartDay = beijingDayNumber(newMoonJD(k11 + off));
      const mEndDay = beijingDayNumber(newMoonJD(k11 + off + 1));
      let hasZhongqi = false;
      for (let n = 1; n <= 23; n += 2) {
        for (const yy of [y - 1, y, y + 1, y + 2]) {
          const tDay = beijingDayNumber(dateToJD(getJieqiDate(yy, n)));
          if (tDay >= mStartDay && tDay < mEndDay) { hasZhongqi = true; break; }
        }
        if (hasZhongqi) break;
      }
      if (!hasZhongqi) { leapOffset = off; break; }
    }
  }

  const months = [];
  let monthNumber = 11, isLeap = false;
  for (let off = 0; off < monthCount; off++) {
    if (off === 0) { monthNumber = 11; isLeap = false; }
    else if (off === leapOffset) { isLeap = true; }
    else {
      isLeap = false;
      monthNumber = monthNumber === 12 ? 1 : monthNumber + 1;
    }
    months.push({ offset: off, monthNumber, isLeap, k: k11 + off });
  }
  return { k11, k11Next, monthCount, leapOffset, months };
}

/**
 * 公历 -> 农历
 * 返回 { lunarYear(以正月初一为界的农历年，用于查年干支), monthIndex(1-12), isLeap, day }
 */
function solarToLunar(date) {
  const jd = dateToJD(date);
  const targetDay = beijingDayNumber(jd);
  const k = findNewMoonK(jd);

  // 定位"上一个冬至"所在农历月（十一月）的新月起点，作为月序编号与闰月判定的锚点。
  // 注意：某农历月的新月起点可能比它所"包含"的冬至早半个月甚至更多，
  // 所以要按新月序号 k 区间来判断所属周期，不能直接拿 date 跟冬至日期比较
  // （否则在冬至前、但已进入下一周期十一月的那段时间会落入错误的周期）。
  const y = date.getFullYear();
  const anchors = [];
  for (let yy = y - 2; yy <= y + 1; yy++) {
    const dz = getJieqiDate(yy, 23);
    anchors.push({ dz, k: findNewMoonK(dateToJD(dz)) });
  }
  let idx = anchors.length - 2;
  for (let i = 0; i < anchors.length - 1; i++) {
    if (k >= anchors[i].k && k < anchors[i + 1].k) { idx = i; break; }
  }
  const dz1 = anchors[idx].dz, dz2 = anchors[idx + 1].dz;

  const table = buildLunarMonthList(dz1, dz2);
  const entry = table.months.find(m => m.k === k);
  const lunarYear = (entry.monthNumber === 11 || entry.monthNumber === 12) ? dz1.getFullYear() : dz2.getFullYear();
  const dayNumber = targetDay - beijingDayNumber(newMoonJD(k)) + 1;

  return {
    lunarYear,
    monthIndex: entry.monthNumber,
    isLeap: entry.isLeap,
    day: dayNumber
  };
}

/**
 * 农历 -> 公历
 * y: 农历年份（与 solarToLunar 返回的 lunarYear 同一含义，以正月初一为界）
 * monthNumber: 1-12，isLeap: 是否闰月，day: 农历日(1-30)，hour/minute: 用于拼回具体时刻
 * 若该年不存在对应的（月份+是否闰）组合，返回 null
 */
function lunarToSolar(y, monthNumber, isLeap, day, hour, minute) {
  let dz1, dz2;
  if (monthNumber === 11 || monthNumber === 12) {
    dz1 = getJieqiDate(y, 23);
    dz2 = getJieqiDate(y + 1, 23);
  } else {
    dz1 = getJieqiDate(y - 1, 23);
    dz2 = getJieqiDate(y, 23);
  }
  const table = buildLunarMonthList(dz1, dz2);
  const entry = table.months.find(m => m.monthNumber === monthNumber && m.isLeap === !!isLeap);
  if (!entry) return null;
  const targetJD = newMoonJD(entry.k) + (day - 1);
  const d = jdToDate(targetJD);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour || 0, minute || 0);
}

/** 查询某农历年（1-10月区间的常规含义）是否有闰月，返回月份号或 null */
function getLeapMonthOfYear(y) {
  const table = buildLunarMonthList(getJieqiDate(y - 1, 23), getJieqiDate(y, 23));
  const found = table.months.find(m => m.isLeap);
  return found ? found.monthNumber : null;
}

/** 某农历月的天数（29 或 30），组合不存在时返回 null */
function getLunarMonthLength(y, monthNumber, isLeap) {
  let dz1, dz2;
  if (monthNumber === 11 || monthNumber === 12) {
    dz1 = getJieqiDate(y, 23);
    dz2 = getJieqiDate(y + 1, 23);
  } else {
    dz1 = getJieqiDate(y - 1, 23);
    dz2 = getJieqiDate(y, 23);
  }
  const table = buildLunarMonthList(dz1, dz2);
  const entry = table.months.find(m => m.monthNumber === monthNumber && m.isLeap === !!isLeap);
  if (!entry) return null;
  return beijingDayNumber(newMoonJD(entry.k + 1)) - beijingDayNumber(newMoonJD(entry.k));
}

function formatLunar(date) {
  const l = solarToLunar(date);
  const yg = getYearGanzhi(l.lunarYear);
  const monthName = (l.isLeap ? '闰' : '') + LUNAR_MONTH_NAMES[l.monthIndex - 1];
  const dayName = lunarDayName(l.day);
  return {
    ...l,
    yearGanzhi: yg.gan + yg.zhi,
    shengxiao: SHENGXIAO[yg.zhiIdx],
    monthName,
    dayName,
    text: `农历${yg.gan}${yg.zhi}年${monthName}${dayName}`
  };
}

function elementOfGan(ganIdx) {
  return Math.floor(ganIdx / 2); // 0木 1火 2土 3金 4水
}
function yinyangOfGan(ganIdx) {
  return ganIdx % 2 === 0 ? '阳' : '阴';
}
function elementOfZhi(zhiIdx) {
  // 子水 丑土 寅木 卯木 辰土 巳火 午火 未土 申金 酉金 戌土 亥水
  const map = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4];
  return map[zhiIdx];
}

// 地支藏干（本气在前）
const HIDDEN_GAN = [
  [9],        // 子: 癸
  [5, 9, 7],  // 丑: 己癸辛
  [0, 2, 4],  // 寅: 甲丙戊
  [1],        // 卯: 乙
  [4, 1, 9],  // 辰: 戊乙癸
  [2, 4, 6],  // 巳: 丙戊庚
  [3, 5],     // 午: 丁己
  [5, 3, 1],  // 未: 己丁乙
  [6, 8, 4],  // 申: 庚壬戊
  [7],        // 酉: 辛
  [4, 7, 3],  // 戌: 戊辛丁
  [8, 0]      // 亥: 壬甲
];

// 十神：以日干为基准，求 otherGan 对日干的十神关系
const SHISHEN_NAMES_SAME = ['比肩', '食神', '偏财', '七杀', '偏印'];
const SHISHEN_NAMES_DIFF = ['劫财', '伤官', '正财', '正官', '正印'];

function getShishen(dayGanIdx, otherGanIdx) {
  if (dayGanIdx === otherGanIdx) return '比肩';
  const dE = elementOfGan(dayGanIdx), oE = elementOfGan(otherGanIdx);
  const sameYY = (dayGanIdx % 2) === (otherGanIdx % 2);
  if (oE === dE) return sameYY ? '比肩' : '劫财';
  if ((dE + 1) % 5 === oE) return sameYY ? '食神' : '伤官';       // 我生
  if ((dE + 2) % 5 === oE) return sameYY ? '偏财' : '正财';       // 我克
  if ((oE + 2) % 5 === dE) return sameYY ? '七杀' : '正官';       // 克我
  if ((oE + 1) % 5 === dE) return sameYY ? '偏印' : '正印';       // 生我
  return '';
}

// 五虎遁：由年干求正月(寅月)天干起点
function getYinMonthStartGan(yearGanIdx) {
  const table = { 0: 2, 5: 2, 1: 4, 6: 4, 2: 6, 7: 6, 3: 8, 8: 8, 4: 0, 9: 0 };
  return table[yearGanIdx];
}

// 五鼠遁：由日干求子时天干起点
function getZiHourStartGan(dayGanIdx) {
  const table = { 0: 0, 5: 0, 1: 2, 6: 2, 2: 4, 7: 4, 3: 6, 8: 6, 4: 8, 9: 8 };
  return table[dayGanIdx];
}

function mod(n, m) {
  return ((n % m) + m) % m;
}

/**
 * 计算年柱（以立春为界）
 * 返回 { ganIdx, zhiIdx, adjustedYear }
 */
function getYearPillar(date) {
  const y = date.getFullYear();
  const lichun = getJieqiDate(y, 2); // 当年立春
  const adjustedYear = date < lichun ? y - 1 : y;
  const idx = mod(adjustedYear - 1984, 60); // 1984 年为甲子年
  return { ganIdx: idx % 10, zhiIdx: idx % 12, adjustedYear };
}

/**
 * 计算月柱：基于 12 个"节"，月支固定对应节气区间，月干由年干通过五虎遁推出
 */
function getMonthPillar(date, yearPillar) {
  const springYear = yearPillar.adjustedYear;
  // 12 个节气边界：立春(n=2) 起，之后每隔一个节气(n+2)，共 12 个（最后为次年小寒 n=0）
  const boundaries = [];
  for (let i = 0; i < 12; i++) {
    const n = (2 + i * 2) % 24;
    const yr = n === 0 ? springYear + 1 : springYear; // 小寒落在次年 1 月
    boundaries.push(getJieqiDate(yr, n));
  }
  let monthIndex = 0;
  for (let i = 1; i < boundaries.length; i++) {
    if (date >= boundaries[i]) monthIndex = i;
  }
  const zhiIdx = mod(2 + monthIndex, 12); // 寅=2 起
  const startGan = getYinMonthStartGan(yearPillar.ganIdx);
  const ganIdx = mod(startGan + monthIndex, 10);
  return { ganIdx, zhiIdx, monthIndex, nextBoundary: findNextBoundary(date, boundaries, springYear) };
}

function findNextBoundary(date, boundaries, springYear) {
  for (const b of boundaries) {
    if (b > date) return b;
  }
  // 已过所有边界，返回次年立春
  return getJieqiDate(springYear + 2, 2);
}

// 2000-01-01（北京时间当天）为 戊午日，60甲子中戊午 index=54
const REF_DAY_INDEX = 54;

/**
 * 计算日柱：以 2000-01-01（戊午日）为基准，按公历日期整日数差推算
 * 采用"晚子时进日"惯例：23:00-23:59 计入次日日柱
 */
function getDayPillar(date) {
  let d = new Date(date.getTime());
  if (d.getHours() === 23) {
    d = new Date(d.getTime() + 3600 * 1000); // 归入次日
  }
  const y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
  const dateOnlyMs = Date.UTC(y, m, day); // 以当地日历日的 UTC 零点作为整日计数基准
  const refOnlyMs = Date.UTC(2000, 0, 1);
  const diffDays = Math.round((dateOnlyMs - refOnlyMs) / 86400000);
  const idx = mod(REF_DAY_INDEX + diffDays, 60);
  return { ganIdx: idx % 10, zhiIdx: idx % 12 };
}

/**
 * 计算时柱：由小时数确定地支，日干通过五鼠遁推时干
 * 23:00-0:59 均属子时（早/晚子时），子时地支 index=0
 */
function getHourPillar(date, dayGanIdx) {
  const h = date.getHours();
  const hourZhiIdx = h === 23 ? 0 : Math.floor((h + 1) / 2) % 12;
  const startGan = getZiHourStartGan(dayGanIdx);
  const ganIdx = mod(startGan + hourZhiIdx, 10);
  return { ganIdx, zhiIdx: hourZhiIdx };
}

/**
 * 主函数：根据出生日期时间（Date 对象，本地时间即视为北京时间）与性别计算完整命盘
 */
function calcBazi(date, gender) {
  const yearP = getYearPillar(date);
  const monthP = getMonthPillar(date, yearP);
  const dayP = getDayPillar(date);
  const hourP = getHourPillar(date, dayP.ganIdx);

  const pillars = { year: yearP, month: monthP, day: dayP, hour: hourP };
  const dayGanIdx = dayP.ganIdx;

  // 五行统计（天干各记1，地支本气记1，藏干余气各记0.5，仅用于粗略强弱参考）
  const wuxingScore = [0, 0, 0, 0, 0];
  const pillarList = [
    { key: 'year', ...yearP },
    { key: 'month', ...monthP },
    { key: 'day', ...dayP },
    { key: 'hour', ...hourP }
  ];
  const detail = pillarList.map(p => {
    wuxingScore[elementOfGan(p.ganIdx)] += 1;
    const hidden = HIDDEN_GAN[p.zhiIdx];
    hidden.forEach((hg, i) => {
      wuxingScore[elementOfGan(hg)] += (i === 0 ? 1 : 0.5);
    });
    const shishenGan = p.key === 'day' ? '日主' : getShishen(dayGanIdx, p.ganIdx);
    const shishenZhi = hidden.map((hg, i) => ({
      gan: TIANGAN[hg],
      shishen: getShishen(dayGanIdx, hg),
      main: i === 0
    }));
    return {
      key: p.key,
      gan: TIANGAN[p.ganIdx],
      zhi: DIZHI[p.zhiIdx],
      ganIdx: p.ganIdx,
      zhiIdx: p.zhiIdx,
      shishenGan,
      shishenZhi,
      shengxiao: SHENGXIAO[p.zhiIdx]
    };
  });

  return { pillars, detail, wuxingScore, dayGanIdx, yearAdjusted: yearP.adjustedYear };
}

/**
 * 大运推算
 * gender: 'male' | 'female'
 */
function calcDayun(date, gender, yearPillar, monthPillar) {
  const yearGanIdx = yearPillar.ganIdx;
  const yearYang = yearGanIdx % 2 === 0; // 阳年
  const isForward = (yearYang && gender === 'male') || (!yearYang && gender === 'female');

  // 起运：顺排找下一个节，逆排找上一个节
  const springYear = yearPillar.adjustedYear;
  // 构造覆盖前后几年的完整"节"序列，附带真实公历年，用于查找最近的节气边界
  const allJie = [];
  for (let y = springYear - 1; y <= springYear + 2; y++) {
    for (let i = 0; i < 12; i++) {
      const n = (2 + i * 2) % 24;
      allJie.push(getJieqiDate(y + (n === 0 ? 1 : 0), n));
    }
  }
  allJie.sort((a, b) => a - b);

  let refBoundary;
  if (isForward) {
    refBoundary = allJie.find(b => b > date);
  } else {
    const past = allJie.filter(b => b <= date);
    refBoundary = past[past.length - 1];
  }
  const diffMs = Math.abs(refBoundary - date);
  const diffDays = diffMs / 86400000;
  const totalYears = diffDays / 3; // 3天=1岁
  const startAgeYears = Math.floor(totalYears);
  const remain = (totalYears - startAgeYears) * 12;
  const startAgeMonths = Math.floor(remain);
  const startAgeDays = Math.round((remain - startAgeMonths) * 30);

  const list = [];
  let ganIdx = monthPillar.ganIdx;
  let zhiIdx = monthPillar.zhiIdx;
  for (let i = 1; i <= 9; i++) {
    ganIdx = mod(ganIdx + (isForward ? 1 : -1), 10);
    zhiIdx = mod(zhiIdx + (isForward ? 1 : -1), 12);
    const startAge = startAgeYears + (i - 1) * 10;
    list.push({
      index: i,
      gan: TIANGAN[ganIdx],
      zhi: DIZHI[zhiIdx],
      ganIdx, zhiIdx,
      startAge,
      startYear: date.getFullYear() + startAge
    });
  }
  return { isForward, startAgeYears, startAgeMonths, startAgeDays, list };
}

/* ------------------------------------------------------------------
 * 真太阳时修正
 * 中国全国统一使用北京时间（东八区，以东经120°为标准子午线），但各地
 * 实际的太阳位置（真太阳时）与标准时间有差异，由两部分组成：
 * 1) 经度时差：出生地经度与120°的差，每差1°相差4分钟；
 * 2) 均时差（Equation of Time）：地球公转轨道为椭圆、地轴倾斜导致
 *    真太阳日长度全年有 -14~+16 分钟左右的周期性偏差。
 * 二者相加即为"北京时间 -> 当地真太阳时"的修正分钟数。
 * ------------------------------------------------------------------ */

function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date - start) / 86400000);
}

// 均时差近似公式（太阳能工程常用近似式），误差约在1分钟以内
function equationOfTimeMinutes(date) {
  const N = dayOfYear(date);
  const B = (2 * Math.PI / 364) * (N - 81);
  return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
}

/**
 * 真太阳时修正分钟数：longitude 为出生地经度（东经为正，如北京116.4）
 */
function trueSolarTimeAdjustMinutes(date, longitude) {
  const longitudeCorrection = (longitude - 120) * 4;
  return longitudeCorrection + equationOfTimeMinutes(date);
}

/**
 * 应用真太阳时修正，返回修正后的 Date（若 longitude 为 null/undefined 则原样返回）
 */
function applyTrueSolarTime(date, longitude) {
  if (longitude === null || longitude === undefined || longitude === '' || isNaN(longitude)) return date;
  const adjustMinutes = trueSolarTimeAdjustMinutes(date, longitude);
  return new Date(date.getTime() + adjustMinutes * 60000);
}

/**
 * 流年：给定年份，返回该年的年柱（以立春为界）
 */
function getYearGanzhi(year) {
  const idx = mod(year - 1984, 60);
  return { ganIdx: idx % 10, zhiIdx: idx % 12, gan: TIANGAN[idx % 10], zhi: DIZHI[idx % 12] };
}

/**
 * 日主旺衰判断（简化参考算法，非专业断语）
 * 思路：以 calcBazi 已统计的五行得分为基础，把"同我"(比劫)与"生我"(印)
 * 归为帮扶一方，"我生"(食伤)、"我克"(财)、"克我"(官杀) 归为耗克一方，
 * 再叠加月令（月支五行）的额外加权——因为传统命理中月令对旺衰影响最大。
 * 返回帮扶/耗克得分及一个五档结论，仅作粗略参考。
 */
function judgeStrength(bazi) {
  const dayWx = elementOfGan(bazi.dayGanIdx);
  const yin = (dayWx + 4) % 5;   // 生我（印）
  const shi = (dayWx + 1) % 5;   // 我生（食伤）
  const cai = (dayWx + 2) % 5;   // 我克（财）
  const guan = (dayWx + 3) % 5;  // 克我（官杀）

  let support = bazi.wuxingScore[dayWx] + bazi.wuxingScore[yin];
  let drain = bazi.wuxingScore[shi] + bazi.wuxingScore[cai] + bazi.wuxingScore[guan];

  // 月令加权：月支为提纲，对旺衰影响最大，额外加权而非仅按普通地支计入
  const monthZhiWx = elementOfZhi(bazi.pillars.month.zhiIdx);
  let monthRelation;
  if (monthZhiWx === dayWx) { support += 1.5; monthRelation = '得令'; }
  else if (monthZhiWx === yin) { support += 0.8; monthRelation = '半得令（月生日主）'; }
  else if (monthZhiWx === shi) { drain += 0.8; monthRelation = '不得令（日主生月）'; }
  else if (monthZhiWx === cai) { drain += 1; monthRelation = '不得令（日主克月）'; }
  else { drain += 1.5; monthRelation = '不得令（月克日主）'; }

  const total = support + drain;
  const ratio = total > 0 ? support / total : 0.5;

  let level;
  if (ratio >= 0.62) level = '身旺';
  else if (ratio >= 0.53) level = '偏旺';
  else if (ratio > 0.47) level = '中和';
  else if (ratio > 0.38) level = '偏弱';
  else level = '身弱';

  return {
    dayWx, support, drain, ratio, level, monthRelation,
    dayWxName: WUXING_NAMES[dayWx]
  };
}

if (typeof module !== 'undefined') {
  module.exports = {
    TIANGAN, DIZHI, WUXING_NAMES, SHENGXIAO, JIEQI_NAMES,
    getJieqiDate, calcBazi, calcDayun, getYearGanzhi, elementOfGan, elementOfZhi, getShishen,
    solarToLunar, lunarToSolar, getLeapMonthOfYear, getLunarMonthLength, formatLunar, lunarDayName,
    LUNAR_MONTH_NAMES, dateToJD, newMoonJD, judgeStrength,
    equationOfTimeMinutes, trueSolarTimeAdjustMinutes, applyTrueSolarTime
  };
}
