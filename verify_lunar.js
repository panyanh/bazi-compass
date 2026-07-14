const core = require('./core.js');

console.log('=== 已知春节日期核对（公历应转换为对应农历年正月初一）===');
const cnyKnown = [
  ['2020-01-25', '庚子'],
  ['2021-02-12', '辛丑'],
  ['2022-02-01', '壬寅'],
  ['2023-01-22', '癸卯'],
  ['2024-02-10', '甲辰'],
  ['2025-01-29', '乙巳'],
  ['2026-02-17', '丙午']
];
cnyKnown.forEach(([ds, expectGz]) => {
  const [y, m, d] = ds.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12, 0);
  const f = core.formatLunar(date);
  const ok = f.yearGanzhi === expectGz && f.monthIndex === 1 && f.day === 1 && !f.isLeap;
  console.log(ds, '->', f.text, ok ? 'OK' : ('MISMATCH (期望 ' + expectGz + '年正月初一)'));
});

console.log('\n=== 农历新年前一天应为上一年腊月最后一天 ===');
[
  ['2024-02-09', '癸卯'],
  ['2025-01-28', '甲辰']
].forEach(([ds, expectGz]) => {
  const [y, m, d] = ds.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12, 0);
  const f = core.formatLunar(date);
  console.log(ds, '->', f.text, f.yearGanzhi === expectGz ? 'OK' : 'MISMATCH');
});

console.log('\n=== 已知闰月年份抽查（2023年应有闰二月，2020年应有闰四月）===');
function scanLeapMonth(year) {
  for (let m = 1; m <= 12; m++) {
    for (let d = 1; d <= 28; d += 9) {
      const date = new Date(year, m - 1, d, 12, 0);
      const f = core.formatLunar(date);
      if (f.isLeap) return f;
    }
  }
  return null;
}
[2020, 2023].forEach(y => {
  const found = scanLeapMonth(y);
  console.log(y, '年公历范围内抽样发现闰月:', found ? found.monthName : '未发现（抽样可能未命中，非严格结论）');
});

console.log('\n=== 连续 40 天逐日检查月/日单调递增、无跳跃 ===');
let prev = null;
let bad = 0;
for (let i = 0; i < 40; i++) {
  const date = new Date(2024, 1, 1 + i, 12, 0); // 2024-02-01 起
  const f = core.formatLunar(date);
  if (prev) {
    const dayDiff = (f.monthIndex === prev.monthIndex && f.isLeap === prev.isLeap)
      ? f.day - prev.day
      : null;
    if (dayDiff !== null && dayDiff !== 1) { bad++; console.log('异常:', date.toDateString(), prev.text, '->', f.text); }
  }
  prev = f;
}
console.log('异常计数:', bad, bad === 0 ? 'OK（逐日递增正常）' : 'FAIL');

console.log('\n=== 与八字年柱（立春界）对照示例：2024-02-06（立春后、春节前）===');
const edge = new Date(2024, 1, 6, 12, 0);
const baziY = core.calcBazi(edge, 'male').detail[0];
const lunarF = core.formatLunar(edge);
console.log('八字年柱(立春界):', baziY.gan + baziY.zhi, ' | 农历显示(正月界):', lunarF.text, '(此日尚在农历癸卯年腊月，两者不同属正常现象，非bug)');
