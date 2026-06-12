import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { createApiClient } from "@soc/api-client";
import type { ContactRecord } from "@soc/contracts";

import { useLanguage } from "@/hooks/use-language";
import { resolveApiBaseUrl } from "@/lib/api-base-url";

export function useAboutPageController() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { lang } = useLanguage();
  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );

  const currentTab = searchParams.get("tab") || "intro";
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);

  useEffect(() => {
    if (currentTab !== "members") return;

    setContactsLoading(true);
    apiClient
      .getContacts()
      .then((res) => {
        const sorted = [...res.items].sort((a, b) => a.sortOrder - b.sortOrder);
        setContacts(sorted);
      })
      .catch(() => {
        // About still renders when member data is unavailable.
      })
      .finally(() => {
        setContactsLoading(false);
      });
  }, [apiClient, currentTab]);

  const handleTabChange = (tab: string) => {
    setSearchParams({ tab });
  };

  return {
    contacts,
    contactsLoading,
    currentTab,
    handleTabChange,
    lang,
  };
}
