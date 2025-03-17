import { css } from "../../styled-system/css";
import { Copy, X } from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

type NotificationVariant = "success" | "error";

type NotificationPopupProps = {
  variant: NotificationVariant;
  message: string;
  onClose: () => void;
  style?: CSSProperties;
};

export function NotificationPopup({
  variant,
  message,
  onClose,
  style,
}: NotificationPopupProps) {
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (isHovered) {
      return; // Don't set up timer if hovered
    }

    const timeoutId = window.setTimeout(() => {
      onClose();
    }, 5000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isHovered, onClose]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
    } catch (err) {
      console.error("Failed to copy text:", err);
    }
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={css({
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0.75rem 1rem",
        borderRadius: "0.5rem",
        backgroundColor:
          variant === "success" ? "rgb(34, 197, 94)" : "rgb(239, 68, 68)",
        color: "black",
        fontSize: "0.875rem",
        fontWeight: "500",
        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
        transition: "all 150ms ease-in-out",
        animation: "slideIn 0.3s ease-out",
        width: "fit-content",
        pointerEvents: "auto",
        position: "relative",
        zIndex: 1,
      })}
      style={style}
    >
      <button
        onClick={handleCopy}
        className={css({
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0.25rem",
          cursor: "pointer",
          background: "none",
          border: "none",
          color: "inherit",
          borderRadius: "0.25rem",
          "&:hover": {
            backgroundColor: "rgba(0, 0, 0, 0.1)",
          },
        })}
        title="Copy to clipboard"
      >
        <Copy size={16} />
      </button>
      <span>{message}</span>
      <button
        onClick={onClose}
        className={css({
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0.25rem",
          cursor: "pointer",
          background: "none",
          border: "none",
          color: "inherit",
          borderRadius: "0.25rem",
          "&:hover": {
            backgroundColor: "rgba(0, 0, 0, 0.1)",
          },
        })}
        title="Close notification"
      >
        <X size={16} />
      </button>
    </div>
  );
}
