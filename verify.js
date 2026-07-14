const core = require('./core.js');

function fmt(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

console.log('=== 节气日期抽查（对照常识：立春约2/4，夏至约6/21，冬至约12/21-22）===');
[2024, 2025, 2026].forEach(y => {
  const names = ['立春(n2)','惊蛰(n4)','夏至(n11)','秋分(n17)','冬至(n23)'];
  const ns = [2,4,11,17,23];
  ns.forEach((n,i) => {
    console.log(y, names[i], fmt(core.getJieqiDate(y, n)));
  });
});

console.log('\n=== 生肖年份抽查（2026应为丙午马年，2024甲辰龙年，2020庚子鼠年）===');
[2020,2022,2023,2024,2025,2026].forEach(y => {
  const g = core.getYearGanzhi(y);
  console.log(y, g.gan+g.zhi, core.SHENGXIAO[g.zhiIdx]);
});

console.log('\n=== 完整排盘示例：1990-05-15 08:30 男 ===');
const d1 = new Date(1990,4,15,8,30);
const b1 = core.calcBazi(d1, 'male');
b1.detail.forEach(p => console.log(p.key, p.gan+p.zhi, '十神:'+p.shishenGan, '生肖:'+p.shengxiao));
console.log('五行得分(木火土金水):', b1.wuxingScore.map(n=>n.toFixed(1)));
const dy1 = core.calcDayun(d1, 'male', b1.pillars.year, b1.pillars.month);
console.log('大运顺逆:', dy1.isForward, '起运:', dy1.startAgeYears+'岁'+dy1.startAgeMonths+'月');
dy1.list.slice(0,5).forEach(l => console.log(' 大运', l.index, l.gan+l.zhi, '起始年龄', l.startAge, '公历年', l.startYear));

console.log('\n=== 边界测试：立春附近 2024-02-04 16:00 与 2024-02-04 17:00（该年立春约16:27）===');
[16,17].forEach(h => {
  const d = new Date(2024,1,4,h,0);
  const b = core.calcBazi(d, 'male');
  console.log(h+'时', '年柱:', b.detail[0].gan+b.detail[0].zhi, '月柱:', b.detail[1].gan+b.detail[1].zhi);
});

console.log('\n=== 晚子时测试：2024-06-15 23:30 应计入次日日柱 ===');
const dz = new Date(2024,5,15,23,30);
const bz = core.calcBazi(dz, 'male');
console.log('日柱(23:30,应等于6/16白天日柱):', bz.detail[2].gan+bz.detail[2].zhi, '时柱:', bz.detail[3].gan+bz.detail[3].zhi);
const dz2 = new Date(2024,5,16,10,0);
const bz2 = core.calcBazi(dz2, 'male');
console.log('对照(6/16 10:00日柱):', bz2.detail[2].gan+bz2.detail[2].zhi);
