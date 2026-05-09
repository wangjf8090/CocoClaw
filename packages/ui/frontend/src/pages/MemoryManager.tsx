import React, { useState, useEffect } from 'react';
import {
  Database,
  Search,
  Filter,
  Plus,
  Trash2,
  Eye,
  Download,
  Upload,
  Calendar,
  Tag,
  FileText,
  RefreshCw
} from 'lucide-react';

interface Memory {
  id: string;
  type: 'text' | 'image' | 'code' | 'conversation';
  content: string;
  title: string;
  tags: string[];
  timestamp: string;
  importance: number;
  accessCount: number;
}

const MemoryManager: React.FC = () => {
  const [memories, setMemories] = useState<Memory[]>([
    {
      id: 'mem_001',
      type: 'text',
      title: 'User Preferences',
      content: 'User prefers concise responses with emojis. Likes to receive code examples.',
      tags: ['user', 'preferences', 'important'],
      timestamp: '2024-01-15T10:30:00Z',
      importance: 8,
      accessCount: 45
    },
    {
      id: 'mem_002',
      type: 'conversation',
      title: 'Project Discussion',
      content: 'Discussed the new feature implementation. User wants to prioritize performance over features.',
      tags: ['project', 'discussion'],
      timestamp: '2024-01-16T14:20:00Z',
      importance: 6,
      accessCount: 23
    },
    {
      id: 'mem_003',
      type: 'code',
      title: 'React Component Pattern',
      content: 'Custom hook pattern for data fetching with loading states. Uses SWR under the hood.',
      tags: ['code', 'react', 'reference'],
      timestamp: '2024-01-17T09:15:00Z',
      importance: 9,
      accessCount: 67
    },
    {
      id: 'mem_004',
      type: 'text',
      title: 'System Configuration',
      content: 'API endpoint configuration for production. Rate limits and authentication settings.',
      tags: ['config', 'system', 'production'],
      timestamp: '2024-01-18T16:45:00Z',
      importance: 7,
      accessCount: 12
    }
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [loading, setLoading] = useState(false);

  const filteredMemories = memories.filter(memory => {
    const matchesSearch = memory.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         memory.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         memory.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = selectedType === 'all' || memory.type === selectedType;
    return matchesSearch && matchesType;
  });

  const typeIcons: Record<string, React.ReactNode> = {
    text: <FileText className="w-4 h-4" />,
    code: <span className="text-xs font-mono">{'</>'}</span>,
    conversation: <span className="text-xs">💬</span>,
    image: <span className="text-xs">🖼️</span>
  };

  const typeColors: Record<string, string> = {
    text: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    code: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    conversation: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    image: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
  };

  const deleteMemory = (id: string) => {
    setMemories(prev => prev.filter(m => m.id !== id));
    if (selectedMemory?.id === id) {
      setSelectedMemory(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Memory Manager</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Browse and manage your agent's memories
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-secondary flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Import
          </button>
          <button className="btn-secondary flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Memory
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="card-body">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Search */}
            <div className="flex-1 min-w-64 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search memories..."
                className="input pl-10"
              />
            </div>

            {/* Type Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="input w-40"
              >
                <option value="all">All Types</option>
                <option value="text">Text</option>
                <option value="code">Code</option>
                <option value="conversation">Conversation</option>
                <option value="image">Image</option>
              </select>
            </div>

            {/* View Toggle */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-gray-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-gray-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                List
              </button>
            </div>

            {/* Refresh */}
            <button
              onClick={() => {
                setLoading(true);
                setTimeout(() => setLoading(false), 1000);
              }}
              className="btn-ghost p-2"
              disabled={loading}
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Memories</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {memories.length}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Text Memories</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {memories.filter(m => m.type === 'text').length}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Code Snippets</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {memories.filter(m => m.type === 'code').length}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Accesses</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {memories.reduce((sum, m) => sum + m.accessCount, 0)}
          </div>
        </div>
      </div>

      {/* Memories Grid/List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Memories List */}
        <div className={`lg:col-span-2 ${
          viewMode === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 gap-4'
            : 'space-y-4'
        }`}>
          {filteredMemories.map(memory => (
            <div
              key={memory.id}
              onClick={() => setSelectedMemory(memory)}
              className={`card cursor-pointer transition-all hover:border-primary-400 ${
                selectedMemory?.id === memory.id
                  ? 'border-primary-500 ring-2 ring-primary-500/20'
                  : ''
              }`}
            >
              <div className="card-body">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`p-2 rounded-lg ${typeColors[memory.type]}`}>
                      {typeIcons[memory.type]}
                    </span>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {memory.title}
                      </h3>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(memory.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium px-2 py-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 rounded-full">
                      {memory.importance}/10
                    </span>
                  </div>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
                  {memory.content}
                </p>

                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {memory.tags.slice(0, 3).map(tag => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                    {memory.tags.length > 3 && (
                      <span className="text-xs px-2 py-1 text-gray-500">
                        +{memory.tags.length - 3}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">
                    {memory.accessCount} views
                  </span>
                </div>
              </div>
            </div>
          ))}

          {filteredMemories.length === 0 && (
            <div className="col-span-2 card">
              <div className="card-body text-center py-12">
                <Database className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  No memories found matching your search
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Memory Detail Panel */}
        <div className="card">
          <div className="card-header">Memory Detail</div>
          <div className="card-body">
            {selectedMemory ? (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`p-2 rounded-lg ${typeColors[selectedMemory.type]}`}>
                      {typeIcons[selectedMemory.type]}
                    </span>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {selectedMemory.title}
                    </h3>
                  </div>
                  <p className="text-sm text-gray-500 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {new Date(selectedMemory.timestamp).toLocaleString()}
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Content
                  </h4>
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                      {selectedMemory.content}
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tags
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedMemory.tags.map(tag => (
                      <span
                        key={tag}
                        className="px-3 py-1 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-full text-sm"
                      >
                        <Tag className="w-3 h-3 inline mr-1" />
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Importance</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                      {selectedMemory.importance}/10
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Access Count</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                      {selectedMemory.accessCount}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button className="flex-1 btn-secondary flex items-center justify-center gap-2">
                    <Eye className="w-4 h-4" />
                    View Full
                  </button>
                  <button
                    onClick={() => deleteMemory(selectedMemory.id)}
                    className="btn-danger flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  Select a memory to view details
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MemoryManager;
