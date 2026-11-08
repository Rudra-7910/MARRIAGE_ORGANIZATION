import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, apiMessage } from "../../lib/api";
import i18n from "../../lib/language";

export function LanguageToggle() {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const [wanted, setWanted] = useState("en");
  const change = useMutation({
    mutationFn: async (language: string) => {
      if (language === "hi") {
        const labels = await cache.fetchQuery({
          queryKey: ["interface-labels", "hi"],
          staleTime: 86400000,
          queryFn: async () =>
            (
              await api.get<{ data: Record<string, string> }>(
                "/interface-labels/hi",
              )
            ).data.data,
        });
        i18n.addResourceBundle("hi", "translation", labels, true, true);
      }
      await i18n.changeLanguage(language);
      try {
        localStorage.setItem("mmm-language", language);
      } catch {
        /* Optional preference. */
      }
    },
    onError: () => setWanted(i18n.language),
  });
  useEffect(() => {
    try {
      if (localStorage.getItem("mmm-language") === "hi") {
        setWanted("hi");
        change.mutate("hi");
      }
    } catch {
      /* English is available when browser storage is disabled. */
    }
    // Read the preference once; switching controls calls the mutation directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="language-control">
      <label>
        <span className="sr-only">Interface language</span>
        <select
          aria-label="Interface language"
          value={wanted}
          disabled={change.isPending}
          onChange={(event) => {
            setWanted(event.target.value);
            change.mutate(event.target.value);
          }}
        >
          <option value="en">{t("English")}</option>
          <option value="hi">हिन्दी</option>
        </select>
      </label>
      {change.isError && <span role="status">{apiMessage(change.error)}</span>}
    </div>
  );
}
