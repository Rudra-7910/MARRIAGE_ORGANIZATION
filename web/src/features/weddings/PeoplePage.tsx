import { apiMessage } from "../../lib/api";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Icon } from "../../components/ui/Icon";

import type { WeddingRole } from "../../lib/weddings";
import {
  createTeamInvite,
  getTeam,
  removeTeamMember,
  revokeTeamInvite,
  roleDescriptions,
} from "../../lib/team";

export function PeoplePage({ userId }: { userId: string }) {
  const cache = useQueryClient();
  const [role, setRole] = useState<WeddingRole>("Worker");
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState("");
  const query = useQuery({
    queryKey: ["wedding-team", userId],
    queryFn: ({ signal }) => getTeam(signal),
    staleTime: 0,
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
  });
  async function refresh() {
    await Promise.all([
      cache.invalidateQueries({ queryKey: ["wedding-team", userId] }),
      cache.invalidateQueries({ queryKey: ["wedding-dashboard", userId] }),
    ]);
  }
  const create = useMutation({
    mutationFn: createTeamInvite,
    onSuccess: async () => {
      setCopied(false);
      setCopyFailed(false);
      await refresh();
    },
  });
  const remove = useMutation({
    mutationFn: removeTeamMember,
    onSuccess: async () => {
      setMemberToRemove("");
      await refresh();
    },
  });
  const revoke = useMutation({
    mutationFn: revokeTeamInvite,
    onSuccess: async (_result, id) => {
      if (create.data?.id === id) create.reset();
      await refresh();
    },
  });
  async function copyLink() {
    if (!create.data) return;
    try {
      await navigator.clipboard.writeText(create.data.url);
      setCopied(true);
      setCopyFailed(false);
    } catch {
      setCopyFailed(true);
    }
  }
  const data = query.data;
  return (
    <div className="team-page">
      <div className="dash-page-heading">
        <div>
          <span className="dash-kicker">YOUR PEOPLE, TOGETHER</span>
          <h1>People & Access</h1>
          <p>Invite your family and helpers with the right wedding role.</p>
        </div>
      </div>
      {query.isPending ? (
        <p role="status">Loading your wedding team…</p>
      ) : query.isError ? (
        <div className="ws-form-error" role="alert">
          <p>{apiMessage(query.error)}</p>
          <button className="ws-button" onClick={() => query.refetch()}>
            Try again
          </button>
        </div>
      ) : (
        data && (
          <>
            <section className="dash-card">
              <div className="dash-card-heading">
                <h2>Your wedding team</h2>
                <span className="dash-badge">Wedding access only</span>
              </div>
              {data.members.map((member) => (
                <div className="team-member" key={member.id}>
                  <span className="dash-avatar">
                    {member.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="team-member-name">
                    <strong>
                      {member.name}
                      {member.isYou && " (you)"}
                    </strong>
                    {member.email && <p>{member.email}</p>}
                    {member.isCreator && (
                      <small>Wedding creator · protected access</small>
                    )}
                  </div>
                  <span className="dash-badge">{member.role}</span>
                  {member.canRemove && (
                    <button
                      className="ws-button"
                      onClick={() => {
                        remove.reset();
                        setMemberToRemove(member.id);
                      }}
                    >
                      Remove access
                    </button>
                  )}
                  {memberToRemove === member.id && (
                    <div
                      className="team-confirm"
                      role="group"
                      aria-label={"Confirm removing " + member.name}
                    >
                      <p>
                        Remove {member.name} from this wedding? Their private
                        API access will stop immediately.
                      </p>
                      <button
                        className="ws-button"
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(member.id)}
                      >
                        {remove.isPending ? "Removing…" : "Confirm removal"}
                      </button>
                      <button
                        className="ws-button"
                        onClick={() => setMemberToRemove("")}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {remove.isError && (
                <p className="ws-form-error" role="alert">
                  {apiMessage(remove.error)}
                </p>
              )}
            </section>
            {data.allowedRoles.length > 0 && (
              <section className="dash-card">
                <div className="dash-card-heading">
                  <h2>Invite someone to help</h2>
                  <Icon name="link" />
                </div>
                <p className="team-note">
                  Choose their role and create a private link. They sign in or
                  create an account, review the invitation, and join with
                  exactly this access.
                </p>
                <form
                  className="team-invite-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    create.mutate(role);
                  }}
                >
                  <label htmlFor="team-role">
                    Wedding role
                    <select
                      id="team-role"
                      value={role}
                      onChange={(event) =>
                        setRole(event.target.value as WeddingRole)
                      }
                    >
                      {data.allowedRoles.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="ws-button ws-primary"
                    disabled={create.isPending}
                  >
                    {create.isPending
                      ? "Creating link…"
                      : "Create invitation link"}
                    <Icon name="arrow" />
                  </button>
                </form>
                <p className="team-note">{roleDescriptions[role]}</p>
                {create.isError && (
                  <p className="ws-form-error" role="alert">
                    {apiMessage(create.error)}
                  </p>
                )}
                {create.data && (
                  <div className="team-created-link" role="status">
                    <strong>{create.data.role} invitation ready</strong>
                    <p>
                      Share privately. Anyone with this link can use it once. It
                      expires in 7 days. Copy it now; the full link is only
                      shown here.
                    </p>
                    <label htmlFor="team-invite-link">
                      Private invitation link
                    </label>
                    <input
                      id="team-invite-link"
                      value={create.data.url}
                      readOnly
                      onFocus={(event) => event.currentTarget.select()}
                    />
                    <button className="ws-button" onClick={copyLink}>
                      <Icon name={copied ? "check" : "link"} />
                      {copied ? "Link copied" : "Copy invitation link"}
                    </button>
                    {copyFailed && (
                      <p>Select the link above and copy it manually.</p>
                    )}
                  </div>
                )}
              </section>
            )}
            {data.invites.length > 0 && (
              <section className="dash-card">
                <div className="dash-card-heading">
                  <h2>Team invitation links</h2>
                </div>
                {data.invites.map((invite) => (
                  <div className="team-member" key={invite.id}>
                    <Icon name="mail" />
                    <div className="team-member-name">
                      <strong>{invite.role} invitation</strong>
                      <p>
                        Expires{" "}
                        {new Date(invite.expiresAt).toLocaleString("en-IN", {
                          timeZone: "Asia/Kolkata",
                        })}{" "}
                        IST
                      </p>
                    </div>
                    <span className="dash-badge">{invite.status}</span>
                    {invite.canRevoke && (
                      <button
                        className="ws-button"
                        disabled={revoke.isPending}
                        onClick={() => revoke.mutate(invite.id)}
                      >
                        Revoke link
                      </button>
                    )}
                  </div>
                ))}
                {revoke.isError && (
                  <p className="ws-form-error" role="alert">
                    {apiMessage(revoke.error)}
                  </p>
                )}
              </section>
            )}
          </>
        )
      )}
      <div className="dash-access-grid team-role-grid">
        {Object.entries(roleDescriptions).map(([name, description]) => (
          <section className="dash-card" key={name}>
            <Icon name="lock" />
            <h2>{name}</h2>
            <p>{description}</p>
          </section>
        ))}
      </div>
      <p className="team-note">
        Managers can remove Workers they invited. Only the wedding creator can
        invite or remove Admins and Organizers. Budget and guest records are
        never shared with Managers or Workers.
      </p>
    </div>
  );
}
