import { css, cx } from "../../styled-system/css";
import { Dialog, Portal } from "@ark-ui/react";
import { XIcon } from "lucide-react";
import { type PropsWithChildren, type ReactNode } from "react";

export type DialogProps = PropsWithChildren<{
  title: ReactNode;
  confirmButton?: ReactNode;
  dismissButton?: ReactNode;
  onClose: () => void;
  className?: string;
}>;

export function AlertDialog({
  title,
  confirmButton,
  dismissButton,
  children,
  onClose,
  className,
}: DialogProps) {
  return (
    <Dialog.Root
      open={true}
      onOpenChange={(event) => {
        if (!event.open) {
          onClose();
        }
      }}
      closeOnInteractOutside={false}
    >
      <Portal>
        <Dialog.Backdrop
          onClick={onClose}
          className={css({
            position: "fixed",
            inset: 0,
            backgroundColor: "rgb(0, 0, 0, 0.6)",
            backdropFilter: "blur(16px)",
            pointerEvents: "auto",
            zIndex: 1,
          })}
        />
        <Dialog.Positioner
          className={css({
            position: "fixed",
            inset: 0,
            display: "flex",
            zIndex: 1,
          })}
        >
          <Dialog.Content
            className={cx(
              css({
                borderRadius: "1rem",
                margin: "auto",
                backgroundColor: "surface",
                padding: "2rem",
                color: "onSurface",
                pointerEvents: "auto",
              }),
              className,
            )}
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
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.CloseTrigger
                className={css({
                  cursor: "pointer",
                })}
              >
                <XIcon />
              </Dialog.CloseTrigger>
            </div>
            <Dialog.Description>
              <div className={css({ textStyle: "body" })}>{children}</div>
              <div
                className={css({
                  display: "flex",
                  justifyContent: "end",
                  gap: "0.5rem",
                  marginTop: "2rem",
                  "&:empty": { display: "none" },
                })}
              >
                {dismissButton}
                {confirmButton}
              </div>
            </Dialog.Description>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
