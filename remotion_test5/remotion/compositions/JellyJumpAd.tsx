import React from "react";
import {
  AbsoluteFill,
  Img,
  Series,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  Easing,
  random,
} from "remotion";
import { COLORS, FONTS } from "../design-system";

// ============================================
// CONSTANTS
// ============================================

const SPRING_CONFIG = { damping: 12, stiffness: 200, mass: 0.5 };

const SCENE_DURATIONS = {
  scene1: 2.0,  // Hook
  scene2: 2.0,  // Feature 1
  scene3: 2.0,  // Feature 2
  scene4: 2.0,  // Privacy
  scene5: 3.5,  // CTA
};

const SAFE_ZONE = {
  top: 250,
  bottom: 350,
  left: 80,
  right: 80,
};

// ============================================
// REUSABLE COMPONENTS
// ============================================

const CyberBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background, overflow: "hidden" }}>
      {/* Grid Effect */}
      <div style={{
        position: "absolute",
        width: "200%",
        height: "200%",
        top: "-50%",
        left: "-50%",
        backgroundImage: `linear-gradient(${COLORS.muted} 1px, transparent 1px), linear-gradient(90deg, ${COLORS.muted} 1px, transparent 1px)`,
        backgroundSize: "60px 60px",
        opacity: 0.1,
        transform: `perspective(500px) rotateX(60deg) translateY(${(frame * 2) % 60}px)`,
      }} />
      
      {/* Moving Neon Lines */}
      {[...Array(5)].map((_, i) => (
        <div key={i} style={{
          position: "absolute",
          top: 0,
          left: `${(i * 25 + frame * 0.5) % 100}%`,
          width: "2px",
          height: "100%",
          background: `linear-gradient(to bottom, transparent, ${COLORS.primary}, transparent)`,
          opacity: 0.3,
        }} />
      ))}
    </AbsoluteFill>
  );
};

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
      width: "auto",
    }}
  >
    {children}
  </div>
);

const KineticText: React.FC<{
  text: string;
  delay?: number;
  color?: string;
  fontSize?: number;
}> = ({ text, delay = 0, color = COLORS.foreground, fontSize = 90 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const words = text.split(" ");

  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "15px" }}>
      {words.map((word, i) => {
        const wordDelay = delay + (i * 0.1);
        const progress = spring({
          frame: frame - wordDelay * fps,
          fps,
          config: SPRING_CONFIG,
        });
        
        const opacity = interpolate(progress, [0, 1], [0, 1]);
        const scale = interpolate(progress, [0, 1], [0.5, 1]);
        const rotate = interpolate(progress, [0, 1], [-10, 0]);

        return (
          <span
            key={i}
            style={{
              fontFamily: FONTS.heading,
              fontSize,
              fontWeight: 900,
              color,
              opacity,
              transform: `scale(${scale}) rotate(${rotate}deg)`,
              display: "inline-block",
              textTransform: "uppercase",
              letterSpacing: "-2px",
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};

const GlitchOverlay: React.FC = () => {
    const frame = useCurrentFrame();
    if (random(frame) < 0.9) return null;
    
    return (
        <AbsoluteFill style={{
            backgroundColor: "rgba(0, 255, 136, 0.1)",
            mixBlendMode: "overlay",
        }} />
  );
};

// ============================================
// SCENES
// ============================================

const Scene1Hook: React.FC = () => {
  return (
    <AbsoluteFill>
      <CyberBackground />
      <GlitchOverlay />
      <SafeArea>
        <Img src={staticFile("assets/images/transparent/jelly_jump_logo.png")} style={{ height: 200, marginBottom: 60 }} />
        <KineticText text="EDIT VIDEOS" />
        <KineticText text="IN BROWSER" color={COLORS.primary} delay={0.3} />
      </SafeArea>
    </AbsoluteFill>
  );
};

const Scene2Trim: React.FC = () => {
    return (
        <AbsoluteFill>
            <CyberBackground />
            <SafeArea>
                <KineticText text="TRIM. CONVERT." />
                <KineticText text="RESIZE. MERGE." color={COLORS.primary} delay={0.2} />
                <div style={{
                    marginTop: 60,
                    fontFamily: FONTS.body,
                    fontSize: 40,
                    color: COLORS.secondary,
                    letterSpacing: 4
                }}>
                    [ BRUTALLY SIMPLE ]
                </div>
            </SafeArea>
        </AbsoluteFill>
    )
}

const Scene3Power: React.FC = () => {
  return (
    <AbsoluteFill>
      <CyberBackground />
      <SafeArea>
        <div style={{
            padding: "40px",
            border: `4px solid ${COLORS.primary}`,
            backgroundColor: "rgba(0, 255, 136, 0.05)"
        }}>
            <KineticText text="POWERED BY" fontSize={50} />
            <KineticText text="MEDIABUNNY" color={COLORS.primary} delay={0.2} />
        </div>
        <p style={{ fontFamily: FONTS.body, fontSize: 30, color: COLORS.secondary, marginTop: 40 }}>
            HARDWARE ACCELERATED
        </p>
      </SafeArea>
    </AbsoluteFill>
  );
};

const Scene4Privacy: React.FC = () => {
  return (
    <AbsoluteFill>
      <CyberBackground />
      <SafeArea>
        <KineticText text="100% PRIVATE" color={COLORS.primary} />
        <KineticText text="NO UPLOADS" delay={0.2} />
        <div style={{
            marginTop: 40,
            fontFamily: FONTS.body,
            fontSize: 32,
            color: COLORS.secondary,
            textAlign: "center"
        }}>
            All processing happens<br/>locally in your browser.
        </div>
      </SafeArea>
    </AbsoluteFill>
  );
};

const Scene5CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const pulse = Math.sin(frame / 6) * 0.04 + 1;

  return (
    <AbsoluteFill>
      <CyberBackground />
      <SafeArea>
        <Img src={staticFile("assets/images/transparent/jelly_jump_logo.png")} style={{ height: 120, marginBottom: 40 }} />
        <KineticText text="JELLYJUMP" fontSize={60} />
        <KineticText text="PLAYER" color={COLORS.primary} fontSize={60} delay={0.1} />
        
        <div
          style={{
            marginTop: 60,
            backgroundColor: COLORS.primary,
            padding: "25px 60px",
            borderRadius: 10,
            transform: `scale(${pulse})`,
            boxShadow: `0 0 30px ${COLORS.primary}66`
          }}
        >
          <span style={{
            fontFamily: FONTS.heading,
            fontSize: 40,
            fontWeight: 900,
            color: COLORS.background,
            letterSpacing: 2
          }}>
            LAUNCH PLAYER
          </span>
        </div>
        
        <p style={{ fontFamily: FONTS.body, fontSize: 28, color: COLORS.secondary, marginTop: 40 }}>
            voidall.com/JellyJump
        </p>
      </SafeArea>
    </AbsoluteFill>
  );
};

// ============================================
// MAIN COMPOSITION
// ============================================

export const JellyJumpAd: React.FC = () => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill>
      <Series>
        <Series.Sequence durationInFrames={Math.round(SCENE_DURATIONS.scene1 * fps)}>
          <Scene1Hook />
        </Series.Sequence>
        <Series.Sequence durationInFrames={Math.round(SCENE_DURATIONS.scene2 * fps)}>
          <Scene2Trim />
        </Series.Sequence>
        <Series.Sequence durationInFrames={Math.round(SCENE_DURATIONS.scene3 * fps)}>
          <Scene3Power />
        </Series.Sequence>
        <Series.Sequence durationInFrames={Math.round(SCENE_DURATIONS.scene4 * fps)}>
          <Scene4Privacy />
        </Series.Sequence>
        <Series.Sequence durationInFrames={Math.round(SCENE_DURATIONS.scene5 * fps)}>
          <Scene5CTA />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
