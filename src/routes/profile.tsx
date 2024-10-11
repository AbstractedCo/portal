import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
  beforeLoad: () => ({ title: "Profile" }),
});

function ProfilePage() {
  return null;
}
