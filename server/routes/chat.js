// 聊天相关 API 路由（辅助用，主要走 WebSocket）

export default async function chatRoutes(fastify) {
  fastify.get('/api/chat/history', async () => {
    // 历史对话从数据库读取，暂返回空
    return { messages: [] };
  });
}
