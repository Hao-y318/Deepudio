// 应用主组件 - 三分栏：左电台 + 中歌词 + 右聊天

import { useEffect, useState } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import { connectWS, disconnectWS } from '../services/websocket.js';
import { initAudioEngine } from '../services/audioEngine.js';
import { currentSong, isPlaying, progress } from './store.js';
import { PlayerPanel } from '../pages/PlayerPage/index.jsx';
import { LyricPanel } from '../pages/LyricPage/index.jsx';
import { ChatPanel } from '../pages/ChatPage/index.jsx';
import { SettingsDialog } from '../pages/SettingsPage/index.jsx';
import { ProfileDialog } from '../pages/ProfilePage/index.jsx';
import { FluidBlobs } from '../components/Common/FluidBlobs.jsx';
import { BackgroundDecor } from '../components/Common/BackgroundDecor.jsx';
import { PlaylistPicker } from '../components/Player/PlaylistPicker.jsx';

export function App() {
  const [ready, setReady] = useState(false);
  const showSettings = useSignal(false);
  const showProfile = useSignal(false);
  const showPlaylists = useSignal(false);

  useEffect(() => {
    initAudioEngine();
    connectWS();
    setReady(true);
    return () => disconnectWS();
  }, []);

  return (
    <div class="app">
      <header class="app-header">
        <div class="app-title">Deepudio Radio</div>
        <div class="header-actions">
          <button class="header-btn" onClick={() => showPlaylists.value = true}>歌单</button>
          <button class="header-btn" onClick={() => showProfile.value = true}>画像</button>
          <button class="header-btn" onClick={() => showSettings.value = true}>设置</button>
        </div>
      </header>

      <FluidBlobs />
      <BackgroundDecor />

      {ready && (
        <div class="app-body">
          <div class="panel-left">
            <PlayerPanel />
          </div>
          <div class="panel-mid">
            <LyricPanel />
          </div>
          <div class="panel-right">
            <ChatPanel />
          </div>
        </div>
      )}

      {showSettings.value && (
        <SettingsDialog onClose={() => showSettings.value = false} />
      )}
      {showPlaylists.value && (
        <PlaylistPicker show={true} onClose={() => showPlaylists.value = false}
          onSelect={() => showPlaylists.value = false} />
      )}
      {showProfile.value && (
        <ProfileDialog onClose={() => showProfile.value = false} />
      )}
    </div>
  );
}
