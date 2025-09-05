// backend/app/src/utils/tokenCleaner.js

import prisma from '../db/prisma.js';

class TokenCleaner {
  constructor() {
    this.intervalId = null;
  }

  // 启动定期清理
  start() {
    // 每6小时清理一次过期的refresh token
    this.intervalId = setInterval(async () => {
      await this.cleanExpiredTokens();
    }, 6 * 60 * 60 * 1000); // 6小时

    // 立即执行一次清理
    this.cleanExpiredTokens();
  }

  // 停止定期清理
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  // 清理过期的refresh token
  async cleanExpiredTokens() {
    try {
      const result = await prisma.refreshToken.deleteMany({
        where: {
          expiresAt: {
            lt: new Date()
          }
        }
      });

      if (result.count > 0) {
        console.log(`清理了 ${result.count} 个过期的refresh token`);
      }
    } catch (error) {
      console.error('清理过期token时出错:', error);
    }
  }
}

// 创建单例实例
const tokenCleaner = new TokenCleaner();

export default tokenCleaner;