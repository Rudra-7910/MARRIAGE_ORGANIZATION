import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Icon } from "../../components/ui/Icon";

// Shared native dialog: focus trapping, Escape and focus restoration come from the browser.
export function PlanningDialog({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    const previousOverflow = document.body.style.overflowY;
    document.body.style.overflowY = "hidden";
    return () => {
      element.close();
      document.body.style.overflowY = previousOverflow;
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={"plan-dialog" + (wide ? " plan-dialog-wide" : "")}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      aria-label={title}
    >
      <div className="plan-dialog-heading">
        <h2>{title}</h2>
        <button
          type="button"
          className="ws-button plan-icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
