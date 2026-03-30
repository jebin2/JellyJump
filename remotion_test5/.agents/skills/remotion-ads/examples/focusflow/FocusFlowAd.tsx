/**
 * FocusFlow Ad - Example Remotion Composition
 *
 * This is an example implementation showing how to structure
 * an Instagram Reel ad using the remotion-ads skill patterns.
 *
 * To use this example:
 * 1. Copy this file to your remotion/compositions/ folder
 * 2. Register in remotion/Root.tsx
 * 3. Add your assets to public/assets/
 * 4. Generate voiceover using tools/generate.js
 * 5. Run: npx remotion studio
 */

import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  Series,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// ============================================
// BRAND CONFIGURATION
// Copy these values from your design-system.md
// ============================================

const COLORS = {
  primary: "#6366F1",      // Indigo
  primaryLight: "#818CF8",
  secondary: "#818CF8",
  accent: "#22C55E",       // Green for success
  background: "#0F172A",   // Dark slate
  backgroundDark: "#020617",
  foreground: "#F8FAFC",   // Off-white text
  muted: "#94A3B8",        // Muted text
};

// Spring configurations from presets/pacing.json (medium)
const SPRING_CONFIG = { damping: 15, stiffness: 100, mass: 1 };

// Scene durations (from scenes.json or voiceover info.json)
const SCENE_DURATIONS = {
  scene1: 3.0,  // Hook
  scene2: 4.0,  // Problem
  scene3: 4.5,  // Solution
  scene4: 3.5,  // CTA
};

// ============================================
// SAFE ZONE CONSTANTS
// From presets/formats.json (instagram-reel)
// ============================================

const SAFE_ZONE = {
  top: 285,
  bottom: 400,
  left: 80,
  right: 120,
};

// ============================================
// REUSABLE COMPONENTS
// ============================================

// Safe content wrapper
const SafeArea: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      position: "absolute",
      top: SAFE_ZONE.top,
      left: SAFE_ZONE.left,
      right: SAFE_ZONE.right,
      bottom: SAFE_ZONE.bottom,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    {children}
  </div>
);

// Animated text with fade + slide
const AnimatedText: React.FC<{
  children: React.ReactNode;
  delay?: number;
  style?: React.CSSProperties;
}> = ({ children, delay = 0, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - delay * fps,
    fps,
    config: SPRING_CONFIG,
  });

  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const translateY = interpolate(progress, [0, 1], [30, 0]);

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// Highlighted text span
const Highlight: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ color: COLORS.accent, fontWeight: 700 }}>{children}</span>
);

// Icon with pop animation
const AnimatedIcon: React.FC<{
  src: string;
  size?: number;
  delay?: number;
}> = ({ src, size = 180, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame: frame - delay * fps,
    fps,
    config: { damping: 8, stiffness: 200 },
  });

  return (
    <Img
      src={staticFile(src)}
      style={{
        width: size,
        height: size,
        transform: `scale(${scale})`,
      }}
    />
  );
};

// Gradient background
const GradientBackground: React.FC<{
  colors: string[];
  direction?: string;
}> = ({ colors, direction = "180deg" }) => (
  <AbsoluteFill
    style={{
      background: `linear-gradient(${direction}, ${colors.join(", ")})`,
    }}
  />
);

// ============================================
// SCENE COMPONENTS
// ============================================

// Scene 1: Hook
const Scene1Hook: React.FC = () => {
  return (
    <AbsoluteFill>
      <GradientBackground colors={[COLORS.backgroundDark, COLORS.background]} />

      <SafeArea>
        {/* Icon */}
        <AnimatedIcon
          src="assets/images/icons/brain-scattered.png"
          size={180}
          delay={0}
        />

        {/* Headline */}
        <AnimatedText delay={0.2} style={{ marginTop: 40 }}>
          <h1
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: COLORS.foreground,
              textAlign: "center",
              margin: 0,
              textShadow: "0 4px 20px rgba(0,0,0,0.5)",
            }}
          >
            Can't <Highlight>FOCUS</Highlight>?
          </h1>
        </AnimatedText>

        {/* Subtitle */}
        <AnimatedText delay={0.4} style={{ marginTop: 20 }}>
          <p
            style={{
              fontSize: 44,
              fontWeight: 400,
              color: COLORS.muted,
              textAlign: "center",
              margin: 0,
            }}
          >
            You're not alone.
          </p>
        </AnimatedText>
      </SafeArea>
    </AbsoluteFill>
  );
};

// Scene 2: Problem
const Scene2Problem: React.FC = () => {
  const problems = [
    { icon: "bell.png", text: "Endless notifications" },
    { icon: "phone.png", text: "Social media addiction" },
    { icon: "clock.png", text: "Hours lost to scrolling" },
  ];

  return (
    <AbsoluteFill>
      <GradientBackground colors={[COLORS.background, "#1E1B4B"]} />

      <SafeArea>
        <AnimatedText delay={0}>
          <h2
            style={{
              fontSize: 52,
              fontWeight: 600,
              color: COLORS.muted,
              textAlign: "center",
              margin: 0,
              marginBottom: 60,
              textTransform: "uppercase",
              letterSpacing: 4,
            }}
          >
            The Problem
          </h2>
        </AnimatedText>

        {problems.map((problem, index) => (
          <AnimatedText
            key={problem.text}
            delay={0.3 + index * 0.25}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 24,
              marginBottom: 32,
            }}
          >
            <Img
              src={staticFile(`assets/images/icons/${problem.icon}`)}
              style={{ width: 64, height: 64 }}
            />
            <span
              style={{
                fontSize: 48,
                fontWeight: 500,
                color: COLORS.foreground,
              }}
            >
              {problem.text}
            </span>
          </AnimatedText>
        ))}
      </SafeArea>
    </AbsoluteFill>
  );
};

// Scene 3: Solution
const Scene3Solution: React.FC = () => {
  return (
    <AbsoluteFill>
      <GradientBackground
        colors={[COLORS.primary, COLORS.primaryLight]}
        direction="135deg"
      />

      <SafeArea>
        {/* Icon */}
        <AnimatedIcon
          src="assets/images/icons/focus-target.png"
          size={160}
          delay={0}
        />

        {/* Headline */}
        <AnimatedText delay={0.2} style={{ marginTop: 40 }}>
          <h1
            style={{
              fontSize: 64,
              fontWeight: 700,
              color: COLORS.foreground,
              textAlign: "center",
              margin: 0,
            }}
          >
            Meet <Highlight>FocusFlow</Highlight>
          </h1>
        </AnimatedText>

        {/* Tagline */}
        <AnimatedText delay={0.4} style={{ marginTop: 16 }}>
          <p
            style={{
              fontSize: 44,
              fontWeight: 400,
              color: "rgba(255,255,255,0.9)",
              textAlign: "center",
              margin: 0,
            }}
          >
            Deep work, made simple.
          </p>
        </AnimatedText>

        {/* Features */}
        <AnimatedText delay={0.6} style={{ marginTop: 50 }}>
          <div
            style={{
              display: "flex",
              gap: 40,
              justifyContent: "center",
            }}
          >
            {["Block distractions", "Smart timers", "Focus analytics"].map(
              (feature) => (
                <div
                  key={feature}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <span style={{ color: COLORS.accent, fontSize: 32 }}>✓</span>
                  <span
                    style={{
                      fontSize: 32,
                      color: COLORS.foreground,
                      fontWeight: 500,
                    }}
                  >
                    {feature}
                  </span>
                </div>
              )
            )}
          </div>
        </AnimatedText>
      </SafeArea>
    </AbsoluteFill>
  );
};

// Scene 4: CTA
const Scene4CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Pulsing button animation
  const pulse = Math.sin(frame / fps * Math.PI * 2) * 0.03 + 1;

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ backgroundColor: COLORS.foreground }} />

      <SafeArea>
        {/* Logo */}
        <AnimatedText delay={0}>
          <Img
            src={staticFile("assets/images/transparent/focusflow-logo-dark.png")}
            style={{ height: 80, marginBottom: 40 }}
          />
        </AnimatedText>

        {/* Trust Badge */}
        <AnimatedText delay={0.2}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 30,
            }}
          >
            <span style={{ fontSize: 36, color: "#FBBF24" }}>★</span>
            <span
              style={{
                fontSize: 36,
                fontWeight: 600,
                color: COLORS.background,
              }}
            >
              4.8
            </span>
            <span style={{ fontSize: 28, color: COLORS.muted }}>
              (2,500+ reviews)
            </span>
          </div>
        </AnimatedText>

        {/* CTA Button */}
        <AnimatedText delay={0.4}>
          <div
            style={{
              backgroundColor: COLORS.primary,
              paddingLeft: 60,
              paddingRight: 60,
              paddingTop: 24,
              paddingBottom: 24,
              borderRadius: 16,
              transform: `scale(${pulse})`,
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            <span
              style={{
                fontSize: 40,
                fontWeight: 600,
                color: COLORS.foreground,
              }}
            >
              Try Free for 7 Days
            </span>
            <span style={{ fontSize: 36 }}>→</span>
          </div>
        </AnimatedText>

        {/* Link in Bio */}
        <AnimatedText delay={0.6} style={{ marginTop: 30 }}>
          <p
            style={{
              fontSize: 32,
              color: COLORS.muted,
              margin: 0,
            }}
          >
            Link in Bio
          </p>
        </AnimatedText>
      </SafeArea>
    </AbsoluteFill>
  );
};

// ============================================
// MAIN COMPOSITION
// ============================================

export const FocusFlowAd: React.FC = () => {
  const { fps } = useVideoConfig();

  // Calculate frames from durations
  const paddingFrames = 3; // Small buffer between scenes
  const scene1Frames = Math.round(SCENE_DURATIONS.scene1 * fps) + paddingFrames;
  const scene2Frames = Math.round(SCENE_DURATIONS.scene2 * fps) + paddingFrames;
  const scene3Frames = Math.round(SCENE_DURATIONS.scene3 * fps) + paddingFrames;
  const scene4Frames = Math.round(SCENE_DURATIONS.scene4 * fps);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      {/* Voiceover Audio */}
      {/* Uncomment after generating with: node tools/generate.js --scenes examples/focusflow/scenes.json */}
      {/* <Audio src={staticFile("audio/focusflow-ad/focusflow-ad-combined.mp3")} /> */}

      {/* Background Music (optional) */}
      {/* <Audio src={staticFile("assets/audio/music/calm-ambient.mp3")} volume={0.15} /> */}

      {/* Scene Sequence */}
      <Series>
        <Series.Sequence durationInFrames={scene1Frames}>
          <Scene1Hook />
        </Series.Sequence>

        <Series.Sequence durationInFrames={scene2Frames}>
          <Scene2Problem />
        </Series.Sequence>

        <Series.Sequence durationInFrames={scene3Frames}>
          <Scene3Solution />
        </Series.Sequence>

        <Series.Sequence durationInFrames={scene4Frames}>
          <Scene4CTA />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};

// ============================================
// COMPOSITION CONFIG
// Add this to your remotion/Root.tsx
// ============================================

/*
import { FocusFlowAd } from "./compositions/FocusFlowAd";

// In your Root component's Composition list:
<Composition
  id="FocusFlowAd"
  component={FocusFlowAd}
  durationInFrames={15 * 30}  // 15 seconds at 30fps
  fps={30}
  width={1080}
  height={1920}
/>
*/

export default FocusFlowAd;
