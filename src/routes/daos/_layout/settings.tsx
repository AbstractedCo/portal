import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/daos/_layout/settings")({
  component: () => <div>Hello /profile/_layout/settings!</div>,
});
