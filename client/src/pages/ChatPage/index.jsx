// 右侧 AI 聊天面板

import { useSignal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { messages, isStreaming, addMessage } from '../../app/store.js';
import { sendWS, onWS } from '../../services/websocket.js';
import { play } from '../../services/audioEngine.js';

export function ChatPanel() {
  const inputText = useSignal('');
  const streamText = useSignal('');
  const doneRef = useRef(false);
  const chatEndRef = useRef(null);

  // 使用 useEffect（不是 signals effect），确保只注册一次
  useEffect(() => {
    const unsub1 = onWS('chat.stream.append', (content) => {
      doneRef.current = false;
      streamText.value += content;
    });

    const unsub2 = onWS('chat.stream', (payload) => {
      if (payload.done && !doneRef.current && streamText.value) {
        doneRef.current = true;
        const text = streamText.value;
        const songs = payload.songs || [];
        streamText.value = '';
        addMessage('assistant', text, { songs });
      }
    });

    return () => {
      unsub1();
      unsub2();
    };
  }, []); // 空依赖 = 只运行一次

  // 自动滚动到底部
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.value, streamText.value]);

  function handleSend() {
    const text = inputText.value.trim();
    if (!text || isStreaming.value) return;
    addMessage('user', text);
    sendWS('chat.send', { content: text });
    inputText.value = '';
    streamText.value = '';
    doneRef.current = false;
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleQuickAction(text) {
    addMessage('user', text);
    sendWS('chat.send', { content: text });
    streamText.value = '';
    doneRef.current = false;
  }

  // 合并消息列表
  const msgs = messages.value;
  const streaming = isStreaming.value;
  const stext = streamText.value;
  const allMessages = [...msgs];
  if (streaming && stext) {
    allMessages.push({
      id: '_streaming_',
      role: 'assistant',
      content: stext,
      timestamp: Date.now()
    });
  }

  return (
    <div class="chat-page">
      <div class="chat-header">
        <h2>Deepudio DJ</h2>
        <span class="chat-status">
          {streaming ? '正在思考...' : '在线'}
        </span>
      </div>

      <div class="chat-messages">
        {allMessages.length === 0 && (
          <div class="chat-welcome">
            <div class="welcome-icon">📻</div>
            <p class="welcome-text">
              嗨！我是你的私人DJ Deepudio<br />
              告诉我你想听什么，或者让我根据心情推荐
            </p>
          </div>
        )}
        {allMessages.map(msg => (
          <div key={msg.id} class={`chat-bubble ${msg.role}`}>
            <div class="bubble-content">{msg.content}</div>
            {msg.metadata?.songs?.map(s => (
              <button key={s.id} class="song-chip"
                onClick={() => { play(s); }}
                title="点击播放">
                {s.title} - {s.artist}
              </button>
            ))}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <div class="quick-actions">
        <button onClick={() => handleQuickAction('来点轻松的音乐')}>轻松</button>
        <button onClick={() => handleQuickAction('推荐适合工作的音乐')}>工作</button>
        <button onClick={() => handleQuickAction('今天天气怎么样')}>天气</button>
      </div>

      <div class="chat-input-area">
        <input
          type="text"
          class="chat-input"
          placeholder="跟DJ说点什么..."
          value={inputText.value}
          onInput={(e) => inputText.value = e.target.value}
          onKeyDown={handleKeyDown}
          disabled={streaming}
        />
        <button
          class="chat-send"
          onClick={handleSend}
          disabled={streaming || !inputText.value.trim()}
        >
          发送
        </button>
      </div>
    </div>
  );
}
