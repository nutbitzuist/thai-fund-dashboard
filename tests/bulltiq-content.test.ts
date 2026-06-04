import assert from 'node:assert/strict';
import { SEO_LANDING_PAGES, getSeoLandingPage, buildContentBrief } from '../lib/bulltiq-content';

assert.ok(SEO_LANDING_PAGES.length >= 5);
assert.equal(getSeoLandingPage('best-thai-equity-funds')?.fundType, 'EQ');
assert.equal(getSeoLandingPage('low-volatility-funds')?.metric, 'volatility1Y');

const brief = buildContentBrief({
  title: 'กองทุนหุ้นไทยผลตอบแทนดี',
  slug: 'best-thai-equity-funds',
  audience: 'นักลงทุนไทยที่อยากคัดกองทุนหุ้น',
  rows: [
    { rank: 1, projAbbrName: 'AAA', nameTh: 'กองทุน AAA', returnPct: 12.3, volatilityPct: 9.1, healthScore: 82, healthGrade: 'ดีมาก' },
    { rank: 2, projAbbrName: 'BBB', nameTh: 'กองทุน BBB', returnPct: 8.2, volatilityPct: 11.5, healthScore: 70, healthGrade: 'ดี' },
  ],
});
assert.match(brief.thaiSummary, /AAA/);
assert.match(brief.postIdeas[0], /Bulltiq/);
assert.ok(brief.disclaimer.includes('ไม่ใช่คำแนะนำการลงทุน'));

console.log('bulltiq-content tests passed');
