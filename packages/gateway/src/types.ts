/**
 * Gateway Message Types
 * Defines the message protocol between clients and the Gateway
 */

export type MessageType =
  | 'connect'
  | 'hello'
  | 'chat'
  | 'agent'
  | 'tool_use'
  | 'tool_result'
  | 'heartbeat'
  | 'presence'
  | 'error'
  | 'shutdown';

export interface GatewayMessage {
  id: string;
  type: MessageType;
  timestamp: number;
  payload: Record<string, unknown>;
  sessionId?: string;
}

export interface SessionState {
  id: string;
  createdAt: number;
  lastActivity: number;
  messages: GatewayMessage[];
  isProcessing: boolean;
}

export interface GatewayConfig {
  port: number;
  host: string;
  authToken?: string;
  maxSessionSize: number;
  heartbeatInterval: number;
}

export const DEFAULT_GATEWAY_CONFIG: GatewayConfig = {
  port: 18789,
  host: '127.0.0.1',
  maxSessionSize: 1000,
  heartbeatInterval: 30000,
};
