// src/utils/id.js
import { customAlphabet } from 'nanoid';

// 定义字符集（不含易混淆字符如 1,l,0,O）和长度
const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
// 长度为6，足够唯一且比cuid短很多
const nanoid = customAlphabet(alphabet, 6);

export const generateId = () => nanoid();