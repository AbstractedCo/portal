import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/daos/_layout/assets")({
  component: () => <div>Hello /profile/_layout/assets!</div>,
});
