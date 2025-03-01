import { css } from "../../styled-system/css";
import { Copy, X } from "lucide-react";
import { useEffect, useState, useCallback } from "react";

type NotificationVariant = "success" | "error";

type NotificationPopupProps = {
    variant: NotificationVariant;
    message: string;
    onClose: () => void;
};

export function NotificationPopup({ variant, message, onClose }: NotificationPopupProps) {
    const [timeoutId, setTimeoutId] = useState<number | null>(null);

    const startCloseTimer = useCallback(() => {
        // Clear any existing timeout
        if (timeoutId) {
            window.clearTimeout(timeoutId);
        }

        // Set new timeout
        const newTimeoutId = window.setTimeout(() => {
            onClose();
        }, 5000);

        setTimeoutId(newTimeoutId);
    }, [onClose, timeoutId]);

    useEffect(() => {
        // Start initial timer
        startCloseTimer();

        // Cleanup on unmount
        return () => {
            if (timeoutId) {
                window.clearTimeout(timeoutId);
            }
        };
    }, []); // Empty dependency array for initial setup only

    const handleMouseEnter = () => {
        if (timeoutId) {
            window.clearTimeout(timeoutId);
            setTimeoutId(null);
        }
    };

    const handleMouseLeave = () => {
        startCloseTimer();
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(message);
            // Optionally, you could show a brief "Copied!" message here
        } catch (err) {
            console.error('Failed to copy text:', err);
        }
    };

    return (
        <div
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={css({
                position: "fixed",
                top: "1rem",
                right: "1rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.75rem 1rem",
                borderRadius: "0.5rem",
                backgroundColor: variant === "success" ? "rgb(34, 197, 94)" : "rgb(239, 68, 68)",
                color: "black",
                fontSize: "0.875rem",
                fontWeight: "500",
                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                zIndex: 9999999,
                transition: "opacity 150ms ease-in-out",
                animation: "slideIn 0.3s ease-out",
                pointerEvents: "auto",
            })}
        >
            <button
                onClick={handleCopy}
                className={css({
                    padding: "0.25rem",
                    cursor: "pointer",
                    "&:hover": {
                        opacity: 0.8,
                    },
                })}
                title="Copy to clipboard"
            >
                <Copy size={16} />
            </button>
            <span>{message}</span>
            <button
                onClick={() => {
                    if (timeoutId) {
                        window.clearTimeout(timeoutId);
                    }
                    onClose();
                }}
                className={css({
                    padding: "0.25rem",
                    cursor: "pointer",
                    "&:hover": {
                        opacity: 0.8,
                    },
                })}
                title="Close notification"
            >
                <X size={16} />
            </button>
        </div>
    );
}