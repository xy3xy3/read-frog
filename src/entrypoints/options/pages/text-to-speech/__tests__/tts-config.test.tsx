// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { createStore, Provider } from 'jotai'
import { describe, expect, it, vi } from 'vitest'
import { TtsConfig } from '../tts-config'

const testFixtures = vi.hoisted(() => ({
  defaultTtsConfig: {
    providerId: 'openai-default',
    model: 'gpt-4o-mini-tts',
    voice: 'ash',
    speed: 1,
  },
  defaultProvidersConfig: [
    {
      id: 'openai-default',
      name: 'OpenAI',
      enabled: true,
      provider: 'openai',
    },
    {
      id: 'edge-tts-default',
      name: 'Edge TTS',
      enabled: true,
      provider: 'edge-tts',
    },
  ],
}))

const mockedAtoms = vi.hoisted(() => ({
  ttsAtom: null as any,
  providersConfigAtom: null as any,
}))

vi.mock('@/utils/atoms/config', async () => {
  const { atom } = await import('jotai')
  const ttsAtom = atom(testFixtures.defaultTtsConfig)
  const providersConfigAtom = atom(testFixtures.defaultProvidersConfig)

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
    ...testFixtures.defaultTtsConfig,
    model: options?.model ?? testFixtures.defaultTtsConfig.model,
    voice: options?.voice ?? testFixtures.defaultTtsConfig.voice,
    providerId: options?.provider === 'edge-tts' ? 'edge-tts-default' : 'openai-default',
  })
  store.set(mockedAtoms.providersConfigAtom, testFixtures.defaultProvidersConfig)

  render(
    <Provider store={store}>
      <TtsConfig />
    </Provider>,
  )
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
