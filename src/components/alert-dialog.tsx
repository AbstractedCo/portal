import { css } from "../../styled-system/css";
import { XIcon } from "lucide-react";
import {
  type PropsWithChildren,
  type ReactNode,
  useLayoutEffect,
  useRef,
} from "react";

export type DialogProps = PropsWithChildren<{
  title: ReactNode;
  confirmButton?: ReactNode;
  dismissButton?: ReactNode;
  onClose: () => void;
}>;

export function AlertDialog({
  title,
  confirmButton,
  dismissButton,
  children,
  onClose,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className={css({
        borderRadius: "1rem",
        margin: "auto",
        backgroundColor: "surface",
        padding: "2rem",
        color: "onSurface",
      })}
    >
      <div
        className={css({
          textStyle: "bodyLarge",
          fontWeight: "bold",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
          marginBottom: "2.5rem",
        })}
      >
        <header>{title}</header>
        <button onClick={onClose} className={css({ cursor: "pointer" })}>
          <XIcon />
        </button>
      </div>
      <div className={css({ textStyle: "body" })}>{children}</div>
      <div
        className={css({
          display: "flex",
          justifyContent: "end",
          "&:empty": { display: "none" },
        })}
      >
        {dismissButton}
        {confirmButton}
      </div>
    </dialog>
  );
}
