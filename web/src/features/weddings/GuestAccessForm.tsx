import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiMessage, getCsrfHeaders } from "../../lib/api";
import { getPlanning } from "../../lib/planning";

import { getInvitation, type GuestAccess } from "../../lib/invitations";
export function GuestAccessForm({
  guestId,
  access,
  userId,
}: {
  guestId: string;
  access: GuestAccess;
  userId: string;
}) {
  const cache = useQueryClient();
  const [selected, setSelected] = useState(access.functionIds);
  const [revoked, setRevoked] = useState(access.revoked);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [version, setVersion] = useState(access.version);
  const [dirty, setDirty] = useState(false);
  const [reloadError, setReloadError] = useState("");
  useEffect(() => {
    if (dirty) return;
    setVersion(access.version);
    setSelected(access.functionIds);
    setRevoked(access.revoked);
  }, [access.version, access.functionIds, access.revoked, dirty]);
  const planning = useQuery({
    queryKey: ["planning", userId],
    queryFn: ({ signal }) => getPlanning(signal),
  });
  const change = useMutation({
    mutationFn: async () =>
      (
        await api.patch<{ data: GuestAccess }>(
          "/weddings/current/guests/" + guestId + "/access",
          {
            version,
            functionIds: selected.filter((id) =>
              planning.data?.functions.some((item) => item.id === id),
            ),
            revoked,
          },
          { headers: await getCsrfHeaders() },
        )
      ).data.data,
    onSuccess: async (next) => {
      setDirty(false);
      setVersion(next.version);
      setCopied(false);
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["invitation", userId, guestId] }),
        cache.invalidateQueries({ queryKey: ["guests", userId] }),
      ]);
    },
  });
  return (
    <section className="guest-access-form">
      <div>
        <h2>This family’s invitation link</h2>
        <p>
          The main wedding is always included. Choose any additional functions
          for this family. Save access before composing the email.
        </p>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          change.mutate();
        }}
      >
        <fieldset disabled={change.isPending}>
          <legend>Additional functions</legend>
          {planning.isPending && <p role="status">Loading functions…</p>}
          {planning.isError && <p role="alert">{apiMessage(planning.error)}</p>}
          {planning.data?.functions.map((item) => (
            <label key={item.id} className="guest-access-choice">
              <input
                type="checkbox"
                checked={selected.includes(item.id)}
                onChange={(event) => {
                  setDirty(true);
                  setSelected(
                    event.target.checked
                      ? [...selected, item.id]
                      : selected.filter((id) => id !== item.id),
                  );
                }}
              />
              {item.name}
            </label>
          ))}
          {planning.data?.functions.length === 0 && (
            <p>No additional functions yet. Add them from Functions.</p>
          )}
          <label className="guest-access-choice">
            <input
              type="checkbox"
              checked={revoked}
              onChange={(event) => {
                setDirty(true);
                setRevoked(event.target.checked);
              }}
            />
            Withdraw this personal link
          </label>
        </fieldset>
        <button
          className="ws-button ws-primary"
          disabled={change.isPending || !planning.data}
        >
          {change.isPending ? "Saving…" : "Save invitation access"}
        </button>
        {change.isError && (
          <p role="alert">
            {apiMessage(change.error)}{" "}
            <button
              className="ws-text-link"
              type="button"
              onClick={async () => {
                setReloadError("");
                try {
                  const fresh = await cache.fetchQuery({
                    queryKey: ["invitation", userId, guestId],
                    queryFn: () => getInvitation(guestId),
                    staleTime: 0,
                  });
                  if (!fresh.access)
                    throw new Error(
                      "Invitation access is unavailable. Reload the page before continuing.",
                    );
                  setVersion(fresh.access.version);
                  setSelected(fresh.access.functionIds);
                  setRevoked(fresh.access.revoked);
                  setDirty(false);
                  change.reset();
                } catch (error) {
                  setReloadError(apiMessage(error));
                }
              }}
            >
              Discard changes and reload latest access
            </button>
          </p>
        )}
        {change.isSuccess && <p role="status">Invitation access saved.</p>}
        {reloadError && <p role="alert">{reloadError}</p>}
      </form>
      {access.url && !access.revoked && (
        <div className="guest-access-link">
          <input
            readOnly
            aria-label="Personal wedding invitation link"
            value={access.url}
            onFocus={(event) => event.target.select()}
          />
          <button
            className="ws-button"
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(access.url!);
                setCopied(true);
                setCopyError(false);
              } catch {
                setCopyError(true);
              }
            }}
          >
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      )}
      {access.revoked && (
        <p>
          This personal link is withdrawn. Your generic wedding website remains
          public.
        </p>
      )}
      {copyError && (
        <p role="status">Select the link above and copy it manually.</p>
      )}
    </section>
  );
}
