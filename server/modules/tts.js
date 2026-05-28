// TTS 语音管线 - 将文字回复转为语音播报

import { loadConfig } from '../config.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { readFile, unlink } from 'fs/promises';
import { DATA_DIR } from '../config.js';

const execAsync = promisify(exec);

export async function synthesize(text) {
  const config = loadConfig();
  if (!config.tts.enabled) return null;

  const engine = config.tts.engine;

  if (engine === 'edge-tts') {
    return await edgeTTS(text, config.tts.voice);
  }

  // 系统TTS或其他引擎的占位
  return null;
}

async function edgeTTS(text, voice) {
  // 过滤 emoji，避免 TTS 念出来
  const cleanText = text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{200D}\u{200C}]/gu, '').replace(/\s+/g, ' ').trim();
  if (!cleanText) return null;

  const tmpFile = join(DATA_DIR, 'cache', `tts_${randomUUID()}.mp3`);

  try {
    const cmd = `"D:\\Astrbot\\backend\\python\\python.exe" -m edge_tts --voice "${voice}" --text "${cleanText.replace(/"/g, '\\"')}" --write-media "${tmpFile}"`;
    await execAsync(cmd, { timeout: 15000 });

    const audioBuffer = await readFile(tmpFile);
    await unlink(tmpFile).catch(() => {});

    return {
      audio: audioBuffer.toString('base64'),
      format: 'mp3'
    };
  } catch (err) {
    console.error('TTS synthesis failed:', err.message);
    try { await unlink(tmpFile); } catch { /* ignore */ }
    return null;
  }
}

export function getAvailableVoices() {
  return [
    { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓（女声，推荐）' },
    { id: 'zh-CN-YunxiNeural', name: '云希（男声）' },
    { id: 'zh-CN-YunjianNeural', name: '云健（男声，沉稳）' },
    { id: 'zh-CN-XiaoyiNeural', name: '晓伊（女声，活泼）' }
  ];
}
