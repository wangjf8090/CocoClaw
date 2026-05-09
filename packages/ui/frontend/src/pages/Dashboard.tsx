import React, { useState, useEffect } from 'react';
import {
  Activity,
  Cpu,
  Database,
  Users,
  TrendingUp,
  Clock,
  Heart,
  Zap,
  MemoryStick
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface SystemStatus {
  uptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
  };
}

interface Stats {
  totalMemories: number;
  totalQueries: number;
  avgResponseTime: number;
  successRate: number;
}

const Dashboard: React.FC = () => {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [stats, setStats] = useState<Stats>({
    totalMemories: 0,
    totalQueries: 0,
    avgResponseTime: 0,
    successRate: 99.7
  });
  const [loading, setLoading] = useState(true);

  // 模拟数据
  const activityData = [
    { time: '00:00', queries: 12, memories: 3 },
    { time: '04:00', queries: 8, memories: 2 },
    { time: '08:00', queries: 45, memories: 8 },
    { time: '12:00', queries: 78, memories: 15 },
    { time: '16:00', queries: 92, memories: 12 },
    { time: '20:00', queries: 65, memories: 9 },
    { time: '24:00', queries: 34, memories: 5 }
  ];

  const recentActivities = [
    { id: 1, type: 'memory', action: 'Created new memory', time: '2 min ago', icon: Database },
    { id: 2, type: 'soul', action: 'Personality evolved', time: '15 min ago', icon: Heart },
    { id: 3, type: 'query', action: 'Processed user query', time: '30 min ago', icon: Activity },
    { id: 4, type: 'system', action: 'Health check passed', time: '1 hour ago', icon: Cpu },
    { id: 5, type: 'memory', action: 'Vector index updated', time: '2 hours ago', icon: MemoryStick }
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 实际实现中调用 API
        // const response = await axios.get('/api/dashboard/status');
        // setSystemStatus(response.data.data.system);

        // 模拟数据
        setSystemStatus({
          uptime: 86400,
          memory: {
            rss: 125829120,
            heapTotal: 83886080,
            heapUsed: 52428800
          }
        });

        setStats({
          totalMemories: 1247,
          totalQueries: 8943,
          avgResponseTime: 245,
          successRate: 99.7
        });
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const formatBytes = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Welcome back! Here's what's happening with your agent.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          <span className="text-sm text-green-600 dark:text-green-400 font-medium">
            All Systems Operational
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Memories</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {stats.totalMemories.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                <Database className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
              <span className="text-green-600 dark:text-green-400">+12%</span>
              <span className="text-gray-500 dark:text-gray-400 ml-2">vs last week</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Queries Processed</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {stats.totalQueries.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                <Activity className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
              <span className="text-green-600 dark:text-green-400">+8%</span>
              <span className="text-gray-500 dark:text-gray-400 ml-2">vs last week</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Avg Response Time</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {stats.avgResponseTime}ms
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
              <span className="text-green-600 dark:text-green-400">-5%</span>
              <span className="text-gray-500 dark:text-gray-400 ml-2">faster</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Success Rate</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {stats.successRate}%
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="badge-success">Excellent</span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts and Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Chart */}
        <div className="lg:col-span-2 card">
          <div className="card-header">Activity Overview</div>
          <div className="card-body">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activityData}>
                  <defs>
                    <linearGradient id="colorQueries" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorMemories" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="time" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="queries"
                    stroke="#3b82f6"
                    fillOpacity={1}
                    fill="url(#colorQueries)"
                    name="Queries"
                  />
                  <Area
                    type="monotone"
                    dataKey="memories"
                    stroke="#8b5cf6"
                    fillOpacity={1}
                    fill="url(#colorMemories)"
                    name="Memories"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* System Status */}
        <div className="card">
          <div className="card-header">System Status</div>
          <div className="card-body space-y-4">
            {systemStatus && (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-gray-400" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Uptime</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatUptime(systemStatus.uptime)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MemoryStick className="w-5 h-5 text-gray-400" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">RSS Memory</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatBytes(systemStatus.memory.rss)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Cpu className="w-5 h-5 text-gray-400" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Heap Used</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatBytes(systemStatus.memory.heapUsed)}
                  </span>
                </div>

                <div className="pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Memory Usage</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {((systemStatus.memory.heapUsed / systemStatus.memory.heapTotal) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary-500 to-soul-500 rounded-full transition-all duration-500"
                      style={{ width: `${(systemStatus.memory.heapUsed / systemStatus.memory.heapTotal) * 100}%` }}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activities */}
      <div className="card">
        <div className="card-header">Recent Activities</div>
        <div className="card-body">
          <div className="space-y-4">
            {recentActivities.map((activity) => {
              const Icon = activity.icon;
              return (
                <div key={activity.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                    <Icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{activity.action}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{activity.time}</p>
                  </div>
                  <span className={`badge ${
                    activity.type === 'system' ? 'badge-info' :
                    activity.type === 'memory' ? 'badge-success' :
                    activity.type === 'soul' ? 'badge-warning' :
                    'badge-info'
                  }`}>
                    {activity.type}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

// 临时组件
const CheckCircle: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

export default Dashboard;
