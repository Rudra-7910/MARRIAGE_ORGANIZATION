import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "./Icon";

export type DialogTopic = "start" | "privacy" | "terms" | "contact";

const content = {
  start: {
    title: "Begin your wedding workspace.",
    description:
      "Create an account, register your family, and add your wedding details.",
  },
  privacy: {
    title: "Your family’s space matters.",
    description:
      "The full privacy policy is being prepared. Wedding details saved in your account power your dashboard; the guest website displays the contact and ceremony details you choose to publish.",
  },
  terms: {
    title: "A few details before we begin.",
    description:
      "The full terms are being prepared. This application currently supports family setup, wedding details and a shared guest website.",
  },
  contact: {
    title: "We’re getting ready to celebrate.",
    description: "Support contact details will be added here when available.",
  },
};

type InfoDialogProps = { topic: DialogTopic | null; onClose: () => void };

export function InfoDialog({ topic, onClose }: InfoDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const navigate = useNavigate();

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
          <span className="dialog-emblem">
            <Icon name="spark" />
          </span>
          <span className="eyebrow">MAKE MY MARRIAGE</span>
          <h2 id="dialog-title">{content[topic].title}</h2>
          <p id="dialog-description">{content[topic].description}</p>
          <button className="button button-primary" onClick={openWorkspace}>
            Open your workspace
            <Icon name="arrow" />
          </button>
        </div>
      )}
    </dialog>
  );
}
