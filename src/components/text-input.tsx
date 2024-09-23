import { css } from "../../styled-system/css";
import { Field } from "@ark-ui/react";
import type { ReactNode } from "react";

export type TextProps = {
  value: string;
  onChangeValue: (value: string) => void;
  label?: ReactNode | undefined;
  supporting?: ReactNode | undefined;
  placeholder?: string | undefined;
};

export function TextInput({
  value,
  onChangeValue,
  label,
  supporting,
  placeholder,
}: TextProps) {
  return (
    <Field.Root
      className={css({
        fontSize: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        width: "fit-content",
        color: "content",
      })}
    >
      {label && (
        <Field.Label
          className={css({ textStyle: "bodySmall", color: "content.muted" })}
        >
          {label}
        </Field.Label>
      )}
      <Field.Input
        value={value}
        onChange={(event) => onChangeValue(event.target.value)}
        placeholder={placeholder}
        className={css({
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
