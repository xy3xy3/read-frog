import type { TTSProviderConfig } from '@/types/config/provider'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  isEdgeTTSSynthesis,
  synthesizeTTSAudioBlob,
} from '../synthesis-service'

vi.mock('ai', () => ({
  experimental_generateSpeech: vi.fn(),
}))

vi.mock('@/utils/providers/model', () => ({
  getTTSProviderById: vi.fn(),
}))

vi.mock('@/utils/message', () => ({
  sendMessage: vi.fn(),
}))

vi.mock('#imports', () => ({
  storage: {
    getItem: vi.fn(),
  },
}))

describe('tts synthesis service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('treats Edge synthesis as provider-only', () => {
    const ttsConfig = {
      providerId: 'openai-default',
      model: 'edge-tts',
      voice: 'zh-CN-XiaoxiaoNeural',
      speed: 1,
    } as const

    expect(isEdgeTTSSynthesis(ttsConfig, { provider: 'openai' } as TTSProviderConfig)).toBe(false)
    expect(isEdgeTTSSynthesis(ttsConfig, { provider: 'edge-tts' } as TTSProviderConfig)).toBe(true)
  })

  it('normalizes legacy edge model to OpenAI model before speech generation', async () => {
    const provider = { speech: vi.fn().mockReturnValue('openai-speech-model') }
    const { getTTSProviderById } = await import('@/utils/providers/model')
    const { experimental_generateSpeech } = await import('ai')

    vi.mocked(getTTSProviderById).mockResolvedValue(provider as any)
    vi.mocked(experimental_generateSpeech).mockResolvedValue({
      audio: {
        uint8Array: new Uint8Array([1, 2, 3]),
        mediaType: 'audio/wav',
      },
    } as any)

    const blob = await synthesizeTTSAudioBlob({
      chunk: 'hello',
      ttsConfig: {
        providerId: 'openai-default',
        model: 'edge-tts',
        voice: 'zh-CN-XiaoxiaoNeural',
        speed: 1,
      },
      ttsProviderConfig: {
        id: 'openai-default',
        provider: 'openai',
      } as TTSProviderConfig,
    })

    expect(provider.speech).toHaveBeenCalledWith('gpt-4o-mini-tts')
    expect(experimental_generateSpeech).toHaveBeenCalledWith(expect.objectContaining({
      voice: 'alloy',
      speed: 1,
      text: 'hello',
    }))
    expect(blob.type).toBe('audio/wav')
  })
})
