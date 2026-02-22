import type { TTSProviderConfig } from '@/types/config/provider'
import type { TTSConfig } from '@/types/config/tts'
import { i18n } from '#imports'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  isEdgeTTSSynthesis,
  splitTextForTTSSynthesis,
  synthesizeTTSAudioBlob,
} from '@/utils/tts/synthesis-service'

interface PlayAudioParams {
  text: string
  ttsConfig: TTSConfig
  ttsProviderConfig: TTSProviderConfig
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

      const shouldUseEdgeTTS = isEdgeTTSSynthesis(ttsConfig, ttsProviderConfig)
      const chunks = splitTextForTTSSynthesis(text, shouldUseEdgeTTS)
      setTotalChunks(chunks.length)

      // Helper to fetch a chunk's audio blob
      const fetchChunkBlob = async (chunk: string) => {
        return queryClient.fetchQuery({
          queryKey: ['tts-audio', { text: chunk, ttsConfig, ttsProviderConfig }],
          queryFn: () => synthesizeTTSAudioBlob({
            chunk,
            ttsConfig,
            ttsProviderConfig,
            useEdgeTTS: shouldUseEdgeTTS,
          }),
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
