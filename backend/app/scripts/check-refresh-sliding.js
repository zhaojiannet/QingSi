// 自检：refresh 接口的滑动续期。容器内跑 `npx tsx scripts/check-refresh-sliding.js`。
// 直接造一条 refreshToken 记录再调接口，绕开登录验证码；断言失败即抛错退出非 0。

import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import prisma from '../src/db/prisma.js';

const BASE = process.env.CHECK_BASE_URL || 'http://localhost:3000';
const VALIDITY_DAYS = 7;

const plain = randomBytes(64).toString('hex');
const user = await prisma.user.findFirst({ select: { id: true } });
assert.ok(user, '库里没有任何用户，先跑 init-admin.js');

// 故意把到期时间设成只剩 1 小时，续期后应被顶回完整的 7 天
const nearExpiry = new Date(Date.now() + 60 * 60 * 1000);
const record = await prisma.refreshToken.create({
  data: {
    token: createHash('sha256').update(plain).digest('hex'),
    expiresAt: nearExpiry,
    validityDays: VALIDITY_DAYS,
    userId: user.id,
  },
});

try {
  const res = await fetch(`${BASE}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: `refreshToken=${plain}` },
    body: '{}',
  });
  assert.equal(res.status, 200, `续期应返回 200，实际 ${res.status}`);
  assert.ok((await res.json()).accessToken, '响应体应含 accessToken');

  const setCookie = res.headers.get('set-cookie') || '';
  assert.match(setCookie, /refreshToken=/, '续期必须重新下发 refreshToken cookie');
  const maxAge = Number(setCookie.match(/Max-Age=(\d+)/i)?.[1]);
  assert.equal(maxAge, VALIDITY_DAYS * 24 * 60 * 60, `cookie Max-Age 应为完整时长，实际 ${maxAge}`);

  const after = await prisma.refreshToken.findUnique({ where: { id: record.id } });
  const remainingDays = (after.expiresAt - Date.now()) / 86400000;
  assert.ok(remainingDays > VALIDITY_DAYS - 0.01, `库里到期时间未顺延，剩余 ${remainingDays} 天`);

  console.log('滑动续期正常');
} finally {
  await prisma.refreshToken.delete({ where: { id: record.id } }).catch(() => {});
  await prisma.$disconnect();
}
