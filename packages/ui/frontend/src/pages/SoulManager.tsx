import React, { useState, useEffect } from 'react';
import {
  Heart,
  Brain,
  Sparkles,
  Clock,
  History,
  Camera,
  RotateCcw,
  Save,
  Plus,
  Trash2,
  Smile,
  Zap,
  Users
} from 'lucide-react';

interface Personality {
  name: string;
  nickname: string;
  catchphrases: string[];
  speakingStyle: {
    formality: number;
    enthusiasm: number;
    humor: number;
    empathy: number;
    directness: number;
  };
}

interface EmotionState {
  mood: string;
  energy: number;
  focus: number;
  stress: number;
}

interface Snapshot {
  id: string;
  timestamp: string;
  description: string;
}

const SoulManager: React.FC = () => {
  const [personality, setPersonality] = useState<Personality>({
    name: 'Claw',
    nickname: '小爪',
    catchphrases: [
      '让我来帮你处理这个~',
      '没问题，交给我！',
      '我正在进化，请多指教~'
    ],
    speakingStyle: {
      formality: 3,
      enthusiasm: 8,
      humor: 5,
      empathy: 7,
      directness: 6
    }
  });

  const [emotion, setEmotion] = useState<EmotionState>({
    mood: 'neutral',
    energy: 5,
    focus: 5,
    stress: 2
  });

  const [snapshots, setSnapshots] = useState<Snapshot[]>([
    { id: 'snap_001', timestamp: '2024-01-15T10:30:00Z', description: 'Initial personality setup' },
    { id: 'snap_002', timestamp: '2024-01-16T14:20:00Z', description: 'Adjusted enthusiasm level' },
    { id: 'snap_003', timestamp: '2024-01-17T09:15:00Z', description: 'Added new catchphrases' }
  ]);

  const [newCatchphrase, setNewCatchphrase] = useState('');
  const [activeTab, setActiveTab] = useState<'personality' | 'emotion' | 'evolution'>('personality');
  const [saving, setSaving] = useState(false);

  const moodEmojis: Record<string, string> = {
    neutral: '😐',
    happy: '😊',
    excited: '🎉',
    thoughtful: '🤔',
    concerned: '😟',
    focused: '💪',
    friendly: '🤝'
  };

  const moodLabels: Record<string, string> = {
    neutral: 'Neutral',
    happy: 'Happy',
    excited: 'Excited',
    thoughtful: 'Thoughtful',
    concerned: 'Concerned',
    focused: 'Focused',
    friendly: 'Friendly'
  };

  const handleStyleChange = (key: keyof Personality['speakingStyle'], value: number) => {
    setPersonality(prev => ({
      ...prev,
      speakingStyle: { ...prev.speakingStyle, [key]: value }
    }));
  };

  const addCatchphrase = () => {
    if (newCatchphrase.trim() && !personality.catchphrases.includes(newCatchphrase)) {
      setPersonality(prev => ({
        ...prev,
        catchphrases: [...prev.catchphrases, newCatchphrase.trim()]
      }));
      setNewCatchphrase('');
    }
  };

  const removeCatchphrase = (phrase: string) => {
    setPersonality(prev => ({
      ...prev,
      catchphrases: prev.catchphrases.filter(p => p !== phrase)
    }));
  };

  const createSnapshot = async () => {
    setSaving(true);
    // 模拟 API 调用
    await new Promise(resolve => setTimeout(resolve, 1000));
    const newSnapshot: Snapshot = {
      id: `snap_${Date.now()}`,
      timestamp: new Date().toISOString(),
      description: 'Manual snapshot'
    };
    setSnapshots([newSnapshot, ...snapshots]);
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">SOUL Manager</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Configure your agent's personality and emotional state</p>
        </div>
        <button onClick={createSnapshot} disabled={saving} className="btn-primary flex items-center gap-2">
          <Camera className="w-4 h-4" />
          {saving ? 'Creating...' : 'Create Snapshot'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {[
          { id: 'personality', label: 'Personality', icon: Brain },
          { id: 'emotion', label: 'Emotion', icon: Heart },
          { id: 'evolution', label: 'Evolution', icon: History }
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Personality Tab */}
      {activeTab === 'personality' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Info */}
          <div className="card">
            <div className="card-header flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-soul-500" />
              Basic Identity
            </div>
            <div className="card-body space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Agent Name
                </label>
                <input
                  type="text"
                  value={personality.name}
                  onChange={(e) => setPersonality({ ...personality, name: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nickname
                </label>
                <input
                  type="text"
                  value={personality.nickname}
                  onChange={(e) => setPersonality({ ...personality, nickname: e.target.value })}
                  className="input"
                />
              </div>
            </div>
          </div>

          {/* Speaking Style */}
          <div className="card">
            <div className="card-header flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-soul-500" />
              Speaking Style
            </div>
            <div className="card-body space-y-6">
              {Object.entries(personality.speakingStyle).map(([key, value]) => (
                <div key={key}>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                      {key}
                    </label>
                    <span className="text-sm text-gray-500">{value}/10</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={value}
                    onChange={(e) => handleStyleChange(key as any, parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-soul-500"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Catchphrases */}
          <div className="lg:col-span-2 card">
            <div className="card-header flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-soul-500" />
                Catchphrases
              </div>
            </div>
            <div className="card-body">
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newCatchphrase}
                  onChange={(e) => setNewCatchphrase(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addCatchphrase()}
                  placeholder="Add a new catchphrase..."
                  className="flex-1 input"
                />
                <button onClick={addCatchphrase} className="btn-primary">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {personality.catchphrases.map((phrase, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 px-3 py-2 bg-soul-50 dark:bg-soul-900/20 text-soul-700 dark:text-soul-300 rounded-lg group"
                >
                  <span className="text-sm">{phrase}</span>
                  <button
                    onClick={() => removeCatchphrase(phrase)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Emotion Tab */}
      {activeTab === 'emotion' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Current Mood */}
          <div className="card">
            <div className="card-header flex items-center gap-2">
              <Smile className="w-5 h-5 text-soul-500" />
              Current Mood
            </div>
            <div className="card-body text-center">
              <div className="text-6xl mb-4">{moodEmojis[emotion.mood]}</div>
              <p className="text-xl font-semibold text-gray-900 dark:text-white">
                {moodLabels[emotion.mood]}
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {Object.keys(moodLabels).map(mood => (
                  <button
                    key={mood}
                    onClick={() => setEmotion({ ...emotion, mood })}
                    className={`p-2 rounded-lg text-center transition-all ${
                      emotion.mood === mood
                        ? 'bg-soul-100 dark:bg-soul-900/30 border-2 border-soul-500'
                        : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <span className="text-xl">{moodEmojis[mood]}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Energy Levels */}
          <div className="lg:col-span-2 card">
            <div className="card-header flex items-center gap-2">
              <Zap className="w-5 h-5 text-soul-500" />
              Energy Levels
            </div>
            <div className="card-body space-y-6">
              <div>
                <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Energy
                </span>
                <span className="text-sm text-gray-500">{emotion.energy}/10</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                value={emotion.energy}
                onChange={(e) => setEmotion({ ...emotion, energy: parseInt(e.target.value) })}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
              />
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Focus
                </span>
                <span className="text-sm text-gray-500">{emotion.focus}/10</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                value={emotion.focus}
                onChange={(e) => setEmotion({ ...emotion, focus: parseInt(e.target.value) })}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Stress
                </span>
                <span className="text-sm text-gray-500">{emotion.stress}/10</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                value={emotion.stress}
                onChange={(e) => setEmotion({ ...emotion, stress: parseInt(e.target.value) })}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Evolution Tab */}
      {activeTab === 'evolution' && (
        <div className="space-y-6">
          <div className="card">
            <div className="card-header flex items-center gap-2">
              <History className="w-5 h-5 text-soul-500" />
              Snapshots History
            </div>
            <div className="card-body">
              <div className="space-y-4">
                {snapshots.map((snapshot) => (
                  <div
                    key={snapshot.id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-soul-100 dark:bg-soul-900/30 rounded-lg flex items-center justify-center">
                        <Camera className="w-5 h-5 text-soul-600 dark:text-soul-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{snapshot.description}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {new Date(snapshot.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <button className="btn-ghost flex items-center gap-2">
                      <RotateCcw className="w-4 h-4" />
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <button className="btn-primary flex items-center gap-2">
          <Save className="w-4 h-4" />
          Save Changes
        </button>
      </div>
    </div>
  );
};

export default SoulManager;
