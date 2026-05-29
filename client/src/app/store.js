// 全局状态管理

import { signal, computed } from '@preact/signals';

// 导航状态
export const currentPage = signal('player');
export const pages = ['player', 'chat', 'profile', 'settings'];

// 播放器状态
export const currentSong = signal(null);
export const isPlaying = signal(false);
export const progress = signal(0);
export const volume = signal(80);
export const playMode = signal('sequence');
export const queue = signal([]);
export const queueIndex = signal(-1);

// 聊天状态
export const messages = signal([]);
export const isStreaming = signal(false);

// 天气状态
export const weather = signal(null);

// 用户状态
export const userState = signal('idle');

// 计算属性
export const hasNext = computed(() => queueIndex.value < queue.value.length - 1);
export const hasPrev = computed(() => queueIndex.value > 0);

// 操作方法
export function addMessage(role, content, metadata = {}) {
  // 去重：如果最后一条同角色消息内容完全相同，跳过
  const last = messages.value[messages.value.length - 1];
  if (last && last.role === role && last.content === content) return;

  messages.value = [...messages.value, {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    role,
    content,
    timestamp: Date.now(),
    metadata
  }];
}

export function addToQueue(song) {
  const exists = queue.value.some(s => s.id === song.id);
  if (!exists) {
    queue.value = [...queue.value, song];
  }
}

export function removeFromQueue(index) {
  const newQueue = [...queue.value];
  newQueue.splice(index, 1);
  queue.value = newQueue;
}

export function clearQueue() {
  queue.value = [];
  queueIndex.value = -1;
}

export function playSong(song, index) {
  currentSong.value = song;
  queueIndex.value = index;
  isPlaying.value = true;
  progress.value = 0;
}
