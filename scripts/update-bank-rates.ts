// scripts/update-bank-rates.ts
// Update bank deposit rates in the database.
// Run when rates change: source .env.local && DATABASE_URL="$DATABASE_URL" npx tsx scripts/update-bank-rates.ts
//
// How to verify current rates:
//  KBank  : https://www.kasikornbank.com/th/interest-rate
//  SCB    : https://www.scb.co.th/th/personal-banking/deposits/saving-account-interest-rate.html
//  BBL    : https://www.bangkokbank.com/th-TH/Personal/Save-and-Invest/Save/Interest-Rates
//  KTB    : https://www.ktb.co.th/ktb/th/interest-rate-savings
//  TTB    : https://www.ttbbank.com/th/rates-fees/interest-rate
//  UOB    : https://www.uob.co.th/th/personal/rates/deposit-rates.page
//  Krungthai (BAY): https://www.krungsriayudhya.com/th/personal/rates-and-fees

import prisma from '../lib/db';

const VERIFIED_AT = new Date('2026-05-29'); // update this date when you verify the rates

const RATES = [
  // Savings deposit (ออมทรัพย์) — standard rates for general accounts
  { bankName: 'กสิกรไทย',      bankAbbr: 'KBank', productType: 'SDA', ratePct: 0.50, sourceUrl: 'https://www.kasikornbank.com/th/interest-rate' },
  { bankName: 'ไทยพาณิชย์',    bankAbbr: 'SCB',   productType: 'SDA', ratePct: 0.50, sourceUrl: 'https://www.scb.co.th/th/personal-banking/deposits/saving-account-interest-rate.html' },
  { bankName: 'กรุงเทพ',       bankAbbr: 'BBL',   productType: 'SDA', ratePct: 0.50, sourceUrl: 'https://www.bangkokbank.com/th-TH/Personal/Save-and-Invest/Save/Interest-Rates' },
  { bankName: 'กรุงไทย',       bankAbbr: 'KTB',   productType: 'SDA', ratePct: 0.50, sourceUrl: 'https://www.ktb.co.th/ktb/th/interest-rate-savings' },
  { bankName: 'ทหารไทยธนชาต', bankAbbr: 'TTB',   productType: 'SDA', ratePct: 1.50, sourceUrl: 'https://www.ttbbank.com/th/rates-fees/interest-rate' },

  // Fixed deposit 12 months (ฝากประจำ 12 เดือน)
  { bankName: 'กสิกรไทย',      bankAbbr: 'KBank', productType: 'FD12', ratePct: 1.50, sourceUrl: 'https://www.kasikornbank.com/th/interest-rate' },
  { bankName: 'ไทยพาณิชย์',    bankAbbr: 'SCB',   productType: 'FD12', ratePct: 1.50, sourceUrl: 'https://www.scb.co.th/th/personal-banking/deposits/saving-account-interest-rate.html' },
  { bankName: 'กรุงเทพ',       bankAbbr: 'BBL',   productType: 'FD12', ratePct: 1.40, sourceUrl: 'https://www.bangkokbank.com/th-TH/Personal/Save-and-Invest/Save/Interest-Rates' },
  { bankName: 'กรุงไทย',       bankAbbr: 'KTB',   productType: 'FD12', ratePct: 1.50, sourceUrl: 'https://www.ktb.co.th/ktb/th/interest-rate-savings' },
  { bankName: 'ทหารไทยธนชาต', bankAbbr: 'TTB',   productType: 'FD12', ratePct: 1.85, sourceUrl: 'https://www.ttbbank.com/th/rates-fees/interest-rate' },
];

async function main() {
  console.log(`Upserting ${RATES.length} bank rate rows (verified ${VERIFIED_AT.toISOString().slice(0, 10)})...`);

  for (const r of RATES) {
    await prisma.bankRate.upsert({
      where: { bankAbbr_productType: { bankAbbr: r.bankAbbr, productType: r.productType } },
      update: { bankName: r.bankName, ratePct: r.ratePct, verifiedAt: VERIFIED_AT, sourceUrl: r.sourceUrl },
      create: { ...r, verifiedAt: VERIFIED_AT },
    });
    console.log(`  ${r.bankAbbr} ${r.productType} = ${r.ratePct}%`);
  }

  console.log('\nDone.');
  await prisma.$disconnect();
}

main().catch(console.error);
