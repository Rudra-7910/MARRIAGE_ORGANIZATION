import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "./Icon";

export type DialogTopic = "start" | "privacy" | "terms" | "contact";

const content = {
  start: {
    title: "Your wedding workspace is coming next.",
    description:
      "We’re getting your shared planning space ready. For now, explore the sample wedding and imagine your people, all on the same page.",
  },
  privacy: {
    title: "Your family’s space matters.",
    description:
      "The full privacy policy will be available before account registration opens. This homepage preview does not collect registration details or send invitations.",
  },
  terms: {
    title: "A few details before we begin.",
    description:
      "The full terms will be available before the wedding workspace launches. The workspace shown on this homepage is a sample, with illustrative names and figures.",
  },
  contact: {
    title: "We’re getting ready to celebrate.",
    description:
      "Contact details will be available when the wedding workspace opens. Until then, take a look around the sample wedding.",
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

  function exploreSample() {
    onClose();
    if (window.location.pathname !== "/") {
      navigate("/#sample-workspace");
      return;
    }
    document
      .getElementById("sample-workspace")
      ?.scrollIntoView({ behavior: "auto", block: "center" });
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
          <button className="button button-primary" onClick={exploreSample}>
            Explore the sample workspace
            <Icon name="arrow" />
          </button>
        </div>
      )}
    </dialog>
  );
}
