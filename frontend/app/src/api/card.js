// frontend/app/src/api/card.js

import request from './index.js';

// 办卡并生成消费记录
export const issueCardWithTransaction = (data) => {
  return request({
    url: '/cards/issue-with-transaction',
    method: 'post',
    data, // { memberId, cardTypeId }
  });
};

