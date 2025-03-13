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
};

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationType[]>([]);

  const showNotification = (newNotification: Omit<NotificationType, "id">) => {
    const id = Date.now().toString();

    setNotifications((currentNotifications) => {
      // Check if a notification with the same message already exists
      const isDuplicate = currentNotifications.some(
        (notification) => notification.message === newNotification.message,
      );

      if (isDuplicate) {
        return currentNotifications; // Don't add duplicate notifications
      }

      return [{ ...newNotification, id }, ...currentNotifications];
    });
  };

  const removeNotification = (id: string) => {
    setNotifications((currentNotifications) =>
      currentNotifications.filter((notification) => notification.id !== id),
    );
  };

  return (
    <NotificationContext.Provider value={{ showNotification }}>
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
