'use client';

import { useEffect, useState } from 'react';
import type { DraftSnapshot } from '@/lib/generate-workspace';

type ProviderInfo = {
  id: DraftSnapshot['provider'];
  label: string;
};

type UseGenerateWorkspaceBootstrapOptions = {
  onHydrateDraft: (draft: Record<string, unknown>) => void;
  onSetProviders: (providers: ProviderInfo[]) => void;
  onSetProvider: (provider: DraftSnapshot['provider']) => void;
  onSetPhrases: (phrases: unknown[]) => void;
  onSetContacts: (contacts: unknown[]) => void;
  onSetRules: (rules: unknown[]) => void;
  onSetReferenceAssets: (assets: unknown[]) => void;
  onFetchVersions: (draftId: string) => Promise<void> | void;
};

export function useGenerateWorkspaceBootstrap({
  onHydrateDraft,
  onSetProviders,
  onSetProvider,
  onSetPhrases,
  onSetContacts,
  onSetRules,
  onSetReferenceAssets,
  onFetchVersions,
}: UseGenerateWorkspaceBootstrapOptions) {
  const [bootstrapping, setBootstrapping] = useState(true);
  const [pageError, setPageError] = useState('');

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      setBootstrapping(true);
      setPageError('');

      try {
        const [settingsRes, phrasesRes, contactsRes, draftsRes, rulesRes, assetsRes] = await Promise.all([
          fetch('/api/settings'),
          fetch('/api/common-phrases'),
          fetch('/api/contacts'),
          fetch('/api/drafts'),
          fetch('/api/writing-rules'),
          fetch('/api/reference-assets'),
        ]);

        const [settingsData, phrasesData, contactsData, draftsData, rulesData, assetsData] = await Promise.all([
          settingsRes.json(),
          phrasesRes.json(),
          contactsRes.json(),
          draftsRes.json(),
          rulesRes.json(),
          assetsRes.json(),
        ]);

        if (!mounted) {
          return;
        }

        if (!settingsRes.ok) {
          setPageError(settingsData.error || '初始化失败');
          return;
        }

        const supportedProviders = (settingsData.supportedProviders || []) as ProviderInfo[];
        onSetProviders(supportedProviders);
        onSetPhrases(phrasesData.phrases || []);
        onSetContacts(contactsData.contacts || []);
        onSetRules(rulesData.rules || []);
        onSetReferenceAssets(assetsData.assets || []);

        const savedProvider = localStorage.getItem('lastUsedProvider');
        const resolvedProvider =
          supportedProviders.find((item) => item.id === savedProvider)?.id ||
          supportedProviders[0]?.id ||
          'claude';

        onSetProvider(resolvedProvider);

        const draftId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('draft') : null;
        if (draftId) {
          const draft = (draftsData.drafts || []).find((item: { id: string }) => item.id === draftId);
          if (draft) {
            onHydrateDraft(draft as Record<string, unknown>);
            void onFetchVersions(draft.id);
          }
        }
      } catch {
        if (mounted) {
          setPageError('初始化失败，请刷新后重试');
        }
      } finally {
        if (mounted) {
          setBootstrapping(false);
        }
      }
    };

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  return {
    bootstrapping,
    pageError,
  };
}
