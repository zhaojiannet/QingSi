// Backfill TransactionCardLink from historical multi-card notes.
// Usage:
//   docker exec qingsi_backend node scripts/backfill-multi-card-links.js --dry-run
//   docker exec qingsi_backend node scripts/backfill-multi-card-links.js --apply

import 'dotenv/config';
import prisma from '../src/db/prisma.js';

const MULTI_CARD_RE = /多卡联合支付:\s*(.+?)(?:\s*\||$)/;
const CUSTOM_CARD_RE = /自定义面值卡\(¥([\d.]+)\)/;

function parseNotes(notes) {
  const match = notes.match(MULTI_CARD_RE);
  if (!match) return null;
  const cardsText = match[1].trim();
  const parts = cardsText.split(' + ');
  const items = [];
  for (const part of parts) {
    const lastYen = part.lastIndexOf('¥');
    if (lastYen <= 0) continue;
    const cardName = part.substring(0, lastYen).trim();
    const amount = parseFloat(part.substring(lastYen + 1));
    if (isNaN(amount) || amount <= 0) continue;
    items.push({ cardName, amount });
  }
  return items;
}

async function findCard(memberId, cardName) {
  const customMatch = cardName.match(CUSTOM_CARD_RE);
  if (customMatch) {
    const customAmount = parseFloat(customMatch[1]);
    return prisma.card.findFirst({
      where: { memberId, isCustomCard: true, customAmount },
    });
  }
  return prisma.card.findFirst({
    where: { memberId, cardType: { name: cardName } },
    include: { cardType: true },
  });
}

async function main() {
  const apply = process.argv.includes('--apply');
  const dryRun = !apply;
  console.log(`Mode: ${dryRun ? 'DRY-RUN' : 'APPLY'}`);

  const txs = await prisma.transaction.findMany({
    where: { notes: { contains: '多卡联合支付' } },
    select: { id: true, memberId: true, notes: true, transactionTime: true },
    orderBy: { transactionTime: 'asc' },
  });
  console.log(`Found ${txs.length} multi-card transactions to backfill.`);

  let totalLinks = 0;
  const unmatched = [];
  const created = [];

  for (const tx of txs) {
    if (!tx.memberId) {
      unmatched.push({ txId: tx.id, reason: 'no memberId' });
      continue;
    }
    const items = parseNotes(tx.notes);
    if (!items || items.length === 0) {
      unmatched.push({ txId: tx.id, reason: 'parse failed', notes: tx.notes });
      continue;
    }
    const existing = await prisma.transactionCardLink.count({ where: { transactionId: tx.id } });
    if (existing > 0) {
      console.log(`Skip tx ${tx.id}: ${existing} link(s) already exist`);
      continue;
    }
    for (const item of items) {
      const card = await findCard(tx.memberId, item.cardName);
      if (!card) {
        unmatched.push({ txId: tx.id, cardName: item.cardName, amount: item.amount });
        continue;
      }
      totalLinks++;
      created.push({ txId: tx.id, cardId: card.id, cardName: item.cardName, amount: item.amount });
      if (apply) {
        await prisma.transactionCardLink.create({
          data: {
            transactionId: tx.id,
            cardId: card.id,
            cardName: item.cardName,
            amount: item.amount,
          },
        });
      }
    }
  }

  console.log(`\nResult:`);
  console.log(`  transactions scanned: ${txs.length}`);
  console.log(`  links would create:   ${totalLinks}`);
  console.log(`  unmatched entries:    ${unmatched.length}`);
  if (unmatched.length > 0) {
    console.log(`\nUnmatched detail:`);
    for (const u of unmatched) console.log(`  ${JSON.stringify(u)}`);
  }
  if (apply) {
    const after = await prisma.transactionCardLink.count();
    console.log(`\nTransactionCardLink total after apply: ${after}`);
  }
  await prisma.$disconnect();
  if (unmatched.length > 0 && !apply) process.exit(2);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
