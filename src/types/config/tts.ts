import { z } from 'zod'

export const TTS_MODELS = [
  'gpt-4o-mini-tts',
  'tts-1',
  'tts-1-hd',
  'edge-tts',
] as const
export const ttsModelSchema = z.enum(TTS_MODELS)
export type TTSProviderType = 'openai' | 'edge-tts'

export const OPENAI_TTS_MODELS = [
  'gpt-4o-mini-tts',
  'tts-1',
  'tts-1-hd',
] as const

export const TTS_1_VOICES = [
  'alloy',
  'ash',
  'coral',
  'echo',
  'fable',
  'nova',
  'onyx',
  'sage',
  'shimmer',
] as const

export const GPT_4O_MINI_VOICES = [
  'alloy',
  'ash',
  'ballad',
  'coral',
  'echo',
  'fable',
  'nova',
  'onyx',
  'sage',
  'shimmer',
  'verse',
] as const

export const EDGE_TTS_VOICES = [
  // 中文女声
  'zh-CN-XiaoxiaoNeural',
  'zh-CN-XiaoyiNeural',
  'zh-CN-XiaochenNeural',
  'zh-CN-XiaohanNeural',
  'zh-CN-XiaomengNeural',
  'zh-CN-XiaomoNeural',
  'zh-CN-XiaoqiuNeural',
  'zh-CN-XiaoruiNeural',
  'zh-CN-XiaoshuangNeural',
  'zh-CN-XiaoxuanNeural',
  'zh-CN-XiaoyanNeural',
  'zh-CN-XiaoyouNeural',
  'zh-CN-XiaozhenNeural',
  // 中文男声
  'zh-CN-YunxiNeural',
  'zh-CN-YunyangNeural',
  'zh-CN-YunjianNeural',
  'zh-CN-YunfengNeural',
  'zh-CN-YunhaoNeural',
  'zh-CN-YunxiaNeural',
  'zh-CN-YunyeNeural',
  'zh-CN-YunzeNeural',
  // 英文女声
  'en-US-JennyNeural',
  'en-US-AriaNeural',
  'en-US-MichelleNeural',
  // 英文男声
  'en-US-GuyNeural',
  'en-US-DavisNeural',
  'en-US-TonyNeural',
  // 日文
  'ja-JP-NanamiNeural',
  'ja-JP-KeitaNeural',
  // 韩文
  'ko-KR-SunHiNeural',
  'ko-KR-InJoonNeural',
] as const

// Map models to their available voices
export const MODEL_VOICES_MAP = {
  'tts-1': TTS_1_VOICES,
  'tts-1-hd': TTS_1_VOICES,
  'gpt-4o-mini-tts': GPT_4O_MINI_VOICES,
  'edge-tts': EDGE_TTS_VOICES,
} as const

// Union of all possible voices
export const ALL_TTS_VOICES = [...new Set([...TTS_1_VOICES, ...GPT_4O_MINI_VOICES, ...EDGE_TTS_VOICES])] as const
export const ttsVoiceSchema = z.enum(ALL_TTS_VOICES as [string, ...string[]])

export const MIN_TTS_SPEED = 0.25
export const MAX_TTS_SPEED = 4
export const ttsSpeedSchema = z.coerce.number().min(MIN_TTS_SPEED).max(MAX_TTS_SPEED)

export const ttsConfigSchema = z.object({
  providerId: z.string().nullable(),
  model: ttsModelSchema,
  voice: ttsVoiceSchema,
  speed: ttsSpeedSchema,
}).refine(
  data => isVoiceAvailableForModel(data.voice, data.model),
  {
    error: data => `Voice "${data.voice}" is not available for model "${data.model}"`,
    path: ['voice'],
  },
)

export type TTSVoice = z.infer<typeof ttsVoiceSchema>
export type TTSModel = z.infer<typeof ttsModelSchema>
export type TTSConfig = z.infer<typeof ttsConfigSchema>

export const PROVIDER_TTS_MODELS_MAP = {
  'openai': OPENAI_TTS_MODELS,
  'edge-tts': ['edge-tts'] as const,
} as const satisfies Record<TTSProviderType, readonly TTSModel[]>

function isIncluded<T extends string>(values: readonly T[], value: string): value is T {
  return values.includes(value as T)
}

// Helper function to get available voices for a model
export function getVoicesForModel(model: TTSModel) {
  return MODEL_VOICES_MAP[model]
}

// Helper function to check if a voice is available for a model
export function isVoiceAvailableForModel(voice: string, model: TTSModel): boolean {
  return MODEL_VOICES_MAP[model].includes(voice)
}

export function getTTSModelsForProvider(providerType: TTSProviderType): readonly TTSModel[] {
  return PROVIDER_TTS_MODELS_MAP[providerType]
}

export function getTTSVoicesForProvider(providerType: TTSProviderType, model?: TTSModel): readonly TTSVoice[] {
  const availableModels = getTTSModelsForProvider(providerType)
  const defaultModel = availableModels[0]
  const resolvedModel = model && isIncluded(availableModels, model)
    ? model
    : defaultModel

  return getVoicesForModel(resolvedModel)
}

export function normalizeTTSConfigForProvider(providerType: TTSProviderType, ttsConfig: TTSConfig): TTSConfig {
  const availableModels = getTTSModelsForProvider(providerType)
  const model = isIncluded(availableModels, ttsConfig.model)
    ? ttsConfig.model
    : availableModels[0]
  const availableVoices = getTTSVoicesForProvider(providerType, model)
  const voice = isIncluded(availableVoices, ttsConfig.voice)
    ? ttsConfig.voice
    : availableVoices[0]

  return {
    ...ttsConfig,
    model,
    voice,
  }
}
