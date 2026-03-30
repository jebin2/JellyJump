import { loadFont } from "@remotion/google-fonts/SpaceGrotesk";
import { loadFont as loadBodyFont } from "@remotion/google-fonts/SpaceMono";

const { fontFamily: headingFont } = loadFont();
const { fontFamily: bodyFont } = loadBodyFont();

export const COLORS = {
  primary: "#00ff88",      // Neon Green
  secondary: "#b0b0b0",    // Silver
  background: "#0a0a0a",   // Near Black
  foreground: "#ffffff",   // White
  dark: "#050505",
  accent: "#00ff88",       // Same as primary
  muted: "#2a2a2a",
};

export const FONTS = {
  heading: headingFont,
  body: bodyFont,
};

export const ASSETS = {
  logo: "/assets/images/transparent/jelly_jump_logo.png", 
};