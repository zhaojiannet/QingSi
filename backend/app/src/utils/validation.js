// SQL注入防护 - 验证ID格式
export function isValidId(id) {
  return /^[a-zA-Z0-9-_]+$/.test(id);
}
