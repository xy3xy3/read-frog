import type { TTSProviderConfig } from '@/types/config/provider'
import type { TTSModel, TTSProviderType, TTSVoice } from '@/types/config/tts'
import { i18n } from '#imports'
import { IconLoader2, IconPlayerPlayFilled } from '@tabler/icons-react'
import { useAtom, useAtomValue } from 'jotai'
import { useEffect } from 'react'
import ProviderSelector from '@/components/llm-providers/provider-selector'
import { Badge } from '@/components/ui/base-ui/badge'
import { Button } from '@/components/ui/base-ui/button'
import { Field, FieldLabel } from '@/components/ui/base-ui/field'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/base-ui/select'
import ValidatedInput from '@/components/ui/validated-input'
import { useTextToSpeech } from '@/hooks/use-text-to-speech'
import { isTTSProviderConfig } from '@/types/config/provider'
import {
  getTTSModelsForProvider,
  getTTSVoicesForProvider,
  MAX_TTS_SPEED,
  MIN_TTS_SPEED,
  normalizeTTSConfigForProvider,
  ttsSpeedSchema,
} from '@/types/config/tts'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { getProviderConfigById } from '@/utils/config/helpers'
import { TTS_VOICES_ITEMS } from '@/utils/constants/tts'
import { ConfigCard } from '../../components/config-card'

function getTTSProviderType(providerConfig: TTSProviderConfig | null): TTSProviderType | null {
  if (!providerConfig) {
    return null
  }

  return providerConfig.provider
}

export function TtsConfig() {
  const [ttsConfig, setTtsConfig] = useAtom(configFieldsAtomMap.tts)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const providerConfig = ttsConfig.providerId
    ? getProviderConfigById(providersConfig, ttsConfig.providerId)
    : null
  const ttsProviderConfig = providerConfig && isTTSProviderConfig(providerConfig)
    ? providerConfig
    : null
  const providerType = getTTSProviderType(
    ttsProviderConfig,
  )

  useEffect(() => {
    if (!providerType) {
      return
    }

    const normalized = normalizeTTSConfigForProvider(providerType, ttsConfig)
    if (normalized.model === ttsConfig.model && normalized.voice === ttsConfig.voice) {
      return
    }

    void setTtsConfig({
      model: normalized.model,
      voice: normalized.voice,
    })
  }, [providerType, setTtsConfig, ttsConfig])

  return (
    <ConfigCard
      title={(
        <>
          {i18n.t('options.tts.title')}
          {' '}
          <Badge variant="secondary" className="align-middle">Public Beta</Badge>
        </>
      )}
      description={i18n.t('options.tts.description')}
    >
      <div className="space-y-4">
        <TtsProviderField />
        {ttsConfig.providerId && providerType && ttsProviderConfig && (
          <>
            {providerType === 'openai' && <TtsModelField providerType={providerType} />}
            <TtsVoiceField providerType={providerType} ttsProviderConfig={ttsProviderConfig} />
            <TtsSpeedField />
          </>
        )}
      </div>
    </ConfigCard>
  )
}

function TtsProviderField() {
  const [ttsConfig, setTtsConfig] = useAtom(configFieldsAtomMap.tts)

  return (
    <Field>
      <FieldLabel htmlFor="ttsProvider">
        {i18n.t('options.tts.provider.label')}
      </FieldLabel>
      <ProviderSelector
        featureKey="tts"
        value={ttsConfig.providerId}
        onChange={(providerId) => {
          void setTtsConfig({ providerId })
        }}
        placeholder={i18n.t('options.tts.provider.selectPlaceholder')}
        className="w-full"
      />
    </Field>
  )
}

function TtsModelField({ providerType }: { providerType: TTSProviderType }) {
  const [ttsConfig, setTtsConfig] = useAtom(configFieldsAtomMap.tts)
  const models = providerType ? getTTSModelsForProvider(providerType) : []

  return (
    <Field>
      <FieldLabel htmlFor="ttsModel">
        {i18n.t('options.tts.model.label')}
      </FieldLabel>
      <Select
        value={ttsConfig.model}
        onValueChange={(value: TTSModel | null) => {
          if (!value || !providerType)
            return

          const availableVoices = getTTSVoicesForProvider(providerType, value)
          const nextVoice = availableVoices.includes(ttsConfig.voice)
            ? ttsConfig.voice
            : availableVoices[0]

          void setTtsConfig({
            model: value,
            voice: nextVoice,
          })
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {models.map(model => (
              <SelectItem key={model} value={model}>
                {model}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  )
}

function TtsVoiceField({
  providerType,
  ttsProviderConfig,
}: {
  providerType: TTSProviderType
  ttsProviderConfig: TTSProviderConfig
}) {
  const [ttsConfig, setTtsConfig] = useAtom(configFieldsAtomMap.tts)
  const availableVoices = providerType
    ? getTTSVoicesForProvider(providerType, ttsConfig.model)
    : ([] as readonly TTSVoice[])
  const { play, isFetching, isPlaying } = useTextToSpeech()

  const handlePreview = async () => {
    void play(
      i18n.t('options.tts.voice.previewSample'),
      ttsConfig,
      ttsProviderConfig,
    )
  }

  const isFetchingOrPlaying = isFetching || isPlaying

  return (
    <Field>
      <FieldLabel htmlFor="ttsVoice">
        {i18n.t('options.tts.voice.label')}
      </FieldLabel>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex flex-1 items-center gap-2">
          <Select
            value={ttsConfig.voice}
            onValueChange={(value: TTSVoice | null) => {
              if (!value)
                return
              void setTtsConfig({ voice: value })
            }}
          >
            <SelectTrigger
              id="ttsVoice"
              className="w-full"
            >
              <SelectValue placeholder={i18n.t('options.tts.voice.selectPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {availableVoices.map(voice => (
                  <SelectItem key={voice} value={voice}>
                    {TTS_VOICES_ITEMS[voice].name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="outline"
          className="sm:w-auto h-9"
          onClick={handlePreview}
          disabled={isFetchingOrPlaying || !ttsConfig.providerId}
        >
          {isFetchingOrPlaying ? <IconLoader2 className="mr-2 size-4 animate-spin" /> : <IconPlayerPlayFilled className="mr-2 size-4" />}
          {i18n.t('options.tts.voice.preview')}
        </Button>
      </div>
    </Field>
  )
}

function TtsSpeedField() {
  const [ttsConfig, setTtsConfig] = useAtom(configFieldsAtomMap.tts)

  return (
    <Field>
      <FieldLabel htmlFor="ttsSpeed">
        {i18n.t('options.tts.speed.label')}
      </FieldLabel>
      <ValidatedInput
        id="ttsSpeed"
        type="number"
        step="0.05"
        min={MIN_TTS_SPEED}
        max={MAX_TTS_SPEED}
        value={ttsConfig.speed}
        schema={ttsSpeedSchema}
        onChange={(event) => {
          void setTtsConfig({ speed: Number(event.target.value) })
        }}
      />
      <p className="text-xs text-muted-foreground">
        {i18n.t('options.tts.speed.hint')}
      </p>
    </Field>
  )
}
