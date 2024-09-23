import { css } from "../../styled-system/css";
import { Avatar as BaseAvatar } from "@ark-ui/react";

export type AvatarProps = {
  src: string;
  alt?: string;
};

export function Avatar({ src, alt }: AvatarProps) {
  return (
    <BaseAvatar.Root
      className={css({
        fontSize: "1rem",
        position: "relative",
        width: "2.5em",
        height: "2.5em",
        borderRadius: "calc(2.5em / 2)",
        overflow: "hidden",
      })}
    >
      <BaseAvatar.Fallback className={css({ position: "absolute", inset: 0 })}>
        {alt}
      </BaseAvatar.Fallback>
      <BaseAvatar.Image
        src={src}
        alt={alt}
        className={css({ position: "absolute", inset: 0 })}
      />
    </BaseAvatar.Root>
  );
}
