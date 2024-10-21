import { css } from "../../styled-system/css";
import { Accordion as BaseAccordion } from "@ark-ui/react";
import { ChevronDownIcon } from "lucide-react";
import type { PropsWithChildren, ReactNode } from "react";

export const Accordion = Object.assign(_Accordion, { Item: AccordionItem });

export function _Accordion({ children }: PropsWithChildren) {
  return (
    <BaseAccordion.Root collapsible multiple>
      {children}
    </BaseAccordion.Root>
  );
}

type AccordionItemProps = PropsWithChildren<{
  value: string;
  summary: ReactNode;
}>;

function AccordionItem({ value, summary, children }: AccordionItemProps) {
  return (
    <BaseAccordion.Item
      key={value}
      value={value}
      className={css({
        padding: "1.8rem 3rem",
        "&:not(:last-of-type)": {
          borderBottom: "1px solid {colors.outlineVariant}",
        },
      })}
    >
      <BaseAccordion.ItemTrigger
        className={css({
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "0.5rem",
          width: "stretch",
          cursor: "pointer",
        })}
      >
        {summary}
        <BaseAccordion.ItemIndicator
          className={css({
            transition: "0.25s",
            "&[data-state='open']": {
              rotate: "180deg",
            },
          })}
        >
          <ChevronDownIcon />
        </BaseAccordion.ItemIndicator>
      </BaseAccordion.ItemTrigger>
      <BaseAccordion.ItemContent className={css({ marginTop: "2rem" })}>
        {children}
      </BaseAccordion.ItemContent>
    </BaseAccordion.Item>
  );
}
