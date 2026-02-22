// This is a list of voices available for the OpenAI API

import type { TTSConfig, TTSVoice } from '@/types/config/tts'

// https://www.openai.fm/
export const TTS_VOICES_ITEMS: Record<TTSVoice, { name: string }> = {
  'alloy': { name: 'Alloy' },
  'ash': { name: 'Ash' },
  'ballad': { name: 'Ballad' },
  'coral': { name: 'Coral' },
  'echo': { name: 'Echo' },
  'fable': { name: 'Fable' },
  'nova': { name: 'Nova' },
  'onyx': { name: 'Onyx' },
  'sage': { name: 'Sage' },
  'shimmer': { name: 'Shimmer' },
  'verse': { name: 'Verse' },
  // Edge TTS Voices - Chinese Female
  'zh-CN-XiaoxiaoNeural': { name: '晓晓 (温柔)' },
  'zh-CN-XiaoyiNeural': { name: '晓伊 (甜美)' },
  'zh-CN-XiaochenNeural': { name: '晓辰 (知性)' },
  'zh-CN-XiaohanNeural': { name: '晓涵 (优雅)' },
  'zh-CN-XiaomengNeural': { name: '晓梦 (梦幻)' },
  'zh-CN-XiaomoNeural': { name: '晓墨 (文艺)' },
  'zh-CN-XiaoqiuNeural': { name: '晓秋 (成熟)' },
  'zh-CN-XiaoruiNeural': { name: '晓睿 (智慧)' },
  'zh-CN-XiaoshuangNeural': { name: '晓双 (活泼)' },
  'zh-CN-XiaoxuanNeural': { name: '晓萱 (清新)' },
  'zh-CN-XiaoyanNeural': { name: '晓颜 (柔美)' },
  'zh-CN-XiaoyouNeural': { name: '晓悠 (悠扬)' },
  'zh-CN-XiaozhenNeural': { name: '晓甄 (端庄)' },
  // Edge TTS Voices - Chinese Male
  'zh-CN-YunxiNeural': { name: '云希 (清朗)' },
  'zh-CN-YunyangNeural': { name: '云扬 (阳光)' },
  'zh-CN-YunjianNeural': { name: '云健 (稳重)' },
  'zh-CN-YunfengNeural': { name: '云枫 (磁性)' },
  'zh-CN-YunhaoNeural': { name: '云皓 (豪迈)' },
  'zh-CN-YunxiaNeural': { name: '云夏 (热情)' },
  'zh-CN-YunyeNeural': { name: '云野 (野性)' },
  'zh-CN-YunzeNeural': { name: '云泽 (深沉)' },
  // Edge TTS Voices - English Female
  'en-US-JennyNeural': { name: 'Jenny' },
  'en-US-AriaNeural': { name: 'Aria' },
  'en-US-MichelleNeural': { name: 'Michelle' },
  // Edge TTS Voices - English Male
  'en-US-GuyNeural': { name: 'Guy' },
  'en-US-DavisNeural': { name: 'Davis' },
  'en-US-TonyNeural': { name: 'Tony' },
  // Edge TTS Voices - Japanese
  'ja-JP-NanamiNeural': { name: '七海' },
  'ja-JP-KeitaNeural': { name: '圭太' },
  // Edge TTS Voices - Korean
  'ko-KR-SunHiNeural': { name: '선히' },
  'ko-KR-InJoonNeural': { name: '인준' },
}

export const DEFAULT_TTS_CONFIG: TTSConfig = {
  providerId: 'openai-default',
  model: 'gpt-4o-mini-tts',
  voice: 'ash',
  speed: 1,
}
