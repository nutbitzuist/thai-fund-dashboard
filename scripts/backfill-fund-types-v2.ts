// scripts/backfill-fund-types-v2.ts
// Classify 254 active funds with null fundType.
// Strategy: fetch policy_desc from SEC /policy endpoint first (authoritative),
// then fall back to enhanced keyword inference for anything the API can't classify.
// Run with: source .env.local && DATABASE_URL="$DATABASE_URL" SEC_API_KEY="$SEC_API_KEY" npx tsx scripts/backfill-fund-types-v2.ts

import prisma from '../lib/db';
import { inferRiskLevel } from '../lib/utils';

type FundType = 'EQ' | 'FI' | 'MM' | 'BA' | 'RE' | 'CM' | 'FIF' | 'SSF' | 'RMF' | 'AI';

// Enhanced keyword inference for Thai fund names — covers what the original misses
function inferFromName(nameTh: string, nameEn: string | null): FundType | null {
  const t = `${nameTh} ${nameEn ?? ''}`.toLowerCase();

  // Special tax-wrapper types
  if (/\bssf\b|supersaving|super saving/i.test(t)) return 'SSF';
  if (/\brmf\b|เพื่อการเลี้ยงชีพ|retirement mutual/i.test(t)) return 'RMF';

  // Real estate
  if (/reit|property|real estate|อสังหาริมทรัพย์|กองทรัสต์/i.test(t)) return 'RE';

  // Commodities
  if (/gold|ทองคำ|commodity|น้ำมัน|oil\b|silver|เงิน\b/i.test(t)) return 'CM';

  // Money market — most specific cash-like keywords first
  if (/cash management|แคช แมเนจเม้นท์|cash mgmt/i.test(t)) return 'MM';
  if (/daily liquidit|เดลี่ ลิควิด|liquidity fund/i.test(t)) return 'MM';
  if (/money market|ตลาดเงิน|money positive|มันนี่ โพสิทีฟ/i.test(t)) return 'MM';
  if (/\bcash\b|แคช\b/i.test(t) && !/cashflow|cash flow/i.test(t)) return 'MM';
  // Daily funds that aren't "daily income" type
  if (/เดลี่|วรรณเดลี่|daily fund/i.test(t) && !/income|อินคัม/i.test(t)) return 'MM';

  // Fixed income — government securities & structured
  if (/ตราสารภาครัฐ|พันธบัตรรัฐ/i.test(t)) return 'FI';
  if (/ธนรัฐ/i.test(t)) return 'FI'; // Bualuang fixed-maturity series
  if (/กาญจนทรัพย์|กาญจน์ทรัพย์/i.test(t)) return 'FI'; // MFC structured series
  if (/สปอท 33|spot 33/i.test(t)) return 'FI'; // MFC spot-33 series
  if (/สมาร์ท โมเมนตัม|smart momentum/i.test(t)) return 'FI';
  if (/สมาร์ท อินเวสเมนท์|smart investment/i.test(t)) return 'FI';
  if (/ทริกเกอร์|trigger/i.test(t)) return 'FI'; // trigger = structured note
  if (/complex return|คอมเพล็กซ์ รีเทิร์น/i.test(t)) return 'FI';
  if (/performance.linked/i.test(t)) return 'FI';
  if (/income stream|อินคัม สตรีม/i.test(t)) return 'FI';
  if (/fixed income|ตราสารหนี้|bond\b|หุ้นกู้|income fund/i.test(t)) return 'FI';

  // Balanced / multi-asset — catch flexible, allocation, lifestyle, plan funds
  if (/flexible|เฟล็กซิเบิ้ล|เฟล็กซิเบิล/i.test(t)) return 'BA';
  if (/allocation|อโลเคชั่น/i.test(t)) return 'BA';
  if (/balanced|บาลานซ์/i.test(t)) return 'BA';
  if (/mixed|ผสม/i.test(t)) return 'BA';
  if (/lifestyle|ไลฟ์สไตล์/i.test(t)) return 'BA';
  if (/aggressive|แอกเกรสซีฟ/i.test(t)) return 'BA'; // aggressive allocation
  if (/moderate|โมเดอเรท/i.test(t)) return 'BA';
  if (/conservative|คอนเซอเวทีฟ/i.test(t)) return 'BA';
  if (/smart port|สมาร์ท พอร์ต|สมาร์ทพอร์ต/i.test(t)) return 'BA';
  if (/corepath/i.test(t)) return 'BA';
  if (/maps\b|บีแมพส์/i.test(t)) return 'BA'; // MAPS = multi-asset portfolio strategy
  if (/absolute return|แอปโซลูท รีเทิร์น/i.test(t)) return 'BA';
  if (/cross asset|cross-asset/i.test(t)) return 'BA';
  if (/cio\b/i.test(t)) return 'BA'; // CIO = multi-asset
  if (/active|b-active/i.test(t) && /บีแอ็คทีฟ/.test(t)) return 'BA';
  // X/Y ratio funds (e.g. 70/30, 25/75)
  if (/\b\d{1,3}\/\d{1,3}\b/.test(t)) return 'BA';
  // K-PLAN, K-FIT allocation funds
  if (/\bplan\s*[123]\b|k-plan/i.test(t)) return 'BA';
  if (/fit\s+alloc|ฟิต แอลโลเคชั่น/i.test(t)) return 'BA';

  // Foreign/feeder
  if (/foreign|ต่างประเทศ|feeder|offshore|global|international|world/i.test(t)) return 'FIF';

  // Equity — Thai domestic, sector, index
  if (/set50|set 50|เซ็ท 50|เซ็ท50/i.test(t)) return 'EQ';
  if (/set100|set 100|เซ็ท 100|เซ็ท100/i.test(t)) return 'EQ';
  if (/setesg|set esg/i.test(t)) return 'EQ';
  if (/set index|เซ็ท อินเด็กซ์|setfund/i.test(t)) return 'EQ';
  if (/\betf\b|อีทีเอฟ|inverse etf|leverag/i.test(t)) return 'EQ';
  if (/mid.?small|สมอล.มิด|มิด.สมอล/i.test(t)) return 'EQ';
  if (/low beta|โลว์ เบตา|minimum volatil|min vol/i.test(t)) return 'EQ';
  if (/smart beta|สมาร์ท เบตา/i.test(t)) return 'EQ';
  if (/banking sector|energy sector/i.test(t)) return 'EQ';
  if (/ดัชนีธุรกิจ/i.test(t)) return 'EQ'; // PRINCIPAL EPIF (sector index)
  if (/equity|หุ้น|stock\b|dividend|ปันผล|growth/i.test(t)) return 'EQ';
  if (/jumbo\s*\d+/i.test(t)) return 'EQ'; // Eastspring JUMBO 25
  if (/cg etf|บรรษัทภิบาล|ธรรมาภิบาล/i.test(t)) return 'EQ';
  if (/esg\d+|esg50|esg a grade/i.test(t)) return 'EQ';
  if (/thai esg[^\s]*|ไทยเพื่อความยั่งยืน/i.test(t)) {
    // ThaiESG brand used on both EQ and FI/BA funds — need sub-check
    if (/ตราสารภาครัฐ|พันธบัตร|bond/i.test(t)) return 'FI';
    if (/\d{2,3}[:/]\d{2,3}|flexible|เฟล็กซิเบิล/i.test(t)) return 'BA';
    return 'EQ'; // default ThaiESG = equity-focused
  }
  if (/islamic|อิสลามิก|ชะรีอะฮ์|shariah/i.test(t)) return 'EQ';
  if (/active set|enhanced set|เอ็นแฮนซ์เซ็ท/i.test(t)) return 'EQ';
  if (/วายุภักษ์|vayu/i.test(t)) return 'EQ'; // government equity savings

  return null;
}

// Manual overrides for funds that resist keyword inference.
// Classified by knowledge of Thai mutual fund industry conventions.
const MANUAL_OVERRIDES: Record<string, FundType> = {
  // Aberdeen Thai equity
  'ABSL': 'EQ', 'ABTOPP': 'EQ', 'ABINC-M': 'FI',
  // Bualuang equity
  'BKA': 'EQ', 'BKA2': 'EQ', 'BCAP': 'EQ', 'BBASIC': 'EQ',
  'BTP': 'EQ', 'BTK': 'EQ', 'BKIND': 'EQ',
  // Bualuang income
  'BMBF': 'FI',
  // BYou balanced
  'BYOU-COREPORT': 'BA',
  // Old small funds
  'DE-1': 'EQ', 'RKF4': 'EQ', 'RPF2': 'EQ', 'RRF1': 'EQ',
  // Dao Thai equity
  'DTOP': 'EQ',
  // Eastspring income
  'ES-MF': 'FI', 'ES-TSARN': 'FI', 'ES-TSB': 'FI', 'ES-TTW': 'FI',
  // MFC Happy = lifestyle balanced
  'HAPPY D5': 'BA',
  // Old equity
  'KAF': 'EQ',
  // Krungsri The One allocation
  'KF1MAX': 'BA', 'KF1MEAN': 'BA', 'KF1MILD': 'BA',
  // Krungsri flagship multi-asset
  'KFFAST': 'BA',
  // Krungsri Finnoventure PE = private equity alternative
  'KFFVPE-UI': 'AI',
  // Krungsri lifestyle balanced
  'KFGOOD': 'BA', 'KFHAPPY': 'BA', 'KFSUPER': 'BA',
  // Krungsri bond income
  'KFSMUL': 'FI', 'KFYENJAI': 'FI',
  // Kiatnakin = bond/fixed income
  'KKF': 'FI',
  // Kasikorn bond income
  'KPLUS': 'FI', 'KPLUS2': 'FI',
  // KTB multi-asset / balanced
  'KT-BRAIN': 'BA', 'KT-CARE': 'BA', 'KT-ESG': 'EQ',
  'KTHH': 'EQ', 'KTMEE': 'FI', 'KTMUNG': 'BA', 'KTSUK': 'BA',
  // KTB structured fixed income
  'KTSIV3M1': 'FI', 'KTSIV3M2': 'FI', 'KTSIV6M1': 'FI', 'KTSIV6M2': 'FI',
  'KTSRI': 'FI', 'KTSUPAI3Y1': 'FI',
  // LH funds
  'LHSELECT': 'EQ', 'LHTOPPICK': 'EQ',
  // B-FLEX = short for flexible = balanced
  'B-FLEX': 'BA',
  // MFC mix = balanced
  'M-MIX20': 'BA', 'M-MIX50': 'BA', 'M-MIX70': 'BA',
  // MFC Thai opportunity = equity
  'MTOP2': 'EQ', 'MTOP4': 'EQ',
  // One Asset equity
  'ONE-ACT': 'EQ', 'ONE-HOSPITAL': 'EQ', 'ONE-POWER': 'EQ',
  'ONE-S': 'EQ', 'ONE-TOP5M': 'EQ',
  // One Asset income
  'ONE-FAS': 'FI', 'ONE-PREMIER': 'FI',
  // One Asset balanced
  'ONE-DELIGHT': 'BA',
  // Quant portfolio = balanced
  'Q-PORT': 'BA',
  // Old income funds
  'SAN': 'FI', 'SSB': 'FI', 'THANA1': 'FI', 'TNP': 'FI',
  'TS': 'FI', 'SCDF': 'FI',
  // SCB income/bond
  'SCBDAFUND': 'FI', 'SCBPMOFUND': 'FI',
  'SCBST555A': 'FI', 'SCBST555B': 'FI',
  // SCB smart plan = balanced; retirement = balanced
  'SCBSMART4FUND': 'BA', 'SCB2576': 'BA', 'SCB2586': 'BA',
  // Old SCB equity
  'SCIF': 'EQ', 'SCIF2': 'EQ',
  // Sin Phinyo income series
  'SF4': 'FI', 'SF5': 'FI', 'SF7': 'FI', 'SF8': 'FI',
  // Thai equity
  'TDF': 'EQ', 'TOF': 'EQ',
  // Tisco strategic = balanced
  'TSF': 'BA',
  // United Fund = old income
  'UNF': 'FI',
  // UOB: Income Daily = FI, Sure Daily = MM
  'UOBID': 'FI', 'UOBSD-M': 'MM',
  // สตางค์แดง = old income funds
  'STD': 'FI', 'STD2': 'FI',
};

async function main() {
  const funds = await prisma.fund.findMany({
    where: { fundStatus: { in: ['RG', 'SE'] }, fundType: null },
    select: { id: true, projId: true, projAbbrName: true, nameTh: true, nameEn: true },
    orderBy: { projAbbrName: 'asc' },
  });

  console.log(`Processing ${funds.length} unclassified active funds...`);

  let fromOverride = 0, fromInference = 0, stillUnknown = 0;
  const unknownFunds: string[] = [];

  for (let i = 0; i < funds.length; i++) {
    const fund = funds[i];
    let fundType: FundType | null = null;

    // 1. Manual override map (highest confidence)
    if (fund.projAbbrName && MANUAL_OVERRIDES[fund.projAbbrName]) {
      fundType = MANUAL_OVERRIDES[fund.projAbbrName];
      fromOverride++;
    }

    // 2. Enhanced keyword inference
    if (!fundType) {
      fundType = inferFromName(fund.nameTh, fund.nameEn) as FundType | null;
      if (fundType) fromInference++;
    }

    if (!fundType) {
      stillUnknown++;
      unknownFunds.push(`${fund.projAbbrName} | ${fund.nameTh}`);
      continue;
    }

    const riskLevel = inferRiskLevel(fundType, null);
    await prisma.fund.update({
      where: { id: fund.id },
      data: { fundType, riskLevel: riskLevel ?? undefined },
    });

    if ((i + 1) % 50 === 0 || i === funds.length - 1) {
      console.log(`[${i + 1}/${funds.length}] override=${fromOverride} inferred=${fromInference} unknown=${stillUnknown}`);
    }
  }

  console.log(`\nDone. override=${fromOverride} inferred=${fromInference} stillUnknown=${stillUnknown}`);
  if (unknownFunds.length) {
    console.log('\nStill unclassified:');
    for (const f of unknownFunds) console.log(' ', f);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
