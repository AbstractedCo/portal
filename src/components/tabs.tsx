import { css, cx } from "../../styled-system/css";
import { Tabs as BaseTabs } from "@ark-ui/react";
import type { PropsWithChildren } from "react";

export type TabsProps<T extends string> = PropsWithChildren<{
  value: T;
  onChangeValue?: (value: T) => void | undefined;
  className?: string | undefined;
}>;

export const Tabs = Object.assign(_Tabs, { Item: BaseTabs.Trigger });

function _Tabs<T extends string>({
  value,
  onChangeValue,
  className,
  children,
}: TabsProps<T>) {
  return (
    <BaseTabs.Root
      value={value}
      onValueChange={({ value }) => onChangeValue?.(value as T)}
      className={cx(css({ fontSize: "1rem" }), className)}
    >
      <BaseTabs.List
        className={css({
          position: "relative",
          display: "flex",
          border: "1px solid {colors.outlineVariant}",
          borderRadius: "1rem",
          overflow: "hidden",
          "& [data-part='trigger']": {
            flex: 1,
            color: "onSurface",
            padding: "1em",
            cursor: "pointer",
          },
        })}
      >
        {children}
        <BaseTabs.Indicator
          className={css({
            top: "var(--top)",
            left: "var(--left)",
            width: "var(--width)",
            height: "var(--height)",
            borderRadius: "1rem",
            backgroundColor: "onSurface",
            mixBlendMode: "difference",
            pointerEvents: "none",
          })}
        />
        <BaseTabs.Indicator
          className={css({
            top: "var(--top)",
            left: "var(--left)",
            width: "var(--width)",
            height: "var(--height)",
            borderRadius: "1rem",
            backgroundColor: "primary",
            mixBlendMode: "darken",
            pointerEvents: "none",
          })}
        />
      </BaseTabs.List>
    </BaseTabs.Root>
  );
}
