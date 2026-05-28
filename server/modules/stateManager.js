// 状态记忆管理 - 维护用户当前状态、历史状态、长期偏好模型

const state = {
  session: {
    currentConversation: [],
    currentSong: null,
    currentIntent: null,
    connectedAt: null
  },
  shortTerm: {
    todayPlays: [],
    todaySummary: null
  },
  context: {
    weather: null,
    weatherUpdatedAt: null,
    currentState: 'idle',
    lastInteraction: null
  }
};

export function getState() {
  return state;
}

export function updateSession(partial) {
  Object.assign(state.session, partial);
}

export function updateContext(partial) {
  Object.assign(state.context, partial);
  state.context.lastInteraction = Date.now();
}

export function addToConversation(role, content, intent = null) {
  state.session.currentConversation.push({
    role,
    content,
    intent,
    timestamp: Date.now()
  });

  // 只保留最近20轮
  if (state.session.currentConversation.length > 40) {
    state.session.currentConversation = state.session.currentConversation.slice(-40);
  }
}

export function getRecentMessages(count = 10) {
  return state.session.currentConversation.slice(-count);
}

export function setCurrentSong(song) {
  state.session.currentSong = song;
}

export function isIdle(thresholdMs = 900000) {
  if (!state.context.lastInteraction) return true;
  return Date.now() - state.context.lastInteraction > thresholdMs;
}

export function getFullContext() {
  return {
    weather: state.context.weather,
    currentState: state.context.currentState,
    currentSong: state.session.currentSong
      ? `${state.session.currentSong.title} - ${state.session.currentSong.artist}`
      : null,
    recentMessages: getRecentMessages(5)
  };
}
