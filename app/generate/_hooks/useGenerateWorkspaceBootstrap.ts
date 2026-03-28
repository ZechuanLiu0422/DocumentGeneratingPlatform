'use client';

import { useEffect, useRef, useState } from 'react';
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
  const callbacksRef = useRef({
    onHydrateDraft,
    onSetProviders,
    onSetProvider,
    onSetPhrases,
    onSetContacts,
    onSetRules,
    onSetReferenceAssets,
    onFetchVersions,
  });

  callbacksRef.current = {
    onHydrateDraft,
    onSetProviders,
    onSetProvider,
    onSetPhrases,
    onSetContacts,
    onSetRules,
    onSetReferenceAssets,
    onFetchVersions,
  };

  useEffect(() => {
    let mounted = true;

    const loadDeferredPanels = async (draftId: string | null) => {
      try {
        const [phrasesRes, contactsRes, rulesRes, assetsRes] = await Promise.all([
          fetch('/api/common-phrases'),
          fetch('/api/contacts'),
          fetch('/api/writing-rules'),
          fetch('/api/reference-assets'),
        ]);

        const [phrasesData, contactsData, rulesData, assetsData] = await Promise.all([
          phrasesRes.json(),
          contactsRes.json(),
          rulesRes.json(),
          assetsRes.json(),
        ]);

        if (!mounted) {
          return;
        }

        callbacksRef.current.onSetPhrases(phrasesData.phrases || []);
        callbacksRef.current.onSetContacts(contactsData.contacts || []);
        callbacksRef.current.onSetRules(rulesData.rules || []);
        callbacksRef.current.onSetReferenceAssets(assetsData.assets || []);

        if (draftId) {
          void callbacksRef.current.onFetchVersions(draftId);
        }
      } catch {
        // Keep the workspace interactive even if non-critical panel helpers fail.
      }
    };

    const bootstrap = async () => {
      setBootstrapping(true);
      setPageError('');

      try {
        const [settingsRes, draftsRes] = await Promise.all([
          fetch('/api/settings'),
          fetch('/api/drafts'),
        ]);

        const [settingsData, draftsData] = await Promise.all([
          settingsRes.json(),
          draftsRes.json(),
        ]);

        if (!mounted) {
          return;
        }

        if (!settingsRes.ok) {
          setPageError(settingsData.error || '初始化失败');
          return;
        }

        const supportedProviders = (settingsData.supportedProviders || []) as ProviderInfo[];
        callbacksRef.current.onSetProviders(supportedProviders);

        const savedProvider = localStorage.getItem('lastUsedProvider');
        const resolvedProvider =
          supportedProviders.find((item) => item.id === savedProvider)?.id ||
          supportedProviders[0]?.id ||
          'claude';

        callbacksRef.current.onSetProvider(resolvedProvider);

        const draftId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('draft') : null;
        if (draftId) {
          const draft = (draftsData.drafts || []).find((item: { id: string }) => item.id === draftId);
          if (draft) {
            callbacksRef.current.onHydrateDraft(draft as Record<string, unknown>);
          }
        }

        setBootstrapping(false);
        void loadDeferredPanels(draftId);
        return;
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
