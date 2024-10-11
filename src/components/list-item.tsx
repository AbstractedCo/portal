import { css } from "../../styled-system/css";
import type { ReactNode } from "react";

export type ListItemProps = {
  headline: ReactNode;
  supporting?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
};

export function ListItem({
  headline,
  supporting,
  leading,
  trailing,
}: ListItemProps) {
  return (
    <article
      className={css({
        textStyle: "body",
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        padding: "1em",
        color: "primary",
      })}
    >
      {leading}
      <div>
        <header>{headline}</header>
        <div
          className={css({
            display: "contents",
            textStyle: "bodySmall",
            color: "content.muted",
          })}
        >
          {supporting}
        </div>
      </div>
      {trailing}
    </article>
  );
}
