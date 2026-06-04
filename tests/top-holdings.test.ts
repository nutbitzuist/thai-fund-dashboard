import assert from 'node:assert/strict';
import { cleanHoldingName, normalizeTopHoldings } from '../lib/top-holdings';

assert.equal(cleanHoldingName('หุ้นสามัญ บริษัท เดลต้า อีเลคโทรนิคส์ (ประเทศไทย) จำกัด (มหาชน)'), 'บริษัท เดลต้า อีเลคโทรนิคส์ (ประเทศไทย) จำกัด (มหาชน)');
assert.equal(cleanHoldingName('Common Shares NVIDIA CORP'), 'NVIDIA CORP');
assert.equal(cleanHoldingName('-7.27 หุ้นสินเชื่อฯ ธนาคารกสิกรไทย จำกัด'), 'ธนาคารกสิกรไทย จำกัด');
assert.equal(cleanHoldingName('ทรัพย์ บริษัท แอดวานซ์ อินโฟร์'), 'บริษัท แอดวานซ์ อินโฟร์');

const normalized = normalizeTopHoldings([
  { name: 'หุ้นสามัญ บริษัท เดลต้า อีเลคโทรนิคส์', pct: '14.88' },
  { name: 'เงินฝาก', pct: 98.03 },
  { name: 'Common Shares NVIDIA CORP', pct: 9.55 },
  { name: '-7.27 หุ้นสามัญ ธนาคารกสิกรไทย จำกัด', pct: 7.3 },
  { name: 'บริษัท ปตท. จำกัด (มหาชน)', pct: 8.1 },
  { name: 'APPLE INC', pct: 6.9 },
  { name: 'MICROSOFT CORP', pct: 6.5 },
]);

assert.equal(normalized.length, 5);
assert.deepEqual(normalized.map((h) => h.name), [
  'บริษัท เดลต้า อีเลคโทรนิคส์',
  'NVIDIA CORP',
  'บริษัท ปตท. จำกัด (มหาชน)',
  'ธนาคารกสิกรไทย จำกัด',
  'APPLE INC',
]);
assert.ok(normalized.every((h) => Number.isFinite(h.pct) && h.pct > 0));

console.log('top-holdings tests passed');
