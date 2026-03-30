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
  Sequence,
} from "remotion";
import { COLORS, FONTS } from "../design-system";

// ============================================
// ASSETS
// ============================================
const LOGO = "assets/images/transparent/jelly_jump_logo.png";
const BUNNY = "assets/images/photos/mediabunny.svg";

// ============================================
// COMPONENTS
// ============================================

const FeatureCard: React.FC<{ 
    label: string; 
    children: React.ReactNode;
    color: string;
}> = ({ label, children, color }) => {
    return (
        <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
            <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", bottom: 200 }}>
                {children}
            </AbsoluteFill>
            <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 150 }}>
                <h1 style={{
                    fontFamily: FONTS.heading,
                    fontSize: 80,
                    color: color,
                    textTransform: "uppercase",
                    margin: 0
                }}>
                    {label}
                </h1>
            </AbsoluteFill>
        </AbsoluteFill>
    );
};

// ============================================
// SCENES
// ============================================

const Scene1Intro: React.FC = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    
    const scale = spring({ frame, fps, config: { damping: 10, stiffness: 200 } });

    return (
        <AbsoluteFill style={{ backgroundColor: COLORS.primary, justifyContent: "center", alignItems: "center" }}>
            <Img 
                src={staticFile(LOGO)} 
                style={{ 
                    width: 400,
                    transform: `scale(${scale})`
                }} 
            />
            <h1 style={{
                fontFamily: FONTS.heading,
                fontSize: 100,
                color: COLORS.background,
                marginTop: 50,
                opacity: interpolate(frame, [0, 10], [0, 1])
            }}>
                JELLYJUMP
            </h1>
        </AbsoluteFill>
    );
};

const Scene2Trim: React.FC = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const progress = spring({ frame, fps, config: { damping: 15, stiffness: 150 } });
    const split = interpolate(progress, [0, 1], [0, 100]);
    
    return (
        <FeatureCard label="TRIM" color={COLORS.primary}>
            <div style={{ position: "relative", width: 800, height: 150 }}>
                {/* Left Block */}
                <div style={{
                    position: "absolute",
                    left: 0,
                    width: 380, // 800/2 - gap
                    height: "100%",
                    backgroundColor: "#333",
                    borderRadius: 20,
                    transform: `translateX(-${split}px)`
                }} />
                
                {/* Right Block (The one kept) */}
                <div style={{
                    position: "absolute",
                    right: 0,
                    width: 380,
                    height: "100%",
                    backgroundColor: COLORS.foreground,
                    borderRadius: 20,
                    transform: `translateX(${split}px)`
                }} />
                
                {/* Scissor / Cut Line */}
                <div style={{
                    position: "absolute",
                    left: "50%",
                    top: -50,
                    height: 250,
                    width: 6,
                    backgroundColor: COLORS.primary,
                    transform: `translateX(-50%) scaleY(${1 - progress})`
                }} />
            </div>
        </FeatureCard>
    );
};

const Scene3Crop: React.FC = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    
    const zoom = spring({ frame, fps, config: { damping: 15 } });
    const scale = interpolate(zoom, [0, 1], [1, 1.5]);

    return (
        <FeatureCard label="CROP" color={COLORS.foreground}>
             <div style={{ 
                 width: 600, 
                 height: 400, 
                 border: `10px solid ${COLORS.primary}`,
                 position: "relative",
                 overflow: "hidden",
                 borderRadius: 20
             }}>
                 {/* Image simulated by grid */}
                 <div style={{
                     width: "100%",
                     height: "100%",
                     backgroundImage: `radial-gradient(circle, #333 2px, transparent 2px)`,
                     backgroundSize: "40px 40px",
                     transform: `scale(${scale})`,
                     transformOrigin: "center center"
                 }} />
                 
                 {/* Corner Markers */}
                 <div style={{ position: "absolute", top: 20, left: 20, width: 40, height: 40, borderTop: "6px solid white", borderLeft: "6px solid white" }} />
                 <div style={{ position: "absolute", bottom: 20, right: 20, width: 40, height: 40, borderBottom: "6px solid white", borderRight: "6px solid white" }} />
             </div>
        </FeatureCard>
    );
};

const Scene4Convert: React.FC = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const progress = spring({ frame, fps, config: { damping: 12 } });
    
    const radius = interpolate(progress, [0, 1], [0, 50]);
    const rotation = interpolate(progress, [0, 1], [0, 90]);
    const color = interpolate(progress, [0, 1], [0, 1]); // Mix colors manually or use just switching

    return (
        <FeatureCard label="CONVERT" color={COLORS.secondary}>
             <div style={{
                 width: 400,
                 height: 400,
                 backgroundColor: frame > 10 ? COLORS.primary : COLORS.foreground,
                 borderRadius: `${radius}%`,
                 transform: `rotate(${rotation}deg)`,
                 display: "flex",
                 justifyContent: "center",
                 alignItems: "center"
             }}>
                 <h2 style={{
                     fontFamily: FONTS.body,
                     fontSize: 60,
                     color: COLORS.background,
                     fontWeight: "bold"
                 }}>
                     {frame < 15 ? ".MOV" : ".MP4"}
                 </h2>
             </div>
        </FeatureCard>
    );
};

const Scene5Privacy: React.FC = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    
    const lock = spring({ frame, fps, config: { damping: 10, stiffness: 200 } });

    return (
        <AbsoluteFill style={{ backgroundColor: COLORS.dark }}>
             <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
                 <div style={{
                     width: 400,
                     height: 400,
                     border: `20px solid ${COLORS.primary}`,
                     borderRadius: "50%",
                     display: "flex",
                     justifyContent: "center",
                     alignItems: "center",
                     transform: `scale(${lock})`
                 }}>
                     <span style={{ fontSize: 200 }}>🔒</span>
                 </div>
                 <h1 style={{
                     fontFamily: FONTS.heading,
                     fontSize: 80,
                     color: COLORS.primary,
                     marginTop: 60
                 }}>
                     100% PRIVATE
                 </h1>
             </AbsoluteFill>
        </AbsoluteFill>
    );
};

const Scene6CTA: React.FC = () => {
    const frame = useCurrentFrame();
    const pulse = Math.sin(frame / 4) * 0.05 + 1;

    return (
        <AbsoluteFill style={{ backgroundColor: COLORS.background, justifyContent: "center", alignItems: "center" }}>
             <Img src={staticFile(LOGO)} style={{ width: 300, marginBottom: 50 }} />
             
             <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 60 }}>
                 {["TRIM", "CROP", "CONVERT", "RECORD"].map((text, i) => (
                     <div key={text} style={{
                         fontFamily: FONTS.body,
                         fontSize: 40,
                         color: COLORS.secondary,
                         textAlign: "center",
                         opacity: interpolate(frame, [i*3, i*3+5], [0, 1], { extrapolateRight: "clamp" }),
                         transform: `translateY(${interpolate(frame, [i*3, i*3+5], [20, 0], { extrapolateRight: "clamp" })}px)`
                     }}>
                         {text}
                     </div>
                 ))}
             </div>

             <div style={{
                 backgroundColor: COLORS.primary,
                 padding: "20px 80px",
                 borderRadius: 50,
                 transform: `scale(${pulse})`,
                 boxShadow: `0 0 30px ${COLORS.primary}66`
             }}>
                 <h2 style={{
                     fontFamily: FONTS.heading,
                     fontSize: 50,
                     color: COLORS.background,
                     margin: 0
                 }}>
                     LAUNCH NOW
                 </h2>
             </div>
        </AbsoluteFill>
    );
};

// ============================================
// MAIN COMPOSITION
// ============================================

export const JellyJumpFastAd: React.FC = () => {
    return (
        <AbsoluteFill>
            <Series>
                <Series.Sequence durationInFrames={30}>
                    <Scene1Intro />
                </Series.Sequence>
                <Series.Sequence durationInFrames={30}>
                    <Scene2Trim />
                </Series.Sequence>
                <Series.Sequence durationInFrames={30}>
                    <Scene3Crop />
                </Series.Sequence>
                <Series.Sequence durationInFrames={30}>
                    <Scene4Convert />
                </Series.Sequence>
                <Series.Sequence durationInFrames={40}>
                    <Scene5Privacy />
                </Series.Sequence>
                <Series.Sequence durationInFrames={80}>
                    <Scene6CTA />
                </Series.Sequence>
            </Series>
        </AbsoluteFill>
    );
};
