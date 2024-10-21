import { Progress } from "@ark-ui/react/progress";
import type { ReactNode } from "react";

export type LinearProgressIndicatorProps = {
  label?: ReactNode;
};

export function LinearProgressIndicator({
  label,
}: LinearProgressIndicatorProps) {
  return (
    <Progress.Root value={null}>
      {label && <Progress.Label>{label}</Progress.Label>}
      <Progress.ValueText />
      <Progress.Track>
        <Progress.Range />
      </Progress.Track>
    </Progress.Root>
  );
}
