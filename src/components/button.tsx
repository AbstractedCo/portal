import { css, cx } from "../../styled-system/css";
import type { ButtonHTMLAttributes, DetailedHTMLProps } from "react";

export type ButtonProps = DetailedHTMLProps<
  ButtonHTMLAttributes<HTMLButtonElement>,
  HTMLButtonElement
>;

export function Button(props: ButtonProps) {
  return (
    <button
      {...props}
      className={cx(
        css({
          fontSize: "1rem",
          borderRadius: "0.3rem",
          backgroundColor: "primary",
          padding: "0.875em 1.75em",
          color: "onPrimary",
          cursor: "pointer",
        }),
        props.className,
      )}
    />
  );
}
