/**
 * Edge TTS Provider
 * 将 Edge TTS 集成到 Vercel AI SDK
 */

import type { EdgeTTSConfig } from './types'
import { listEdgeTTSVoices, synthesizeEdgeTTS } from './api'

export interface EdgeTTSProviderOptions {
  apiKey?: string
  baseURL?: string
}

export interface EdgeTTSSpeechModel {
  (target: string): PromiseLike<{
    audio: Uint8Array
    mediaType: string
  }>
}

/**
 * 创建 Edge TTS Provider
 * 兼容 Vercel AI SDK 的 speech 接口
 */
export function createEdgeTTS(_options: EdgeTTSProviderOptions = {}) {
  /**
   * 获取语音合成模型
   */
  function speech(modelId: string) {
    const model: EdgeTTSSpeechModel = async (text: string) => {
      // 解析 modelId 获取语音配置
      // 格式：voiceName|rate|pitch|volume
      const [voiceName, rate = '+0%', pitch = '+0Hz', volume = '+0%'] = modelId.split('|')

      const config: EdgeTTSConfig = {
        voice: voiceName,
        rate,
        pitch,
        volume,
      }

      const response = await synthesizeEdgeTTS({
        text,
        voice: config.voice,
        rate: config.rate,
        pitch: config.pitch,
        volume: config.volume,
      })

      if (!response.ok) {
        throw new Error(response.error.message)
      }

      return {
        audio: new Uint8Array(response.audio),
        mediaType: response.contentType,
      }
    }

    return model
  }

  /**
   * 获取可用的语音列表
   */
  async function voices() {
    return listEdgeTTSVoices()
  }

  return {
    speech,
    voices,
  }
}

export type EdgeTTSProvider = ReturnType<typeof createEdgeTTS>
