// 音乐推荐引擎 - 只从我喜欢的歌单推荐

import { searchSongs, getLikedSongs, getAllPlaylistSongs } from '../services/netease.js';
import { getProfile } from '../store/preferenceStore.js';

// 去重池：记录已推荐过的歌，避免重复
export const recommendedHistory = new Set();
const MAX_HISTORY = 500;

export function markAsRecommended(songIds) {
  for (const id of songIds) recommendedHistory.add(id);
  // 超过上限时裁剪最旧的，不清空
  if (recommendedHistory.size > MAX_HISTORY) {
    const toRemove = recommendedHistory.size - 400;
    let count = 0;
    for (const id of recommendedHistory) {
      if (count >= toRemove) break;
      recommendedHistory.delete(id);
      count++;
    }
  }
}

function isEnglishText(str) {
  // 标题中英文字符占比 > 70% 且不含中日韩字符，判定为英文歌
  const cleaned = str.replace(/[\s\d&(),.'"!?\-:;/[\]{}@#$%^*+=~`|\\<>]+/g, '');
  if (cleaned.length === 0) return false;
  const cjk = (cleaned.match(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g) || []).length;
  const latin = (cleaned.match(/[a-zA-Z]/g) || []).length;
  return latin > 0 && cjk === 0 && (latin / cleaned.length) > 0.5;
}

function isJapaneseText(str) {
  const cleaned = str.replace(/[\s\d&(),.'"!?\-:;/[\]{}@#$%^*+=~`|\\<>]+/g, '');
  if (cleaned.length === 0) return false;
  const kana = (cleaned.match(/[\u3040-\u309f\u30a0-\u30ff]/g) || []).length;
  return kana > 0 && (kana / cleaned.length) > 0.2;
}

function isChineseText(str) {
  const cleaned = str.replace(/[\s\d&(),.'"!?\-:;/[\]{}@#$%^*+=~`|\\<>]+/g, '');
  if (cleaned.length === 0) return false;
  const han = (cleaned.match(/[\u4e00-\u9fff]/g) || []).length;
  return han > 0 && (han / cleaned.length) > 0.3;
}

function filterByLanguage(pool, lang) {
  switch (lang) {
    case 'english': return pool.filter(s => isEnglishText(s.title) || isEnglishText(s.artist));
    case 'japanese': return pool.filter(s => isJapaneseText(s.title) || isJapaneseText(s.artist));
    case 'chinese': return pool.filter(s => isChineseText(s.title) || isChineseText(s.artist));
    case 'cantonese': return pool.filter(s => isChineseText(s.title) || isChineseText(s.artist)); // 粤语歌名通常也是中文
    case 'korean':
      return pool.filter(s => /[\uac00-\ud7af]/.test(s.title) || /[\uac00-\ud7af]/.test(s.artist));
    default: return pool;
  }
}

function filterByGenre(pool, genre) {
  try {
    const g = genre.toLowerCase();
  const genreKeywords = {
    rock: ['rock', '摇滚', 'rock n roll', 'metal', '金属', 'alternative', 'indie', '朋克', 'punk', 'grunge', 'hard rock', 'post-rock', '后摇', 'progressive rock', '前卫摇滚'],
    classical: ['classical', '古典', 'symphony', '交响', 'orchestra', '管弦', 'concerto', '协奏曲', 'piano', '钢琴', 'chopin', 'mozart', 'beethoven', 'bach', 'vivaldi', 'tchaikovsky', 'opera', '歌剧', 'string quartet', '室内乐', 'baroque', '巴洛克'],
    jazz: ['jazz', '爵士', 'blues', '布鲁斯', 'bossa', 'swing', 'bebop', 'cool jazz', 'fusion', 'smooth jazz', 'acid jazz'],
    pop: ['pop', '流行', 'dance', '舞曲', 'synth', 'disco', 'k-pop', 'j-pop', 'c-pop', 'mandopop', 'cantopop', '粤语', 'teen pop', 'bubblegum'],
    electronic: ['electronic', '电子', 'edm', 'techno', 'house', 'trance', 'dubstep', 'ambient', 'drum and bass', 'dnb', 'lo-fi', 'chill', 'downtempo', 'trip hop', 'synthwave', 'synthpop', 'idm', 'breakbeat', 'garage', 'deep house'],
    rnb: ['rnb', 'r&b', '节奏布鲁斯', 'soul', '灵魂', 'funk', 'neo soul', 'motown', 'contemporary r&b'],
    ballad: ['ballad', '情歌', 'love song', '抒情', '慢歌', '对唱', '浪漫', 'romantic', '苦情歌', '伤感', '疗伤', '催泪', '温柔'],
    hiphop: ['hip hop', 'hiphop', '嘻哈', 'rap', '说唱', 'trap', 'drill', 'boom bap', 'gangsta', 'conscious rap', 'lo-fi hip hop'],
    folk: ['folk', '民谣', 'acoustic', 'country', '乡村', 'singer-songwriter', 'indie folk', 'americana', 'bluegrass', 'traditional'],
    metal: ['metal', '金属', 'heavy metal', 'death metal', 'black metal', 'thrash', 'doom', 'progressive metal', 'power metal', 'nu metal', 'speed metal', 'sludge'],
    latin: ['latin', '拉丁', 'reggaeton', 'salsa', 'bachata', 'samba', 'bossa nova', 'merengue', 'cumbia', 'tango'],
    reggae: ['reggae', '雷鬼', 'dub', 'ska', 'dancehall', 'ragga', 'roots reggae'],
    indie: ['indie', '独立', 'indie rock', 'indie pop', 'alternative', 'underground', '小众', 'bedroom pop', 'shoegaze', 'dream pop', '梦幻', '自赏'],
    chinese: ['国风', '古风', '中国风', '民乐', '民族', '戏曲', '京剧', '昆曲', '古筝', '二胡', '琵琶', '笛子', 'traditional chinese', 'chinese traditional'],
    instrumental: ['instrumental', '纯音乐', '无人声', '轻音乐', '背景音乐', 'bgm', 'ost', '原声', 'soundtrack', '电影原声', '游戏原声', 'piano solo', '吉他独奏'],
    newage: ['new age', '新世纪', '冥想', 'meditation', '疗愈', 'healing', '瑜伽', 'yoga', '自然', 'nature', 'spa', '放松音乐'],
    anime: ['anime', '动漫', 'anisong', 'oped', 'vocaloid', '初音', '二次元', 'acg', 'ゲーム', '声优', '角色歌'],
    retro: ['retro', '怀旧', '经典', '老歌', '80年代', '90年代', 'golden age', 'vintage', 'oldies', 'classic hits'],
    karaoke: ['karaoke', 'ktv', '热门', '必点', '合唱', '经典金曲', '华语金曲'],
  };

  // 优先匹配 tags，再匹配歌名+歌手
  const keywords = genreKeywords[g] || [g];
  return pool.filter(s => {
    const tags = (s.tags || []).map(t => t.toLowerCase()).join(' ');
    // tags 匹配权重最高
    if (keywords.some(kw => tags.includes(kw))) return true;
    // 回退到歌名+歌手匹配
    const text = `${s.title} ${s.artist}`.toLowerCase();
    return keywords.some(kw => text.includes(kw));
  });
  } catch {
    return pool; // 出错时不过滤，返回全部
  }
}

export async function recommendFromLiked(params, limit = 5) {
  try {
    const likedSongs = await getAllPlaylistSongs(2000);
    if (likedSongs.length === 0) return { songs: [], exhausted: false };

    let pool = likedSongs.filter(s => !recommendedHistory.has(s.id));
    let exhausted = false;

    // 未推荐过的歌太少，尝试放宽条件
    if (pool.length < limit) {
      // 如果整个歌单都推完了，标记为枯竭
      if (recommendedHistory.size >= likedSongs.length) {
        exhausted = true;
        return { songs: [], exhausted: true };
      }
      // 否则不过滤去重
      pool = likedSongs;
    }

    // 语言过滤
    if (params.language) {
      pool = filterByLanguage(pool, params.language);
    }

    // 风格过滤
    if (params.genre) {
      pool = filterByGenre(pool, params.genre);
    }

    if (pool.length === 0) return [];

    const { mood } = params;
    const hasPreference = mood || params.scene || params.language || params.genre;

    const scored = pool.map(song => {
      let score = hasPreference ? Math.random() * 0.5 : Math.random();

      if (hasPreference) {
        const profile = getProfile();
        const topArtists = (profile.tasteProfile.topArtists || []).map(a => a.name);
        // 用户要求换口味时不加偏好分
        if (!params.excludePreferred && topArtists.some(a => song.artist.includes(a))) {
          score += 0.4;
        }
      }

      if (!recommendedHistory.has(song.id)) {
        score += hasPreference ? 0.5 : 0;
      }

      return { song, score };
    });

    for (let i = scored.length - 1; i > 0 && i > scored.length - 20; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [scored[i], scored[j]] = [scored[j], scored[i]];
    }

    scored.sort((a, b) => b.score - a.score);

    return { songs: scored.slice(0, limit).map(s => s.song), exhausted: false };
  } catch {
    return { songs: [], exhausted: false };
  }
}

export function buildRecommendationQuery() { return '热门'; }
export async function recommendSongs(params) { return await searchSongs('热门', 10); }
