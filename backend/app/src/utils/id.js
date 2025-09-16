// backend/app/src/utils/id.js

import { customAlphabet } from 'nanoid';
import { validateCardIdFormat } from './validators.js';

// 定义字符集（不含易混淆字符如 1,l,0,O）和长度
const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
// 长度为6，足够唯一且比cuid短很多
const nanoid = customAlphabet(alphabet, 6);

export const generateId = () => {
  const id = nanoid();
  
  // 验证生成的ID格式
  if (!validateCardIdFormat(id)) {
    throw new Error(`生成的ID格式不符合要求: ${id}`);
  }
  
  return id;
};