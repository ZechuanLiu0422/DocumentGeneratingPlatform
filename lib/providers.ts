import { AppError } from '@/lib/api';
import { getEnv } from '@/lib/env';

export const PROVIDERS = ['claude', 'openai', 'doubao', 'glm'] as const;
export type Provider = (typeof PROVIDERS)[number];

type ProviderConfig = {
  id: Provider;
  label: string;
  apiKeyEnv: string;
  modelEnv: string;
  defaultModel?: string;
  baseURL?: string;
};

const providerConfigs: Record<Provider, ProviderConfig> = {
  claude: {
    id: 'claude',
    label: 'Claude',
    apiKeyEnv: 'CLAUDE_API_KEY',
    modelEnv: 'CLAUDE_MODEL',
    defaultModel: 'claude-3-5-sonnet-latest',
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    apiKeyEnv: 'OPENAI_API_KEY',
    modelEnv: 'OPENAI_MODEL',
    defaultModel: 'gpt-4o-mini',
  },
  doubao: {
    id: 'doubao',
    label: '豆包',
    apiKeyEnv: 'DOUBAO_API_KEY',
    modelEnv: 'DOUBAO_MODEL',
    baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
  },
  glm: {
    id: 'glm',
    label: '智谱 GLM',
    apiKeyEnv: 'GLM_API_KEY',
    modelEnv: 'GLM_MODEL',
    defaultModel: 'glm-4-flash',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
  },
};

export function getEnabledProviders() {
  return PROVIDERS.filter((provider) => {
    const config = providerConfigs[provider];
    const apiKey = getEnv(config.apiKeyEnv);
    const model = getEnv(config.modelEnv) || config.defaultModel;
    return Boolean(apiKey && model);
  });
}

export function getPublicProviderInfo() {
  return getEnabledProviders().map((provider) => ({
    id: provider,
    label: providerConfigs[provider].label,
  }));
}

export function getProviderConfig(provider: Provider) {
  const config = providerConfigs[provider];
  const apiKey = getEnv(config.apiKeyEnv);
  const model = getEnv(config.modelEnv) || config.defaultModel;

  if (!apiKey || !model) {
    throw new AppError(400, `${config.label} 当前未配置`, 'PROVIDER_NOT_CONFIGURED');
  }

  return {
    ...config,
    apiKey,
    model,
  };
}

export function ensureProviderEnabled(provider: Provider) {
  if (!getEnabledProviders().includes(provider)) {
    throw new AppError(400, `${providerConfigs[provider].label} 当前不可用`, 'PROVIDER_NOT_AVAILABLE');
  }
}
