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
  Sequence,
} from "remotion";
import { COLORS, FONTS } from "../design-system";

// ============================================
// CONSTANTS & ASSETS
// ============================================

const SCREENSHOT = "assets/screenshots/www-voidall-com/desktop.png";
const BUNNY = "assets/images/photos/mediabunny.svg";
const LOGO = "assets/images/transparent/jelly_jump_logo.png";

const SPRING_BOUNCY = { damping: 12, stiffness: 100, mass: 1 };

// ============================================
// EFFECTS & COMPONENTS
// ============================================

// Smooth Slide Transition
const SlideTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    // Slide in from bottom
    const progress = spring({
        frame,
        fps,
        config: { damping: 15, stiffness: 100 }
    });
    
    const translateY = interpolate(progress, [0, 1], [100, 0]);
    const opacity = interpolate(progress, [0, 1], [0, 1]);

    return (
        <AbsoluteFill style={{ transform: `translateY(${translateY}%)`, opacity }}>
            {children}
        </AbsoluteFill>
    );
};

const Explosion: React.FC<{ x: number; y: number; progress: number }> = ({ x, y, progress }) => {
    if (progress <= 0 || progress >= 1) return null;

    return (
        <AbsoluteFill>
            {[...Array(12)].map((_, i) => {
                const angle = (i / 12) * Math.PI * 2;
                const dist = interpolate(progress, [0, 1], [0, 300], { easing: Easing.out(Easing.exp) });
                const opacity = interpolate(progress, [0, 1], [1, 0]);
                const size = interpolate(progress, [0, 0.5, 1], [0, 10, 0]);
                
                return (
                    <div key={i} style={{
                        position: "absolute",
                        left: x + Math.cos(angle) * dist,
                        top: y + Math.sin(angle) * dist,
                        width: size,
                        height: size,
                        backgroundColor: COLORS.primary,
                        borderRadius: "50%",
                        opacity,
                        boxShadow: `0 0 10px ${COLORS.primary}`
                    }} />
                );
            })}
        </AbsoluteFill>
    );
};

const Cursor: React.FC<{ x: number; y: number; click?: boolean }> = ({ x, y, click }) => {
    return (
        <div style={{
            position: "absolute",
            left: x,
            top: y,
            width: 40,
            height: 40,
            transform: `translate(-50%, -50%) scale(${click ? 0.9 : 1})`,
            transition: "transform 0.1s",
            zIndex: 100
        }}>
            <svg viewBox="0 0 24 24" fill="white" stroke="black" strokeWidth="1">
                <path d="M5.5 3.21l10.8 15.65-4.5 1.1 4.3 6.9-3.4 2.1-4.3-6.9-2.9 3.6V3.21z" />
            </svg>
        </div>
    )
}

const SpeedLines: React.FC = () => {
    const frame = useCurrentFrame();
    return (
        <AbsoluteFill style={{ overflow: "hidden" }}>
             {[...Array(20)].map((_, i) => {
                 const angle = (i * 360) / 20;
                 const speed = (i % 5) + 2;
                 const offset = (frame * speed * 15) % 2000; 
                 return (
                     <div key={i} style={{
                         position: "absolute",
                         left: "50%",
                         top: "50%",
                         width: 300,
                         height: 2,
                         backgroundColor: COLORS.primary,
                         transform: `rotate(${angle}deg) translateX(${offset}px)`,
                         opacity: 1 - (offset / 1000),
                     }} />
                 )
             })}
        </AbsoluteFill>
    )
}

// ============================================
// SCENES
// ============================================

const Scene1UIZoom: React.FC = () => {
    const frame = useCurrentFrame();
    const { durationInFrames } = useVideoConfig();

    // Smoother zoom
    const scale = interpolate(frame, [0, durationInFrames], [1, 2.5], { easing: Easing.bezier(0.25, 0.1, 0.25, 1) });
    const translateY = interpolate(frame, [0, durationInFrames], [0, 150]);

    return (
        <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
            <Img 
                src={staticFile(SCREENSHOT)}
                style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    transform: `scale(${scale}) translateY(${translateY}px)`,
                }}
            />
            {/* Clean Scanning Bar */}
            <div style={{
                position: "absolute",
                top: (frame * 20) % 1920,
                left: 0,
                width: "100%",
                height: 2,
                backgroundColor: COLORS.primary,
                boxShadow: `0 0 10px ${COLORS.primary}`
            }} />
            
            <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
                <div style={{
                    fontFamily: FONTS.heading,
                    fontSize: 90,
                    color: COLORS.primary,
                    fontWeight: 800,
                    textShadow: "0 4px 10px rgba(0,0,0,0.5)",
                    opacity: interpolate(frame, [0, 10], [0, 1])
                }}>
                    YOUR BROWSER
                </div>
            </AbsoluteFill>
        </AbsoluteFill>
    );
};

const Scene2Action: React.FC = () => {
    const frame = useCurrentFrame();

    const cutProgress = interpolate(frame, [15, 30], [0, 1], { extrapolateRight: "clamp", easing: Easing.bezier(0.2, 0.8, 0.2, 1) });
    const cursorX = interpolate(frame, [0, 15], [800, 540], { extrapolateRight: "clamp", easing: Easing.out(Easing.quad) });
    const cursorY = interpolate(frame, [0, 15], [1200, 960], { extrapolateRight: "clamp", easing: Easing.out(Easing.quad) });
    const isClick = frame > 15 && frame < 20;

    return (
        <AbsoluteFill style={{ backgroundColor: COLORS.dark }}>
            <Img 
                src={staticFile(SCREENSHOT)}
                style={{
                    width: "300%",
                    height: "300%",
                    position: "absolute",
                    left: "-100%",
                    top: "-100%",
                    objectFit: "contain",
                    filter: "blur(5px) brightness(0.3)"
                }}
            />

            <div style={{
                position: "absolute",
                top: "50%",
                left: "10%",
                width: "80%",
                height: 120,
                backgroundColor: "#222",
                borderRadius: 15,
                overflow: "hidden",
                border: `3px solid ${COLORS.secondary}`,
                boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
            }}>
                <div style={{
                    width: "100%",
                    height: "100%",
                    background: `repeating-linear-gradient(90deg, #333, #333 2px, transparent 2px, transparent 40px)`
                }} />
                
                {/* The Video Clip */}
                <div style={{
                    position: "absolute",
                    top: 10,
                    left: 0,
                    width: "100%",
                    height: "80%",
                    backgroundColor: "#444",
                    borderRadius: 5
                }}>
                     {/* Left Part */}
                     <div style={{
                        position: "absolute",
                        left: 0,
                        width: "50%",
                        height: "100%",
                        backgroundColor: COLORS.primary,
                        opacity: 0.3,
                        transform: `translateX(${interpolate(cutProgress, [0, 1], [0, -40])}px)`,
                        borderRight: "2px solid white"
                    }} />
                    {/* Right Part */}
                     <div style={{
                        position: "absolute",
                        right: 0,
                        width: "50%",
                        height: "100%",
                        backgroundColor: COLORS.primary,
                        opacity: 0.3,
                        transform: `translateX(${interpolate(cutProgress, [0, 1], [0, 40])}px)`,
                        borderLeft: "2px solid white"
                    }} />
                </div>
            </div>

            <Cursor x={cursorX} y={cursorY} click={isClick} />
            <Explosion x={540} y={960} progress={interpolate(frame, [15, 35], [0, 1], {extrapolateRight: "clamp"})} />
            
             <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 200 }}>
                <h2 style={{ fontFamily: FONTS.heading, fontSize: 70, color: COLORS.foreground, textShadow: "0 5px 15px black" }}>
                    INSTANT <span style={{ color: COLORS.primary, fontWeight: 900 }}>TRIM</span>
                </h2>
            </AbsoluteFill>
        </AbsoluteFill>
    );
};

const Scene3Speed: React.FC = () => {
    const frame = useCurrentFrame();
    
    // Smooth Scale
    const scale = interpolate(frame, [0, 30], [0.8, 1.2], { easing: Easing.out(Easing.quad) });
    
    return (
        <AbsoluteFill style={{ backgroundColor: COLORS.background, overflow: "hidden" }}>
            <SpeedLines />
            
            {/* Main Image */}
            <div style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: `translate(-50%, -50%) scale(${scale})`
            }}>
                 <Img 
                    src={staticFile(BUNNY)}
                    style={{
                        width: 300,
                        height: 300,
                        transform: `rotate(${frame}deg)`,
                        filter: `drop-shadow(0 0 30px ${COLORS.primary})`
                    }}
                />
            </div>

            <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
                 <h2 style={{ 
                     fontFamily: FONTS.heading, 
                     fontSize: 85, 
                     color: "white",
                     marginTop: 500,
                     textShadow: `4px 4px 0px ${COLORS.primary}`,
                 }}>
                    LIGHTNING FAST
                </h2>
            </AbsoluteFill>
        </AbsoluteFill>
    );
};

const Scene4Privacy: React.FC = () => {
    const frame = useCurrentFrame();
    const shieldScale = spring({ frame, fps: 30, config: SPRING_BOUNCY });

    return (
        <AbsoluteFill style={{ backgroundColor: COLORS.dark }}>
            <AbsoluteFill>
                {[...Array(10)].map((_, i) => (
                    <div key={i} style={{
                        position: "absolute",
                        top: -100,
                        left: `${i * 10}%`,
                        fontSize: 20,
                        color: COLORS.primary,
                        fontFamily: FONTS.body,
                        opacity: 0.15,
                        transform: `translateY(${(frame * (5 + i)) % 2000}px)`
                    }}>
                        {Math.random().toString(2).substr(2, 8)}
                    </div>
                ))}
            </AbsoluteFill>

            <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
                <div style={{
                    width: 450,
                    height: 450,
                    border: `4px solid ${COLORS.primary}`,
                    borderRadius: "50%",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    transform: `scale(${shieldScale})`,
                    backgroundColor: "rgba(0,10,0,0.9)",
                    boxShadow: `0 0 50px ${COLORS.primary}44`
                }}>
                    <Img src={staticFile(LOGO)} style={{ width: 220 }} />
                </div>
                
                <div style={{
                    position: "absolute",
                    top: "22%",
                    fontFamily: FONTS.body,
                    fontSize: 45,
                    fontWeight: "bold",
                    color: COLORS.background,
                    backgroundColor: COLORS.primary,
                    padding: "10px 30px",
                    transform: "rotate(-5deg)",
                    boxShadow: "10px 10px 0px white"
                }}>
                    NO UPLOADS
                </div>
            </AbsoluteFill>
        </AbsoluteFill>
    )
}

const Scene5CTA: React.FC = () => {
    const frame = useCurrentFrame();
    const pulse = Math.sin(frame / 10) * 0.03 + 1; // Smooth pulse
    
    return (
        <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
            <div style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                width: "200%",
                height: "200%",
                background: `radial-gradient(circle, ${COLORS.primary}22 0%, transparent 70%)`,
                transform: `translate(-50%, -50%) scale(${pulse})`
            }} />

            <Img 
                src={staticFile(LOGO)} 
                style={{
                    position: "absolute",
                    top: "20%",
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 250,
                    filter: `drop-shadow(0 0 20px ${COLORS.primary})`
                }}
            />
            
            <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingTop: 120 }}>
                 <h1 style={{ fontFamily: FONTS.heading, fontSize: 80, color: COLORS.foreground, margin: 0 }}>
                    JELLYJUMP
                 </h1>
                 <h2 style={{ fontFamily: FONTS.heading, fontSize: 60, color: COLORS.primary, margin: 0, letterSpacing: 5 }}>
                    PLAYER
                 </h2>
                 
                 <div style={{
                     marginTop: 60,
                     padding: "30px 80px",
                     backgroundColor: COLORS.primary,
                     borderRadius: 15,
                     boxShadow: `0 0 40px ${COLORS.primary}66`,
                     transform: `scale(${pulse})`
                 }}>
                     <span style={{ fontFamily: FONTS.heading, fontSize: 45, fontWeight: 900, color: COLORS.background }}>
                         LAUNCH NOW
                     </span>
                 </div>
            </AbsoluteFill>
        </AbsoluteFill>
    );
};

// ============================================
// MAIN COMPOSITION
// ============================================

export const JellyJumpVisualAd: React.FC = () => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill>
      <Series>
        <Series.Sequence durationInFrames={50}>
            <SlideTransition>
                <Scene1UIZoom />
            </SlideTransition>
        </Series.Sequence>
        <Series.Sequence durationInFrames={50}>
            <SlideTransition>
                <Scene2Action />
            </SlideTransition>
        </Series.Sequence>
        <Series.Sequence durationInFrames={50}>
            <SlideTransition>
                <Scene3Speed />
            </SlideTransition>
        </Series.Sequence>
        <Series.Sequence durationInFrames={60}>
            <SlideTransition>
                <Scene4Privacy />
            </SlideTransition>
        </Series.Sequence>
        <Series.Sequence durationInFrames={90}>
            <SlideTransition>
                <Scene5CTA />
            </SlideTransition>
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
