// backend/app/src/utils/httpError.js
// 业务错误：带 statusCode，由全局 setErrorHandler 按该状态码与消息返回，
// 不会被 500 兜底吞掉。用于在事务回调中 throw 触发回滚同时返回可读的客户端错误。
export function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}
