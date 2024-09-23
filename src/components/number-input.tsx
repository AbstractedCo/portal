import { css } from "../../styled-system/css";
import { NumberInput as BaseNumberInput } from "@ark-ui/react";
import type { ReactNode } from "react";

export type NumberInputProps = {
  label?: ReactNode;
};

export function NumberInput({ label }: NumberInputProps) {
  return (
    <BaseNumberInput.Root
      className={css({ fontSize: "1rem", color: "onSurface" })}
    >
      {label && <BaseNumberInput.Label>{label}</BaseNumberInput.Label>}
      <div
        className={css({
          display: "flex",
          width: "fit-content",
          border: "1px solid {colors.outline}",
          borderRadius: "0.5rem",
          backgroundColor: "container",
        })}
      >
        <BaseNumberInput.Input className={css({ padding: "0 1em" })} />
        <BaseNumberInput.Control
          className={css({
            display: "flex",
            flexDirection: "column-reverse",
            borderLeft: "1px solid {colors.outline}",
          })}
        >
          <BaseNumberInput.DecrementTrigger
            className={css({
              padding: "0.25rem",
              lineHeight: "0.75em",
              cursor: "pointer",
            })}
          >
            -
          </BaseNumberInput.DecrementTrigger>
          <BaseNumberInput.IncrementTrigger
            className={css({
              padding: "0.25rem",
              lineHeight: "0.75em",
              borderBottom: "1px solid {colors.outline}",
              cursor: "pointer",
            })}
          >
            +
          </BaseNumberInput.IncrementTrigger>
        </BaseNumberInput.Control>
      </div>
    </BaseNumberInput.Root>
  );
}
