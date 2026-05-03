// 把 register({ onRequest: [...] }) 的 hooks 真正挂到当前 plugin scope。
// Fastify 不会自动从 register options 应用 hooks，必须在 plugin 内显式 addHook。
export function applyAuth(fastify, opts) {
  if (!opts || !Array.isArray(opts.onRequest)) return;
  for (const hook of opts.onRequest) {
    fastify.addHook('onRequest', hook);
  }
}
