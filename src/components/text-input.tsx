import { css, cx } from "../../styled-system/css";
import { Field } from "@ark-ui/react";
import type { ReactNode } from "react";

export type TextProps = {
  value: string;
  onChangeValue: (value: string) => void;
  label?: ReactNode | undefined;
  trailingLabel?: ReactNode | undefined;
  supporting?: ReactNode | undefined;
  placeholder?: string | undefined;
  className?: string;
};

export function TextInput({
  value,
  onChangeValue,
  label,
  trailingLabel,
  supporting,
  placeholder,
  className,
}: TextProps) {
  return (
    <Field.Root
      className={cx(
        css({
          fontSize: "1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          width: "fit-content",
          color: "content",
        }),
        className,
      )}
    >
      {(label || trailingLabel) && (
        <div
          className={css({
            display: "flex",
            justifyContent: "space-between",
            gap: "0.5rem",
          })}
        >
          {label && (
            <Field.Label
              className={css({
                textStyle: "bodySmall",
                color: "content.muted",
              })}
            >
              {label}
            </Field.Label>
          )}
          {trailingLabel && (
            <Field.Label
              className={css({
                textStyle: "bodySmall",
                color: "content.muted",
              })}
            >
              {trailingLabel}
            </Field.Label>
          )}
        </div>
      )}
      <Field.Input
        value={value}
        onChange={(event) => onChangeValue(event.target.value)}
        placeholder={placeholder}
        className={css({
          border: "1px solid transparent",
          borderRadius: "0.3125em",
          backgroundColor: "container",
          padding: "0.75em",
        })}
      />
      {supporting && (
        <Field.HelperText
          className={css({ textStyle: "bodySmall", color: "content.muted" })}
        >
          {supporting}
        </Field.HelperText>
      )}
      <Field.ErrorText>Error Info</Field.ErrorText>
    </Field.Root>
  );
}
