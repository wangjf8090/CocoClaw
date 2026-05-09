/**
 * UI Backend 类型定义
 */

export interface ServerConfig {
  port: number;
  host: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  corsOrigin: string | string[];
  enableMetrics: boolean;
  enableHealthCheck: boolean;
  rateLimitWindow: number;
  rateLimitMax: number;
}

export interface UserCredentials {
  username: string;
  password: string;
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface JWTPayload {
  userId: string;
  username: string;
  role: string;
  permissions: string[];
}

export interface SystemStatus {
  uptime: number;
  memoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  cpuUsage: number;
  activeConnections: number;
  soulStatus: 'running' | 'stopped' | 'error';
  memoryStatus: 'running' | 'stopped' | 'error';
  gatewayStatus: 'running' | 'stopped' | 'error';
  timestamp: Date;
}

export interface DashboardStats {
  totalMemories: number;
  totalUsers: number;
  totalSessions: number;
  avgResponseTime: number;
  successRate: number;
  recentActivities: ActivityLog[];
  soulMood: string;
  soulEnergy: number;
}

export interface ActivityLog {
  id: string;
  timestamp: Date;
  type: 'memory' | 'query' | 'system' | 'user';
  action: string;
  userId?: string;
  details?: any;
}

export interface MemorySearchResult {
  id: string;
  type: string;
  content: string;
  timestamp: Date;
  relevance: number;
  tags: string[];
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: Date;
}
