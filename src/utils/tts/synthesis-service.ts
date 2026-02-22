import type { Config } from '@/types/config/config'
import type { TTSProviderConfig } from '@/types/config/provider'
import type { TTSConfig } from '@/types/config/tts'
import { storage } from '#imports'
import { experimental_generateSpeech as generateSpeech } from 'ai'
import { normalizeTTSConfigForProvider } from '@/types/config/tts'
import { getTTSProvidersConfig } from '@/utils/config/helpers'
import { CONFIG_STORAGE_KEY } from '@/utils/constants/config'
import { sendMessage } from '@/utils/message'
import { getTTSProviderById } from '@/utils/providers/model'
import { splitTextByUtf8Bytes } from '@/utils/server/edge-tts/chunk'

const MAX_TEXT_CHUNK_SIZE = 4096

interface SynthesizeTTSAudioBlobParams {
  chunk: string
  ttsConfig: TTSConfig
  ttsProviderConfig: TTSProviderConfig
  useEdgeTTS?: boolean
}

function getEdgeTTSRate(speed: number): string {
  const rate = Math.round((speed - 1) * 100)
  return `${rate > 0 ? '+' : ''}${rate}%`
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes.buffer
}

async function getOpenAIFallbackProviderId(excludedProviderId: string): Promise<string | null> {
  const config = await storage.getItem<Config>(`local:${CONFIG_STORAGE_KEY}`)
  if (!config) {
    return null
  }

  const fallback = getTTSProvidersConfig(config.providersConfig)
    .find((provider) => {
      if (provider.provider !== 'openai' || !provider.enabled || provider.id === excludedProviderId) {
        return false
      }
      return Boolean(provider.apiKey?.trim())
    })

  return fallback?.id ?? null
}

function normalizeOpenAIConfig(ttsConfig: TTSConfig): Pick<TTSConfig, 'model' | 'voice' | 'speed'> {
  const normalized = normalizeTTSConfigForProvider('openai', ttsConfig)

  return {
    model: normalized.model,
    voice: normalized.voice,
    speed: normalized.speed,
  }
}

function toAudioBlob(audioBuffer: ArrayBuffer, contentType: string): Blob {
  return new Blob([audioBuffer], { type: contentType })
}

async function generateOpenAISpeechBlob(
  providerId: string,
  text: string,
  ttsConfig: Pick<TTSConfig, 'model' | 'voice' | 'speed'>,
): Promise<Blob> {
  const provider = await getTTSProviderById(providerId)
  const result = await generateSpeech({
    model: (provider as any).speech(ttsConfig.model),
    text,
    voice: ttsConfig.voice,
    speed: ttsConfig.speed,
    outputFormat: 'wav',
  })

  return toAudioBlob(
    result.audio.uint8Array.buffer as ArrayBuffer,
    result.audio.mediaType || 'audio/wav',
  )
}

function splitTextIntoSentenceChunks(text: string, maxSize: number = MAX_TEXT_CHUNK_SIZE): string[] {
  if (text.length <= maxSize) {
    return [text]
  }

  const chunks: string[] = []
  const sentencePattern = /[^.!?。！？；؟۔।॥\n]+[.!?。！？；؟۔।॥\n]+|[^.!?。！？；؟۔।॥\n]+$/g
  const sentences = text.match(sentencePattern) || [text]

  let currentChunk = ''

  for (const sentence of sentences) {
    if (sentence.length > maxSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim())
        currentChunk = ''
      }

      const words = sentence.split(/\s+/)
      for (const word of words) {
        const combined = currentChunk ? `${currentChunk} ${word}` : word
        if (combined.length > maxSize) {
          if (currentChunk) {
            chunks.push(currentChunk.trim())
          }
          currentChunk = word
        }
        else {
          currentChunk = combined
        }
      }
      continue
    }

    const combined = currentChunk + sentence
    if (combined.length > maxSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim())
      }
      currentChunk = sentence
    }
    else {
      currentChunk = combined
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim())
  }

  return chunks.filter(chunk => chunk.length > 0)
}

async function synthesizeEdgeTTSAudioBlob(
  chunk: string,
  ttsConfig: TTSConfig,
  ttsProviderConfig: TTSProviderConfig,
): Promise<Blob> {
  const response = await sendMessage('edgeTtsSynthesize', {
    text: chunk,
    voice: ttsConfig.voice,
    rate: getEdgeTTSRate(ttsConfig.speed),
    pitch: '+0Hz',
    volume: '+0%',
  })

  if (response.ok) {
    const audioBuffer = base64ToArrayBuffer(response.audioBase64)
    if (audioBuffer.byteLength === 0) {
      throw new Error('Edge TTS returned empty audio data')
    }
    return toAudioBlob(audioBuffer, response.contentType)
  }

  const fallbackProviderId = await getOpenAIFallbackProviderId(ttsProviderConfig.id)
  if (!fallbackProviderId) {
    throw new Error(`[${response.error.code}] ${response.error.message}`)
  }

  const fallbackConfig = normalizeOpenAIConfig(ttsConfig)
  return generateOpenAISpeechBlob(fallbackProviderId, chunk, fallbackConfig)
}

export function isEdgeTTSSynthesis(_ttsConfig: TTSConfig, ttsProviderConfig: TTSProviderConfig): boolean {
  return ttsProviderConfig.provider === 'edge-tts'
}

export function splitTextForTTSSynthesis(text: string, useEdgeTTS: boolean): string[] {
  return useEdgeTTS
    ? splitTextByUtf8Bytes(text)
    : splitTextIntoSentenceChunks(text)
}

export async function synthesizeTTSAudioBlob({
  chunk,
  ttsConfig,
  ttsProviderConfig,
  useEdgeTTS = isEdgeTTSSynthesis(ttsConfig, ttsProviderConfig),
}: SynthesizeTTSAudioBlobParams): Promise<Blob> {
  if (useEdgeTTS) {
    return synthesizeEdgeTTSAudioBlob(chunk, ttsConfig, ttsProviderConfig)
  }

  return generateOpenAISpeechBlob(
    ttsProviderConfig.id,
    chunk,
    normalizeOpenAIConfig(ttsConfig),
  )
}
