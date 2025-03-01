import { colors } from "./src/theme/colors.js";
import { textStyles } from "./src/theme/typography.js";
import { defineConfig } from "@pandacss/dev";

export default defineConfig({
  preflight: true,
  eject: true,
  utilities: {
    color: {
      values: "colors",
    },
    backgroundColor: {
      values: "colors",
    },
    stroke: {
      values: "colors",
    },
  },
  theme: {
    textStyles,
    tokens: {
      colors,
    },
    keyframes: {
      spin: {
        to: {
          transform: "rotate(360deg)",
        },
      },
      slideIn: {
        from: {
          transform: "translateX(100%)",
          opacity: 0,
        },
        to: {
          transform: "translateX(0)",
          opacity: 1,
        },
      },
    },
  },
  include: ["./src/**/*.{js,jsx,ts,tsx}"],
  outdir: "styled-system",
});
