// frontend/app/src/api/member.js

import request from './index.js';



// 获取会员列表的函数
export const getMembers = (params) => {
  return request({
    url: '/members',
    method: 'get',
    params,
  });
};

// --- START: 确保存在此函数 ---
// 新增会员的函数
export const addMember = (data) => {
  return request({
    url: '/members',
    method: 'post',
    data,
  });
};
// --- END: 确保存在此函数 ---



// --- 新增 ---
export const updateMember = (id, data) => {
  return request({
    url: `/members/${id}`,
    method: 'put',
    data,
  });
};

// 这个接口现在执行的是逻辑删除
export const deleteMember = (id) => {
  return request({
    url: `/members/${id}`,
    method: 'delete',
  });
};

// --- 新增：物理删除会员的API ---
export const purgeMember = (id) => {
  return request({
    url: `/members/${id}/purge`,
    method: 'delete',
  });
};


// --- 新增：根据ID获取单个会员 ---
export const getMemberById = (id) => {
  return request({
    url: `/members/${id}`,
    method: 'get',
  });
};

// --- 新增：为会员办卡 ---
export const issueNewCard = (memberId, data) => {
  return request({
    url: `/members/${memberId}/cards`,
    method: 'post',
    data, // { cardTypeId, expiryDate }
  });
};