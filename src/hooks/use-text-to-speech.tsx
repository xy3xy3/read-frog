import type { Config } from '@/types/config/config'
import type { TTSProviderConfig } from '@/types/config/provider'
import type { TTSConfig, TTSModel, TTSVoice } from '@/types/config/tts'
import { i18n, storage } from '#imports'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { experimental_generateSpeech as generateSpeech } from 'ai'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { getVoicesForModel, isVoiceAvailableForModel } from '@/types/config/tts'
import { getTTSProvidersConfig } from '@/utils/config/helpers'
import { CONFIG_STORAGE_KEY } from '@/utils/constants/config'
import { sendMessage } from '@/utils/message'
import { getTTSProviderById } from '@/utils/providers/model'
import { splitTextByUtf8Bytes } from '@/utils/server/edge-tts/chunk'

interface PlayAudioParams {
  text: string
  ttsConfig: TTSConfig
  ttsProviderConfig: TTSProviderConfig
}

const MAX_CHUNK_SIZE = 4096

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

function normalizeOpenAIFallbackConfig(ttsConfig: TTSConfig): Pick<TTSConfig, 'model' | 'voice' | 'speed'> {
  const fallbackModel: TTSModel = ttsConfig.model === 'edge-tts' ? 'gpt-4o-mini-tts' : ttsConfig.model
  const fallbackVoices = getVoicesForModel(fallbackModel)
  const fallbackVoice: TTSVoice = isVoiceAvailableForModel(ttsConfig.voice, fallbackModel)
    ? ttsConfig.voice
    : fallbackVoices[0] as TTSVoice

  return {
    model: fallbackModel,
    voice: fallbackVoice,
    speed: ttsConfig.speed,
  }
}

/**
 * Split text into chunks that respect sentence boundaries
 * Each chunk will be <= maxSize characters
 * Supports multiple languages including CJK (Chinese, Japanese, Korean)
 */
function splitTextIntoChunks(text: string, maxSize: number = MAX_CHUNK_SIZE): string[] {
  if (text.length <= maxSize) {
    return [text]
  }

  const chunks: string[] = []
  // Split by sentence boundaries:
  // - Western: . ! ? with optional quotes/parentheses
  // - CJK: 。！？；
  // - Arabic: ؟ ۔
  // - Devanagari: । ॥
  // - Also split on newlines and paragraph breaks
  const sentencePattern = /[^.!?。！？；؟۔।॥\n]+[.!?。！？；؟۔।॥\n]+|[^.!?。！？；؟۔।॥\n]+$/g
  const sentences = text.match(sentencePattern) || [text]

  let currentChunk = ''

  for (const sentence of sentences) {
    // If a single sentence is longer than maxSize, split it by words
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

    // If adding this sentence would exceed maxSize, start a new chunk
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

export function useTextToSpeech() {
  const queryClient = useQueryClient()
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentChunk, setCurrentChunk] = useState(0)
  const [totalChunks, setTotalChunks] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const shouldStopRef = useRef(false)

  const stop = () => {
    shouldStopRef.current = true
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setIsPlaying(false)
    setCurrentChunk(0)
    setTotalChunks(0)
  }

  const playMutation = useMutation<void, Error, PlayAudioParams>({
    mutationFn: async ({ text, ttsConfig, ttsProviderConfig }) => {
      // Stop any currently playing audio first
      stop()
      shouldStopRef.current = false

      const shouldUseEdgeTTS = ttsProviderConfig.provider === 'edge-tts' || ttsConfig.model === 'edge-tts'

      const chunks = shouldUseEdgeTTS
        ? splitTextByUtf8Bytes(text)
        : splitTextIntoChunks(text)
      setTotalChunks(chunks.length)

      // Helper to fetch a chunk's audio blob
      const fetchChunkBlob = async (chunk: string) => {
        return queryClient.fetchQuery({
          queryKey: ['tts-audio', { text: chunk, ttsConfig, ttsProviderConfig }],
          queryFn: async () => {
            // Handle Edge TTS provider specially
            if (shouldUseEdgeTTS) {
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

                return new Blob([audioBuffer], {
                  type: response.contentType,
                })
              }

              const fallbackProviderId = await getOpenAIFallbackProviderId(ttsProviderConfig.id)
              if (!fallbackProviderId) {
                throw new Error(`[${response.error.code}] ${response.error.message}`)
              }

              const fallbackProvider = await getTTSProviderById(fallbackProviderId)
              const fallbackConfig = normalizeOpenAIFallbackConfig(ttsConfig)

              const fallbackResult = await generateSpeech({
                model: (fallbackProvider as any).speech(fallbackConfig.model),
                text: chunk,
                voice: fallbackConfig.voice,
                speed: fallbackConfig.speed,
                outputFormat: 'wav',
              })

              return new Blob([fallbackResult.audio.uint8Array.buffer as ArrayBuffer], {
                type: fallbackResult.audio.mediaType || 'audio/wav',
              })
            }

            const provider = await getTTSProviderById(ttsProviderConfig.id)

            const result = await generateSpeech({
              model: (provider as any).speech(ttsConfig.model),
              text: chunk,
              voice: ttsConfig.voice,
              speed: ttsConfig.speed,
              outputFormat: 'wav',
            })

            return new Blob([result.audio.uint8Array.buffer as ArrayBuffer], {
              type: result.audio.mediaType || 'audio/wav',
            })
          },
          staleTime: Number.POSITIVE_INFINITY,
          gcTime: 1000 * 60 * 10,
        })
      }

      // Helper to play a blob
      const playBlob = async (blob: Blob) => {
        return new Promise<void>((resolve, reject) => {
          try {
            setIsPlaying(true)
            const audioUrl = URL.createObjectURL(blob)
            const audio = new Audio(audioUrl)
            audioRef.current = audio

            audio.onended = () => {
              URL.revokeObjectURL(audioUrl)
              setIsPlaying(false)
              audioRef.current = null
              resolve()
            }

            audio.onerror = () => {
              URL.revokeObjectURL(audioUrl)
              setIsPlaying(false)
              audioRef.current = null
              reject(new Error('Failed to play audio'))
            }

            audio.play()
              .catch((err) => {
                URL.revokeObjectURL(audioUrl)
                setIsPlaying(false)
                audioRef.current = null
                reject(err)
              })
          }
          catch (err) {
            setIsPlaying(false)
            reject(err)
          }
        })
      }

      // Play each chunk sequentially with prefetching
      for (let i = 0; i < chunks.length; i++) {
        if (shouldStopRef.current) {
          break
        }

        setCurrentChunk(i + 1)

        // Fetch current chunk and prefetch next chunk in parallel
        const currentBlobPromise = fetchChunkBlob(chunks[i])
        const nextBlobPromise = i + 1 < chunks.length ? fetchChunkBlob(chunks[i + 1]) : null

        const blob = await currentBlobPromise

        if (shouldStopRef.current) {
          break
        }

        // Play current chunk while next chunk is being fetched
        await playBlob(blob)

        // Wait for next chunk to be ready (if it's still fetching)
        if (nextBlobPromise) {
          await nextBlobPromise
        }
      }

      setCurrentChunk(0)
      setTotalChunks(0)
    },
    onError: (error) => {
      toast.error(`${i18n.t('speak.failedToGenerateSpeech')}: ${error.message}`)
      setIsPlaying(false)
      setCurrentChunk(0)
      setTotalChunks(0)
    },
  })

  const play = (text: string, ttsConfig: TTSConfig, ttsProviderConfig: TTSProviderConfig) => {
    return playMutation.mutateAsync({ text, ttsConfig, ttsProviderConfig })
  }

  const isFetching = playMutation.isPending && !isPlaying

  return {
    play,
    stop,
    isFetching,
    isPlaying,
    currentChunk,
    totalChunks,
    error: playMutation.error,
  }
}
