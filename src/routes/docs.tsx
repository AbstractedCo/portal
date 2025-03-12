import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/docs")({
  component: DocsPage,
  beforeLoad: () => ({ title: "Docs" }),
});

function DocsPage() {
  useEffect(() => {
    window.location.href = "https://docs.invarch.network/creating-daos";
  }, []);

  return null;
}