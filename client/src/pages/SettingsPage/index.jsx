// 设置弹窗

import { useState, useEffect } from 'preact/hooks';
import { api } from '../../services/api.js';

const TTS_VOICES = [
  { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓（女声，推荐）' },
  { id: 'zh-CN-YunxiNeural', name: '云希（男声）' },
  { id: 'zh-CN-YunjianNeural', name: '云健（男声，沉稳）' },
  { id: 'zh-CN-XiaoyiNeural', name: '晓伊（女声，活泼）' }
];

export function SettingsDialog({ onClose }) {
  const [form, setForm] = useState({
    aiApiKey: '',
    aiModel: 'deepseek-v4-pro',
    neteaseCookie: '',
    likedPlaylistId: '',
    extraPlaylistIds: '',
    weatherCity: '',
    weatherApiKey: '',
    ttsEnabled: true,
    ttsVoice: 'zh-CN-XiaoxiaoNeural',
    djMode: true,
    morningGreeting: true,
    morningTime: '07:30',
    weatherAlert: true,
    autoContinue: true,
    // 跟踪哪些字段已保存
    apiKeySaved: false,
    cookieSaved: false,
    weatherKeySaved: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    try {
      const s = await api.getSettings();
      const apiKeySaved = s.ai?.apiKey === '******';
      const cookieSaved = s.netease?.cookie === '******';
      const weatherKeySaved = s.weather?.apiKey === '******';

      setForm(prev => ({
        ...prev,
        aiApiKey: '',
        aiModel: s.ai?.model || 'deepseek-v4-pro',
        neteaseCookie: '',
        likedPlaylistId: s.netease?.likedPlaylistId || '',
        extraPlaylistIds: (s.netease?.extraPlaylistIds || []).join(','),
        weatherCity: s.weather?.city || '',
        weatherApiKey: '',
        apiKeySaved,
        cookieSaved,
        weatherKeySaved,
        ttsEnabled: s.tts?.enabled ?? true,
        ttsVoice: s.tts?.voice || 'zh-CN-XiaoxiaoNeural',
        djMode: s.tts?.djMode ?? true,
        morningGreeting: s.scheduler?.morningGreeting ?? true,
        morningTime: s.scheduler?.morningTime || '07:30',
        weatherAlert: s.scheduler?.weatherAlert ?? true,
        autoContinue: s.scheduler?.autoContinue ?? true
      }));
    } catch (err) {
      console.error('Settings load error:', err);
    } finally {
      setLoading(false);
    }
  }

  function update(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      await api.updateSettings({
        ai: { apiKey: form.aiApiKey, model: form.aiModel },
        netease: {
          cookie: form.neteaseCookie,
          likedPlaylistId: form.likedPlaylistId,
          extraPlaylistIds: form.extraPlaylistIds.split(',').map(s => s.trim()).filter(Boolean)
        },
        weather: { city: form.weatherCity, apiKey: form.weatherApiKey },
        tts: { enabled: form.ttsEnabled, voice: form.ttsVoice, djMode: form.djMode },
        scheduler: {
          morningGreeting: form.morningGreeting, morningTime: form.morningTime,
          weatherAlert: form.weatherAlert, autoContinue: form.autoContinue
        }
      });
      setMessage('保存成功');
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      console.error('Settings save error:', err);
      setMessage(`保存失败: ${err.message || '未知错误'}`);
      setTimeout(() => setMessage(''), 4000);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div class="settings-overlay" onClick={onClose}>
        <div class="settings-dialog" onClick={e => e.stopPropagation()}>
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div class="settings-overlay" onClick={onClose}>
      <div class="settings-dialog" onClick={e => e.stopPropagation()}>
        <h2>设置<button class="settings-close" onClick={onClose}>✕</button></h2>

        <form onSubmit={handleSave}>
          {/* DeepSeek API */}
          <div class="settings-section">
            <h3>AI 大脑 (DeepSeek)</h3>
            <label>
              API Key {form.apiKeySaved && <span style="color:#34d399;font-size:11px">已保存</span>}
              <input type="password"
                placeholder={form.apiKeySaved ? '已设置，留空不修改' : 'sk-...'}
                value={form.aiApiKey}
                onInput={e => update('aiApiKey', e.target.value)} />
            </label>
            <label>
              模型
              <input type="text" placeholder="deepseek-v4-pro" value={form.aiModel}
                onInput={e => update('aiModel', e.target.value)} />
            </label>
          </div>

          {/* 网易云 */}
          <div class="settings-section">
            <h3>网易云音乐</h3>
            <label>
              登录 Cookie {form.cookieSaved && <span style="color:#34d399;font-size:11px">已保存</span>}
              <textarea placeholder={form.cookieSaved ? '已设置，留空不修改' : '从浏览器复制网易云音乐Cookie粘贴'}
                value={form.neteaseCookie}
                onInput={e => update('neteaseCookie', e.target.value)} rows="3" />
            </label>
            <label>
              我喜欢歌单ID（自动获取，也可手动填写）
              <input type="text" placeholder="填写后优先使用" value={form.likedPlaylistId}
                onInput={e => update('likedPlaylistId', e.target.value)} />
            </label>
            <label>
              额外歌单ID（多个用逗号分隔）
              <input type="text" placeholder="如 12345,67890" value={form.extraPlaylistIds}
                onInput={e => update('extraPlaylistIds', e.target.value)} />
            </label>
          </div>

          {/* 天气 */}
          <div class="settings-section">
            <h3>天气联动</h3>
            <p style="font-size:11px;color:var(--text-dim);margin-bottom:8px">
              无需 API Key 也能获取天气（使用免费接口）
            </p>
            <label>
              城市
              <input type="text" placeholder="如 Shanghai、Beijing" value={form.weatherCity}
                onInput={e => update('weatherCity', e.target.value)} />
            </label>
            <label>
              OpenWeatherMap API Key（可选）{form.weatherKeySaved && <span style="color:#34d399;font-size:11px">已保存</span>}
              <input type="password"
                placeholder={form.weatherKeySaved ? '已设置，留空不修改' : '免费申请 openweathermap.org'}
                value={form.weatherApiKey}
                onInput={e => update('weatherApiKey', e.target.value)} />
            </label>
          </div>

          {/* TTS */}
          <div class="settings-section">
            <h3>语音播报</h3>
            <label class="toggle-label">
              <input type="checkbox" checked={form.ttsEnabled}
                onChange={e => update('ttsEnabled', e.target.checked)} />
              启用语音播报
            </label>
            <label class="toggle-label">
              <input type="checkbox" checked={form.djMode}
                onChange={e => update('djMode', e.target.checked)} />
              DJ模式（播报歌名和推荐理由）
            </label>
            <label>
              语音
              <select value={form.ttsVoice} onChange={e => update('ttsVoice', e.target.value)}>
                {TTS_VOICES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </label>
          </div>

          {/* 调度 */}
          <div class="settings-section">
            <h3>智能调度</h3>
            <label class="toggle-label">
              <input type="checkbox" checked={form.morningGreeting}
                onChange={e => update('morningGreeting', e.target.checked)} />
              早晨问候
            </label>
            <label class="toggle-label">
              <input type="checkbox" checked={form.weatherAlert}
                onChange={e => update('weatherAlert', e.target.checked)} />
              天气变化提醒
            </label>
            <label class="toggle-label">
              <input type="checkbox" checked={form.autoContinue}
                onChange={e => update('autoContinue', e.target.checked)} />
              静默自动续播
            </label>
            <label>
              早晨问候时间
              <input type="time" value={form.morningTime}
                onInput={e => update('morningTime', e.target.value)} />
            </label>
          </div>

          <div class="settings-actions">
            {message && <p class={`save-message ${message.includes('失败') ? 'error' : 'success'}`}>{message}</p>}
            <button class="save-btn" type="submit" disabled={saving}>
              {saving ? '保存中...' : '保存设置'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
