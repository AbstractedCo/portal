import { RegisteredDaos } from "../widgets/registered-daos";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/staking")({
  component: StakingPage,
});

function StakingPage() {
  return <RegisteredDaos />;
}
