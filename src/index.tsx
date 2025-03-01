import { CircularProgressIndicator } from "./components/circular-progress-indicator";
import "./index.css";
import { routeTree } from "./routeTree.gen";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { NotificationProvider } from "./contexts/notification-context";

const router = createRouter({
  routeTree,
  defaultPendingComponent: () => <CircularProgressIndicator />,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <NotificationProvider>
      <RouterProvider router={router} />
    </NotificationProvider>
  </StrictMode>,
);
