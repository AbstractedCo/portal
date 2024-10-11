import { css, cx } from "../../styled-system/css";
import { createListCollection } from "@ark-ui/react";
import { Select as BaseSelect, Portal } from "@ark-ui/react";
import type { ReactNode } from "@tanstack/react-router";
import { ChevronDownIcon } from "lucide-react";

type Option<T> = { label: string; value: T; icon?: ReactNode | undefined };

export type SelectProps<
  TValue extends string | number,
  TOption extends Option<TValue>,
> = {
  value: TValue | undefined;
  onChangeValue: (value: TValue) => void;
  options: TOption[] | readonly TOption[];
  label?: string;
  placeholder?: string;
  className?: string;
};

export function Select<
  TValue extends string | number,
  TOption extends Option<TValue>,
>({
  value,
  onChangeValue,
  options,
  label,
  placeholder,
  className,
}: SelectProps<TValue, TOption>) {
  const collection = createListCollection({
    items: options.map(({ icon, ...option }) => option),
    itemToValue: (option) => String(option.value),
    itemToString: (option) => option.label,
  });

  return (
    <BaseSelect.Root
      collection={collection}
      value={value === undefined ? [] : [String(value)]}
      onValueChange={(event) => {
        const value = event.value.at(0);
        const selectedValue = collection.items.find(
          (item) => String(item.value) === value,
        );

        if (selectedValue !== undefined) {
          onChangeValue(selectedValue.value);
        }
      }}
      className={css({ display: "contents" })}
    >
      <div
        className={cx(
          css({
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            width: "fit-content",
            overflow: "hidden",
          }),
          className,
        )}
      >
        {label && (
          <BaseSelect.Label
            className={css({ textStyle: "bodySmall", color: "content.muted" })}
          >
            {label}
          </BaseSelect.Label>
        )}
        <BaseSelect.Control>
          <BaseSelect.Trigger
            className={css({
              fontSize: "1rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "1em",
              width: "stretch",
              border: "1px solid {colors.outlineVariant}",
              borderRadius: "0.3rem",
              backgroundColor: "container",
              padding: "0.75em",
              color: "onSurface",
              cursor: "pointer",
            })}
          >
            <BaseSelect.Context>
              {({ value }) =>
                options.find((option) => value.includes(String(option.value)))
                  ?.icon
              }
            </BaseSelect.Context>
            <BaseSelect.ValueText
              placeholder={placeholder ?? ""}
              className={css({
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              })}
            />
            <BaseSelect.Indicator>
              <BaseSelect.Context>
                {({ open }) => (
                  <ChevronDownIcon
                    className={css({ transition: "0.25s" })}
                    style={{ rotate: open ? "180deg" : undefined }}
                  />
                )}
              </BaseSelect.Context>
            </BaseSelect.Indicator>
          </BaseSelect.Trigger>
        </BaseSelect.Control>
      </div>
      <Portal>
        <BaseSelect.Positioner>
          <BaseSelect.Content
            className={css({
              maxHeight: "var(--available-height)",
              overflow: "auto",

              border: "1px solid {colors.outlineVariant}",
              borderRadius: "0.3rem",
              backgroundColor: "container",
              color: "onSurface",

              transition: "0.25s allow-discrete",

              opacity: 0,
              translate: "0 -2rem",

              "&[data-state='open']": {
                opacity: 1,
                translate: "0 0",
                "@starting-style": {
                  opacity: 0,
                  translate: "0 -2rem",
                },
              },
            })}
          >
            {options.map((option) => (
              <BaseSelect.Item
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.875em 1.5em",
                  cursor: "pointer",
                  "&:hover": {
                    backdropFilter: "invert(25%)",
                  },
                })}
                key={option.value}
                item={option}
              >
                {option.icon}
                <BaseSelect.ItemText>{option.label}</BaseSelect.ItemText>
                <BaseSelect.ItemIndicator>✓</BaseSelect.ItemIndicator>
              </BaseSelect.Item>
            ))}
          </BaseSelect.Content>
        </BaseSelect.Positioner>
      </Portal>
      <BaseSelect.HiddenSelect />
    </BaseSelect.Root>
  );
}
