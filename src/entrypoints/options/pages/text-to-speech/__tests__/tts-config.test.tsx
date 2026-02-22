// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { createStore, Provider } from 'jotai'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_CONFIG } from '@/utils/constants/config'
import { TtsConfig } from '../tts-config'

const mockedAtoms = vi.hoisted(() => ({
  ttsAtom: null as any,
  providersConfigAtom: null as any,
}))

vi.mock('@/utils/atoms/config', async () => {
  const { atom } = await import('jotai')
  const ttsAtom = atom(DEFAULT_CONFIG.tts)
  const providersConfigAtom = atom(DEFAULT_CONFIG.providersConfig)

  mockedAtoms.ttsAtom = ttsAtom
  mockedAtoms.providersConfigAtom = providersConfigAtom

  return {
    configFieldsAtomMap: {
      tts: ttsAtom,
      providersConfig: providersConfigAtom,
    },
  }
})

vi.mock('@/components/llm-providers/provider-selector', () => ({
  default: () => <div data-testid="tts-provider-selector" />,
}))

vi.mock('@/hooks/use-text-to-speech', () => ({
  useTextToSpeech: () => ({
    play: vi.fn(),
    stop: vi.fn(),
    isFetching: false,
    isPlaying: false,
    currentChunk: 0,
    totalChunks: 0,
    error: null,
  }),
}))

function renderTTSConfig(options?: {
  model?: 'gpt-4o-mini-tts' | 'tts-1' | 'tts-1-hd' | 'edge-tts'
  voice?: string
  provider?: 'openai' | 'edge-tts'
}) {
  const store = createStore()
  store.set(mockedAtoms.ttsAtom, {
    ...DEFAULT_CONFIG.tts,
    model: options?.model ?? DEFAULT_CONFIG.tts.model,
    voice: options?.voice ?? DEFAULT_CONFIG.tts.voice,
    providerId: options?.provider === 'edge-tts' ? 'edge-tts-default' : 'openai-default',
  })
  store.set(mockedAtoms.providersConfigAtom, DEFAULT_CONFIG.providersConfig.map((provider) => {
    if (provider.provider === 'edge-tts') {
      return { ...provider, enabled: true }
    }
    return provider
  }))

  render(
    <Provider store={store}>
      <TtsConfig />
    </Provider>,
  )

  return store
}

describe('tts config', () => {
  it('shows model field for OpenAI provider', () => {
    renderTTSConfig({ provider: 'openai' })

    expect(screen.getByTestId('tts-provider-selector')).toBeInTheDocument()
    expect(screen.getByText('options.tts.model.label')).toBeInTheDocument()
  })

  it('hides model field for Edge TTS provider', () => {
    renderTTSConfig({ provider: 'edge-tts', model: 'edge-tts', voice: 'zh-CN-XiaoxiaoNeural' })

    expect(screen.queryByText('options.tts.model.label')).not.toBeInTheDocument()
    expect(screen.getByText('options.tts.voice.label')).toBeInTheDocument()
  })
})
