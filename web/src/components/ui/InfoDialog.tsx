import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "./Icon";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";

export type DialogTopic = "privacy" | "terms" | "contact";

const content = {
  privacy: {
    title: "Privacy",
    description:
      "Budget and guest records are restricted to wedding organizers. Ceremony details and approved photos are public. Anyone with a personal invitation or upload link can use that link. Email, storage and optional Google services process the data needed for their features.",
  },
  terms: {
    title: "Terms of use",
    description:
      "Make My Marriage helps families coordinate their wedding. Service listings and reviews are contributed by users. Confirm availability, arrangements and payments directly with the service provider. Share only content you have permission to publish, and ask an organizer to remove inappropriate photos.",
  },
  contact: {
    title: "Contact and support",
    description:
      "For ceremony details and directions, contact the family organizer on your wedding website. For account or platform support, use the published support address below.",
  },
};

type InfoDialogProps = { topic: DialogTopic | null; onClose: () => void };

export function InfoDialog({ topic, onClose }: InfoDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const navigate = useNavigate();
  const info = useQuery({
    queryKey: ["site-info"],
    queryFn: async () =>
      (
        await api.get<{
          data: {
            supportEmail: string;
            privacyPolicyUrl: string;
            termsUrl: string;
          };
        }>("/site-info")
      ).data.data,
    enabled: Boolean(topic),
    staleTime: 5 * 60000,
  });
  const policyUrl =
    topic === "privacy"
      ? info.data?.privacyPolicyUrl
      : topic === "terms"
        ? info.data?.termsUrl
        : null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (topic && dialog && !dialog.open) dialog.showModal();
    if (!topic && dialog?.open) dialog.close();
  }, [topic]);

  function openWorkspace() {
    onClose();
    navigate("/app/setup");
  }

  return (
    <dialog
      ref={dialogRef}
      className="info-dialog"
      aria-labelledby="dialog-title"
      aria-describedby="dialog-description"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {topic && (
        <div className="dialog-content">
          <button
            className="dialog-close"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
          <h2 id="dialog-title">{content[topic].title}</h2>
          <p id="dialog-description">{content[topic].description}</p>
          {info.isPending && (
            <p role="status">Loading contact and policy details…</p>
          )}
          {info.isError && (
            <p role="alert">
              Couldn’t load the published links. Close this dialog and try
              again.
            </p>
          )}
          {policyUrl && (
            <p>
              <a href={policyUrl} target="_blank" rel="noreferrer">
                Read the full{" "}
                {topic === "privacy" ? "privacy policy" : "terms of use"}{" "}
                <Icon name="arrow" />
              </a>
            </p>
          )}
          {topic === "contact" &&
            info.data &&
            (info.data.supportEmail ? (
              <p>
                <a href={"mailto:" + info.data.supportEmail}>
                  {info.data.supportEmail}
                </a>
              </p>
            ) : (
              <p>
                The site operator has not configured a platform support address.
              </p>
            ))}
          {topic !== "contact" && info.data && !policyUrl && (
            <p>
              The site operator has not published the full policy for this
              deployment.
            </p>
          )}
          <button className="button button-primary" onClick={openWorkspace}>
            Open your workspace
            <Icon name="arrow" />
          </button>
        </div>
      )}
    </dialog>
  );
}
