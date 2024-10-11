import { RegisteredDaos } from "../../../features/staking/components/registered-daos";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/daos/_layout/members")({
  component: MembersPage,
  beforeLoad: () => ({ title: "Members" }),
});

function MembersPage() {
  return <RegisteredDaos />;
}
