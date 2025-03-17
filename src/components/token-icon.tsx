import { css } from "../../styled-system/css";

interface TokenIconProps {
  symbol: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const getTokenIcon = (symbol: string) => {
  const normalizedSymbol = symbol.toUpperCase();

  switch (normalizedSymbol) {
    case "DOT":
      return "/polkadot-new-dot-logo.svg";
    case "USDT":
      return "/tether-usdt-logo.svg";
    case "USDC":
      return "/usd-coin-usdc-logo.svg";
    case "VARCH":
      return "/invarch-logo.svg";
    case "WUD":
      return "/wud-logo.png";
    default:
      return null;
  }
};

const sizeMap = {
  sm: "1.25rem",
  md: "1.5rem",
  lg: "2rem",
};

export function TokenIcon({ symbol, size = "md", className }: TokenIconProps) {
  const iconSrc = getTokenIcon(symbol);

  if (!iconSrc) return null;

  return (
    <img
      src={iconSrc}
      alt={`${symbol} icon`}
      className={css({
        width: sizeMap[size],
        height: sizeMap[size],
        objectFit: "contain",
        ...(className ? { className } : {}),
      })}
    />
  );
}
