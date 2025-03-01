import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { NotificationPopup } from '../components/notification-popup';

type NotificationType = {
    variant: "success" | "error";
    message: string;
} | null;

type NotificationContextType = {
    showNotification: (notification: NonNullable<NotificationType>) => void;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
    const [notification, setNotification] = useState<NotificationType>(null);

    const showNotification = (newNotification: NonNullable<NotificationType>) => {
        setNotification(newNotification);
    };

    return (
        <NotificationContext.Provider value={{ showNotification }}>
            {children}
            {notification && (
                <NotificationPopup
                    variant={notification.variant}
                    message={notification.message}
                    onClose={() => setNotification(null)}
                />
            )}
        </NotificationContext.Provider>
    );
}

export function useNotification() {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
} 