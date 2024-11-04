import { css, cx } from "../../styled-system/css";
import { CircularProgressIndicator } from "./circular-progress-indicator";
import type { ButtonHTMLAttributes, DetailedHTMLProps } from "react";

export type ButtonProps = DetailedHTMLProps<
  ButtonHTMLAttributes<HTMLButtonElement>,
  HTMLButtonElement
> & {
  pending?: boolean;
};

export function Button({ pending, children, ...props }: ButtonProps) {
  const disabled = pending || props.disabled;
  return (
    <button
      {...props}
      data-pending={pending}
      className={cx(
        css({
          fontSize: "1rem",
          borderRadius: "0.3rem",
          backgroundColor: "primary",
          padding: "0.8em 1.75em",
          color: "onPrimary",
          cursor: "pointer",
          "&:disabled:not([data-pending='true'])": {
            filter: "brightness(0.5)",
            cursor: "not-allowed",
          },
          "&[data-pending='true']": {
            cursor: "progress",
          },
        }),
        props.className,
      )}
      disabled={disabled}
    >
      <div
        className={css({
          display: "grid",
          gridTemplateColumns: "1fr",
          placeItems: "center",
          "&>div": {
            gridRowStart: 1,
            gridColumnStart: 1,
          },
        })}
      >
        <div
          style={{
            visibility: pending ? "hidden" : "visible",
            pointerEvents: pending ? "none" : "auto",
          }}
        >
          {children}
        </div>
        {pending && (
          <div>
            <CircularProgressIndicator size="1em" />
          </div>
        )}
      </div>
    </button>
  );
}
