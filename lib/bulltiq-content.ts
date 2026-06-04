// lib/bulltiq-content.ts
// SEO landing page definitions + reusable Bulltiq content brief builder.

export type SeoMetric = 'return1Y' | 'returnYTD' | 'volatility1Y' | 'sharpe1Y' | 'maxDrawdown1Y';

export interface SeoLandingPage {
  slug: string;
  title: string;
  h1: string;
  description: string;
  audience: string;
  metric: SeoMetric;
  sort: 'asc' | 'desc';
  fundType?: string;
  amcQuery?: string;
  intro: string;
  insightPrompt: string;
  qualityGate: { minRows: number };
  indexable: boolean;
}

const BASE_SEO_PAGES: SeoLandingPage[] = [
  {
    slug: 'best-thai-equity-funds',
    title: 'กองทุนหุ้นไทยผลตอบแทนดี — Bulltiq',
    h1: 'กองทุนหุ้นไทยผลตอบแทนดี',
    description: 'จัดอันดับกองทุนหุ้นไทยจากผลตอบแทนย้อนหลัง 1 ปี พร้อมคะแนนสุขภาพกองทุนและข้อควรระวัง',
    audience: 'นักลงทุนไทยที่อยากคัดกองทุนหุ้นไทยแบบเร็ว',
    metric: 'return1Y',
    sort: 'desc',
    fundType: 'EQ',
    intro: 'หน้านี้ช่วยดูว่ากองทุนหุ้นกลุ่มไทยตัวไหนทำผลงาน 1 ปีเด่น โดยต้องอ่านคู่กับความเสี่ยงและข้อมูลย้อนหลัง ไม่ใช่ดูผลตอบแทนอย่างเดียว',
    insightPrompt: 'ดูว่าผลตอบแทนสูงมาจากการขึ้นแรงระยะสั้นหรือมีความสม่ำเสมอพอสมควร',
    qualityGate: { minRows: 8 },
    indexable: true,
  },
  {
    slug: 'best-fixed-income-funds',
    title: 'กองทุนตราสารหนี้ผลตอบแทนดี — Bulltiq',
    h1: 'กองทุนตราสารหนี้ผลตอบแทนดี',
    description: 'จัดอันดับกองทุนตราสารหนี้โดยดูผลตอบแทน ความผันผวน Drawdown และคะแนนสุขภาพกองทุน',
    audience: 'คนที่มองหากองทุนตราสารหนี้แทนเงินฝากหรือพักเงินบางส่วน',
    metric: 'return1Y',
    sort: 'desc',
    fundType: 'FI',
    intro: 'กองทุนตราสารหนี้ควรถูกอ่านทั้งผลตอบแทนและความเสี่ยงด้านราคา/ดอกเบี้ย หน้านี้จึงแสดงคะแนนสุขภาพประกอบ ไม่ใช่จัดอันดับจากผลตอบแทนอย่างเดียว',
    insightPrompt: 'เช็กว่ากองทุนที่ผลตอบแทนสูงมีความผันผวนหรือ Drawdown สูงผิดปกติหรือไม่',
    qualityGate: { minRows: 8 },
    indexable: true,
  },
  {
    slug: 'low-volatility-funds',
    title: 'กองทุนความผันผวนต่ำ — Bulltiq',
    h1: 'กองทุนความผันผวนต่ำ',
    description: 'ค้นหากองทุนที่ NAV แกว่งน้อยในรอบ 1 ปี เหมาะสำหรับใช้เป็นจุดเริ่มต้นในการคัดกรองกองทุนเสี่ยงต่ำกว่า',
    audience: 'นักลงทุนที่ไม่อยากเห็นพอร์ตแกว่งแรง',
    metric: 'volatility1Y',
    sort: 'asc',
    intro: 'ความผันผวนต่ำไม่ได้แปลว่าปลอดภัยเสมอ แต่ช่วยกรองกองทุนที่ NAV แกว่งน้อยกว่าในช่วงที่ผ่านมาได้',
    insightPrompt: 'ดูคู่กับผลตอบแทนและ Drawdown เพื่อไม่เลือกกองทุนที่นิ่งแต่ไม่สร้างผลตอบแทน',
    qualityGate: { minRows: 8 },
    indexable: true,
  },
  {
    slug: 'high-sharpe-funds',
    title: 'กองทุน Sharpe Ratio สูง — Bulltiq',
    h1: 'กองทุนที่ผลตอบแทนต่อความเสี่ยงดี',
    description: 'จัดอันดับกองทุนจาก Sharpe Ratio 1 ปี เพื่อดูผลตอบแทนเมื่อเทียบกับความผันผวน',
    audience: 'นักลงทุนที่อยากดูคุณภาพผลตอบแทน ไม่ใช่แค่ตัวเลขผลตอบแทนสูงสุด',
    metric: 'sharpe1Y',
    sort: 'desc',
    intro: 'Sharpe Ratio ช่วยดูว่ากองทุนให้ผลตอบแทนคุ้มกับความผันผวนแค่ไหน แต่ควรเปรียบเทียบกองทุนประเภทเดียวกัน',
    insightPrompt: 'ดูว่าคะแนนสูงเพราะผลตอบแทนดีจริงหรือเพราะความผันผวนต่ำมากในช่วงสั้น',
    qualityGate: { minRows: 8 },
    indexable: true,
  },
  {
    slug: 'best-ssf-rmf-funds',
    title: 'กองทุน SSF / RMF น่าสนใจ — Bulltiq',
    h1: 'กองทุน SSF / RMF น่าสนใจ',
    description: 'เริ่มคัดกองทุน SSF และ RMF จากผลตอบแทนย้อนหลัง คะแนนสุขภาพกองทุน และข้อควรระวัง',
    audience: 'คนวางแผนภาษีที่ต้องการ shortlist กองทุนก่อนอ่านหนังสือชี้ชวน',
    metric: 'return1Y',
    sort: 'desc',
    fundType: 'SSF',
    intro: 'SSF/RMF มีเงื่อนไขภาษีและระยะเวลาถือครอง ควรใช้หน้านี้เป็นจุดเริ่มต้นในการคัดกรอง ไม่ใช่ตัดสินใจซื้อทันที',
    insightPrompt: 'ดูความเสี่ยงและระยะเวลาถือครองให้สอดคล้องกับแผนภาษีของตัวเอง',
    qualityGate: { minRows: 8 },
    indexable: true,
  },
];

const FUND_TYPE_SEO = [
  { code: 'EQ', slug: 'equity', label: 'หุ้น', audience: 'นักลงทุนที่รับความผันผวนได้และต้องการโอกาสเติบโต' },
  { code: 'FI', slug: 'fixed-income', label: 'ตราสารหนี้', audience: 'นักลงทุนที่ต้องการลดความผันผวนของพอร์ต' },
  { code: 'MM', slug: 'money-market', label: 'ตลาดเงิน', audience: 'คนที่ต้องการพักเงินและรับความเสี่ยงต่ำ' },
  { code: 'BA', slug: 'mixed', label: 'ผสม', audience: 'นักลงทุนที่ต้องการกระจายสินทรัพย์ในกองทุนเดียว' },
  { code: 'FIF', slug: 'foreign', label: 'ต่างประเทศ', audience: 'นักลงทุนที่ต้องการกระจายออกนอกไทย' },
  { code: 'RE', slug: 'property', label: 'อสังหาริมทรัพย์', audience: 'นักลงทุนที่สนใจรายได้/สินทรัพย์จริง' },
  { code: 'CM', slug: 'commodity', label: 'สินค้าโภคภัณฑ์', audience: 'นักลงทุนที่ใช้สินค้าโภคภัณฑ์กระจายความเสี่ยง' },
  { code: 'RMF', slug: 'rmf', label: 'RMF', audience: 'คนวางแผนเกษียณและลดหย่อนภาษี' },
  { code: 'SSF', slug: 'ssf', label: 'SSF', audience: 'คนวางแผนภาษีที่ถือยาวได้' },
];

const METRIC_SEO = [
  { metric: 'return1Y' as const, sort: 'desc' as const, slug: 'best-return', label: 'ผลตอบแทน 1 ปีดี', prompt: 'อย่าดูผลตอบแทนอย่างเดียว ให้ดู Drawdown และ Health Score คู่กัน' },
  { metric: 'volatility1Y' as const, sort: 'asc' as const, slug: 'low-volatility', label: 'ความผันผวนต่ำ', prompt: 'เหมาะสำหรับเริ่มหากองทุนที่ NAV แกว่งน้อยกว่า แต่ต้องดูผลตอบแทนประกอบ' },
  { metric: 'sharpe1Y' as const, sort: 'desc' as const, slug: 'high-sharpe', label: 'Sharpe Ratio สูง', prompt: 'ใช้ดูคุณภาพผลตอบแทนต่อความเสี่ยงเมื่อเทียบในกลุ่มเดียวกัน' },
  { metric: 'maxDrawdown1Y' as const, sort: 'desc' as const, slug: 'low-drawdown', label: 'Drawdown ต่ำ', prompt: 'ช่วยกรองกองทุนที่ลงลึกน้อยกว่าในรอบปีที่ผ่านมา' },
];

const AMC_SEO = [
  { slug: 'scbam', name: 'SCBAM' },
  { slug: 'kasset', name: 'KAsset' },
  { slug: 'bblam', name: 'BBLAM' },
  { slug: 'ktam', name: 'KTAM' },
  { slug: 'krungsri', name: 'Krungsri Asset' },
  { slug: 'mfc', name: 'MFC' },
  { slug: 'oneam', name: 'ONEAM' },
  { slug: 'tisco', name: 'TISCOAM' },
  { slug: 'uobam', name: 'UOBAM' },
  { slug: 'abrdn', name: 'abrdn' },
];

const GENERATED_TYPE_PAGES: SeoLandingPage[] = FUND_TYPE_SEO.flatMap((type) =>
  METRIC_SEO.map((metric) => ({
    slug: `${metric.slug}-${type.slug}-funds`,
    title: `กองทุน${type.label}${metric.label} — Bulltiq`,
    h1: `กองทุน${type.label}${metric.label}`,
    description: `จัดอันดับกองทุน${type.label}จาก${metric.label} พร้อม Health Score ความเสี่ยง และข้อมูลย้อนหลัง`,
    audience: type.audience,
    metric: metric.metric,
    sort: metric.sort,
    fundType: type.code,
    intro: `หน้านี้คัดกองทุน${type.label}ด้วยข้อมูลจริงจากฐานข้อมูล Bulltiq เพื่อช่วยทำ shortlist ก่อนอ่าน Fund Fact Sheet รายกองทุน`,
    insightPrompt: metric.prompt,
    qualityGate: { minRows: 6 },
    indexable: true,
  })),
);

const GENERATED_AMC_PAGES: SeoLandingPage[] = AMC_SEO.map((amc) => ({
  slug: `best-${amc.slug}-funds`,
  title: `กองทุน ${amc.name} น่าสนใจ — Bulltiq`,
  h1: `กองทุน ${amc.name} น่าสนใจ`,
  description: `Shortlist กองทุนของ ${amc.name} ด้วยผลตอบแทน 1 ปี ความเสี่ยง และ Bulltiq Fund Health Score`,
  audience: `นักลงทุนที่กำลังดูหรือถือกองทุนของ ${amc.name}`,
  metric: 'return1Y',
  sort: 'desc',
  amcQuery: amc.name,
  intro: `หน้านี้รวมกองทุนของ ${amc.name} ที่มีข้อมูลย้อนหลังเพียงพอ เพื่อใช้เป็นจุดเริ่มต้นก่อนเปรียบเทียบกองทุนรายตัว`,
  insightPrompt: 'ดูว่ากองทุนเด่นเพราะผลตอบแทนระยะสั้น หรือมีคะแนนสุขภาพและความเสี่ยงที่สมเหตุสมผล',
  qualityGate: { minRows: 5 },
  indexable: true,
}));

export const SEO_LANDING_PAGES: SeoLandingPage[] = [
  ...BASE_SEO_PAGES,
  ...GENERATED_TYPE_PAGES,
  ...GENERATED_AMC_PAGES,
];

export function getSeoLandingPage(slug: string): SeoLandingPage | undefined {
  return SEO_LANDING_PAGES.find((page) => page.slug === slug);
}

export interface ContentBriefRow {
  rank: number;
  projAbbrName: string | null;
  nameTh: string;
  returnPct: number | null;
  volatilityPct?: number | null;
  healthScore?: number | null;
  healthGrade?: string | null;
}

export interface ContentBriefInput {
  title: string;
  slug: string;
  audience: string;
  rows: ContentBriefRow[];
}

export function buildContentBrief(input: ContentBriefInput) {
  const top = input.rows.slice(0, 5);
  const names = top.map((row) => row.projAbbrName ?? row.nameTh).join(', ');
  const thaiSummary = top.length
    ? `${input.title}: กองทุนที่เด่นในรอบนี้คือ ${names} โดยควรดูคะแนนสุขภาพกองทุน ความผันผวน และ Drawdown ประกอบก่อนตัดสินใจ`
    : `${input.title}: ยังไม่มีข้อมูลเพียงพอสำหรับสรุปรายการกองทุน`;

  return {
    thaiSummary,
    postIdeas: [
      `Bulltiq shortlist: ${input.title} — 5 กองทุนที่ควรเปิดดูต่อ`,
      `อย่าดูผลตอบแทนอย่างเดียว: วิธีอ่าน ${input.title} ด้วย Health Score`,
      `เช็กลิสต์สำหรับ${input.audience}: Return + Risk + Data Quality`,
    ],
    newsletterSubject: `Bulltiq: ${input.title}`,
    shortVideoHook: `${top[0]?.projAbbrName ?? 'กองทุนอันดับต้น'} น่าสนใจจริงไหม ถ้าไม่ได้ดูแค่ผลตอบแทน?`,
    disclaimer: 'ข้อมูลนี้ใช้เพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุน ผลการดำเนินงานในอดีตไม่ได้รับประกันผลในอนาคต',
  };
}
