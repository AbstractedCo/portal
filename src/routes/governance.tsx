import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/governance")({
  component: () => <div>Hello /governance!</div>,
  beforeLoad: () => ({ title: "Governance" }),
});
