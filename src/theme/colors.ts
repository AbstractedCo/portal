export const colors = {
  primary: { value: "color-mix(in srgb, #f7d365, #ea4683)" },
  onPrimary: { value: "#000000" },
  surface: { value: "#16171b" },
  surfaceContainer: { value: "#1e1f23" },
  onSurface: { value: "#ffffff" },
  outline: { value: "#989898" },
  outlineVariant: { value: "#88889333" },
  success: { value: "#4ade80" },
  error: { value: "#f87171" },
  container: {
    value: "var(--container-color, var(--colors-surface-container))",
  },
  content: {
    DEFAULT: { value: "var(--content-color, var(--colors-on-surface))" },
    muted: {
      value:
        "color-mix(in srgb, var(--content-color, var(--colors-on-surface)), transparent 25%)",
    },
  },
};
