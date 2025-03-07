import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/staking")({
  component: StakingPage,
  beforeLoad: () => ({ title: "Staking" }),
});

function StakingPage() {
  useEffect(() => {
    window.location.href = "https://portal.invarch.network/staking";
  }, []);

  return null;
}

/* Original implementation commented out:
import { css } from "../../styled-system/css";
import { RegisteredDaos } from "../features/staking/components/registered-daos";
import { StakingStatistics } from "../features/staking/components/staking-statistics";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/staking")({
  component: StakingPage,
  beforeLoad: () => ({ title: "Staking" }),
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
*/
