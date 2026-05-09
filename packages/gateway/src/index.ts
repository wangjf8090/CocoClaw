/**
 * SelfClaw Gateway Module
 * Entry point for the Gateway control plane
 */

export { GatewayServer } from './server.js';
export { LaneManager, Lane } from './lane.js';
export { AuthMiddleware } from './auth.js';
export { MessageRouter } from './router.js';
export * from './types.js';

import { GatewayServer } from './server.js';

/**
 * Create and start a Gateway server
 */
export async function startGateway(config?: {
  port?: number;
  host?: string;
  authToken?: string;
}) {
  const server = new GatewayServer(config);
  await server.start(config?.port, config?.host);
  return server;
}

// Auto-start if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startGateway().catch(console.error);
}
