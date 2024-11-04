import { css } from "../../styled-system/css";
import { Progress } from "@ark-ui/react/progress";

export type CircularProgressIndicatorProps = {
  size?: string | number;
};

export function CircularProgressIndicator({
  size = "1.5rem",
}: CircularProgressIndicatorProps) {
  return (
    <Progress.Root
      value={null}
      className={css({
        alignItems: "center",
        colorPalette: "accent",
        display: "flex",
        flexDirection: "column",
        gap: "1.5",
        width: "full",
      })}
    >
      <Progress.Circle
        style={{
          "--size": size,
        }}
        className={css({
          "--thickness": "0.2em",
          "&[data-state='indeterminate']": {
            animation: "spin 0.5s linear infinite",
          },
        })}
      >
        <Progress.CircleTrack className={css({ stroke: "container" })} />
        <Progress.CircleRange
          className={css({
            stroke: "content",
            transitionProperty: "stroke-dasharray, stroke",
            transitionDuration: "0.6s",
            "&[data-state='indeterminate']": {
              strokeDasharray: "calc(var(--circumference) * 1.5)",
            },
          })}
        />
      </Progress.Circle>
    </Progress.Root>
  );
}
