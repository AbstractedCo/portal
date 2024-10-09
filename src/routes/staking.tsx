import { css } from "../../styled-system/css";
import { RegisteredDaos } from "../features/staking/components/registered-daos";
import { StakingStatistics } from "../features/staking/components/staking-statistics";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/staking")({
  component: StakingPage,
});

function StakingPage() {
  return (
    <div
      className={css({ display: "flex", flexDirection: "column", gap: "3rem" })}
    >
      <StakingStatistics />
      <RegisteredDaos />
    </div>
  );
}
