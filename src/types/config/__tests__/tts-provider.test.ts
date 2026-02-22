import { describe, expect, it } from 'vitest'
import {
  EDGE_TTS_VOICES,
  getTTSModelsForProvider,
  getTTSVoicesForProvider,
  normalizeTTSConfigForProvider,
  OPENAI_TTS_MODELS,
} from '../tts'

describe('tts provider-aware helpers', () => {
  it('returns provider-specific model lists', () => {
    expect(getTTSModelsForProvider('openai')).toEqual(OPENAI_TTS_MODELS)
    expect(getTTSModelsForProvider('edge-tts')).toEqual(['edge-tts'])
  })

  it('normalizes legacy edge model to OpenAI model and voice', () => {
    const normalized = normalizeTTSConfigForProvider('openai', {
      providerId: 'openai-default',
      model: 'edge-tts',
      voice: EDGE_TTS_VOICES[0],
      speed: 1,
    })

    expect(normalized.model).toBe('gpt-4o-mini-tts')
    expect(normalized.voice).toBe('alloy')
  })

  it('normalizes OpenAI model to Edge model and voice', () => {
    const normalized = normalizeTTSConfigForProvider('edge-tts', {
      providerId: 'edge-tts-default',
      model: 'tts-1',
      voice: 'alloy',
      speed: 1,
    })

    expect(normalized.model).toBe('edge-tts')
    expect(normalized.voice).toBe(EDGE_TTS_VOICES[0])
  })

  it('falls back to provider-compatible voices for unsupported model', () => {
    const voices = getTTSVoicesForProvider('openai', 'edge-tts')
    expect(voices).toContain('alloy')
    expect(voices).not.toContain(EDGE_TTS_VOICES[0])
  })
})
