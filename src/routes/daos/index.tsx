import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/daos/")({
  loader: () => redirect({ to: "/daos/assets" }),
  beforeLoad: () => ({ title: "Daos" }),
});
