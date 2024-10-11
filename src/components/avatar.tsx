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
        display: "grid",
        gridTemplateColumns: "1fr",
        fontSize: "1rem",
        width: "2.5em",
        height: "2.5em",
        borderRadius: "calc(2.5em / 2)",
        overflow: "hidden",
      })}
    >
      <BaseAvatar.Fallback>{alt}</BaseAvatar.Fallback>
      <BaseAvatar.Image src={src} alt={alt} />
    </BaseAvatar.Root>
  );
}
