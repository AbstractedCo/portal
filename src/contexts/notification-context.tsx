import { css } from "../../styled-system/css";
import { NotificationPopup } from "../components/notification-popup";
import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

type NotificationType = {
  id: string;
  variant: "success" | "error";
  message: string;
};

type NotificationContextType = {
  showNotification: (notification: Omit<NotificationType, "id">) => void;
  removeNotification: (id: string) => void;
};

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationType[]>([]);

  const showNotification = (newNotification: Omit<NotificationType, "id">) => {
    const now = Date.now();

    // Check for exact duplicate content
    const hasDuplicate = notifications.some(
      (n) =>
        n.message === newNotification.message &&
        n.variant === newNotification.variant,
    );
    if (hasDuplicate) {
      return;
    }

    const id = now.toString();

    setNotifications((currentNotifications) => {
      // Remove any existing notifications with the same variant
      const filteredNotifications = currentNotifications.filter(
        (n) => n.variant !== newNotification.variant,
      );
      return [{ ...newNotification, id }, ...filteredNotifications];
    });
  };

  const removeNotification = (id: string) => {
    setNotifications((currentNotifications) =>
      currentNotifications.filter((notification) => notification.id !== id),
    );
  };

  return (
    <NotificationContext.Provider
      value={{ showNotification, removeNotification }}
    >
      {children}
      <div
        className={css({
          position: "fixed",
          top: "1rem",
          right: "1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          zIndex: 2147483647,
          pointerEvents: "none",
        })}
      >
        {notifications.map((notification, _index) => (
          <NotificationPopup
            key={notification.id}
            variant={notification.variant}
            message={notification.message}
            onClose={() => removeNotification(notification.id)}
            style={{
              position: "relative",
              top: 0,
              right: 0,
              pointerEvents: "auto",
            }}
          />
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error(
      "useNotification must be used within a NotificationProvider",
    );
  }
  return context;
}
