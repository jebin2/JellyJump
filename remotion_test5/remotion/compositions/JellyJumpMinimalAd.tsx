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
// ASSETS
// ============================================
const BUNNY = "assets/images/photos/mediabunny.svg";
const LOGO = "assets/images/transparent/jelly_jump_logo.png";

// ============================================
// COMPONENTS
// ============================================

const BouncingShape: React.FC<{ 
    type: "circle" | "square" | "triangle";
    color: string;
    delay: number;
    x: number;
}> = ({ type, color, delay, x }) => {
    const frame = useCurrentFrame();
    const { fps, height } = useVideoConfig();

    const drop = spring({
        frame: frame - delay,
        fps,
        config: { damping: 12, stiffness: 100, mass: 2 }
    });

    const y = interpolate(drop, [0, 1], [-200, height - 300]);
    const rotate = interpolate(drop, [0, 1], [0, 180]);
    
    // Squash effect on impact
    const squash = spring({
        frame: frame - delay - 15, // slightly after drop finishes
        fps,
        config: { damping: 10, stiffness: 200 }
    });
    
    const scaleX = interpolate(squash, [0, 0.5, 1], [1, 1.4, 1]);
    const scaleY = interpolate(squash, [0, 0.5, 1], [1, 0.6, 1]);

    const commonStyle = {
        position: "absolute" as const,
        left: x,
        top: y,
        transform: `translate(-50%, -50%) rotate(${rotate}deg) scale(${scaleX}, ${scaleY})`,
        backgroundColor: color,
        boxShadow: "10px 10px 0px rgba(0,0,0,0.2)"
    };

    if (type === "circle") {
        return <div style={{ ...commonStyle, width: 200, height: 200, borderRadius: "50%" }} />;
    } else if (type === "square") {
        return <div style={{ ...commonStyle, width: 200, height: 200, borderRadius: 20 }} />;
    } else {
        return (
            <div style={{ 
                ...commonStyle, 
                width: 0, height: 0, 
                backgroundColor: "transparent", 
                boxShadow: "none",
                borderLeft: "100px solid transparent",
                borderRight: "100px solid transparent",
                borderBottom: `200px solid ${color}`
            }} />
        );
    }
};

const TitleCard: React.FC<{ text: string; color: string; subtext?: string }> = ({ text, color, subtext }) => {
    const frame = useCurrentFrame();
    const { width } = useVideoConfig();
    
    const slide = spring({ frame, fps: 30, config: { damping: 15 } });
    const x = interpolate(slide, [0, 1], [-width, 0]);

    return (
        <AbsoluteFill style={{ 
            justifyContent: "center", 
            alignItems: "center", 
            backgroundColor: COLORS.background 
        }}>
            <div style={{
                transform: `translateX(${x}px)`,
                textAlign: "center"
            }}>
                <h1 style={{
                    fontFamily: FONTS.heading,
                    fontSize: 120,
                    color: color,
                    margin: 0,
                    lineHeight: 0.9,
                    textTransform: "uppercase"
                }}>
                    {text}
                </h1>
                {subtext && (
                    <h2 style={{
                        fontFamily: FONTS.body,
                        fontSize: 50,
                        color: COLORS.secondary,
                        marginTop: 20
                    }}>
                        {subtext}
                    </h2>
                )}
            </div>
        </AbsoluteFill>
    );
};

// ============================================
// SCENES
// ============================================

const Scene1Physics: React.FC = () => {
    return (
        <AbsoluteFill style={{ backgroundColor: COLORS.foreground }}>
            <BouncingShape type="square" color={COLORS.primary} delay={0} x={250} />
            <BouncingShape type="circle" color={COLORS.background} delay={5} x={540} />
            <BouncingShape type="triangle" color={COLORS.secondary} delay={10} x={830} />
            
            <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", top: -300 }}>
                 <h1 style={{ fontFamily: FONTS.heading, fontSize: 100, color: COLORS.background }}>
                     DROP.
                 </h1>
            </AbsoluteFill>
        </AbsoluteFill>
    );
};

const Scene2Process: React.FC = () => {
    const frame = useCurrentFrame();
    
    // Conveyor belt animation
    const move = (frame * 20) % 200;

    return (
        <AbsoluteFill style={{ backgroundColor: COLORS.primary, overflow: "hidden" }}>
            {/* Background Pattern */}
            <div style={{
                position: "absolute",
                width: "120%",
                height: "120%",
                transform: "rotate(-10deg)",
                background: `repeating-linear-gradient(90deg, transparent, transparent 100px, rgba(0,0,0,0.1) 100px, rgba(0,0,0,0.1) 200px)`
            }} />

            <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
                <div style={{
                    width: 600,
                    height: 600,
                    backgroundColor: COLORS.background,
                    borderRadius: 40,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    boxShadow: "20px 20px 0px rgba(0,0,0,0.2)",
                    transform: `scale(${1 + Math.sin(frame/2)*0.05})`
                }}>
                    <Img src={staticFile(BUNNY)} style={{ width: 400 }} />
                </div>
                
                <h1 style={{
                    fontFamily: FONTS.heading,
                    fontSize: 100,
                    color: COLORS.background,
                    marginTop: 50,
                    backgroundColor: "white",
                    padding: "10px 40px",
                    borderRadius: 20,
                    transform: "rotate(-2deg)"
                }}>
                    PROCESSING
                </h1>
            </AbsoluteFill>
        </AbsoluteFill>
    );
};

const Scene3Privacy: React.FC = () => {
    const frame = useCurrentFrame();
    const { width } = useVideoConfig();
    
    const wipe = interpolate(frame, [0, 20], [0, width], { extrapolateRight: "clamp", easing: Easing.bezier(0.8, 0, 0.2, 1) });

    return (
        <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
            <div style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: wipe,
                height: "100%",
                backgroundColor: "#333",
                overflow: "hidden"
            }}>
                 <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
                     <div style={{ fontSize: 200 }}>🔒</div>
                     <h1 style={{ fontFamily: FONTS.heading, fontSize: 80, color: "white", marginTop: 20 }}>
                         OFFLINE
                     </h1>
                 </AbsoluteFill>
            </div>
            
            <div style={{
                position: "absolute",
                left: wipe,
                top: 0,
                right: 0,
                height: "100%",
                backgroundColor: "#eee",
                display: "flex",
                justifyContent: "center",
                alignItems: "center"
            }}>
                <div style={{ fontSize: 200, opacity: 0.2 }}>☁️</div>
            </div>
        </AbsoluteFill>
    );
};

const Scene4Showcase: React.FC = () => {
    return (
        <AbsoluteFill style={{ backgroundColor: COLORS.foreground }}>
             <Sequence from={0} durationInFrames={20}>
                 <TitleCard text="TRIM" color={COLORS.background} />
             </Sequence>
             <Sequence from={20} durationInFrames={20}>
                 <TitleCard text="CROP" color={COLORS.primary} />
             </Sequence>
             <Sequence from={40} durationInFrames={30}>
                 <TitleCard text="CONVERT" color={COLORS.secondary} />
             </Sequence>
        </AbsoluteFill>
    );
};

const Scene5Final: React.FC = () => {
    const frame = useCurrentFrame();
    const scale = spring({ frame, fps: 30, config: { damping: 10 } });

    return (
        <AbsoluteFill style={{ backgroundColor: COLORS.background, justifyContent: "center", alignItems: "center" }}>
             <div style={{
                 transform: `scale(${scale})`,
                 display: "flex",
                 flexDirection: "column",
                 alignItems: "center"
             }}>
                 <Img src={staticFile(LOGO)} style={{ width: 300, marginBottom: 50 }} />
                 <h1 style={{ fontFamily: FONTS.heading, fontSize: 90, color: COLORS.primary, margin: 0 }}>
                     JELLYJUMP
                 </h1>
                 <h2 style={{ fontFamily: FONTS.body, fontSize: 40, color: "white", marginTop: 20 }}>
                     PLAYER
                 </h2>
                 
                 <div style={{
                     marginTop: 80,
                     backgroundColor: "white",
                     padding: "20px 60px",
                     borderRadius: 50
                 }}>
                     <span style={{ fontSize: 40, fontWeight: "bold", color: "black" }}>
                         START NOW
                     </span>
                 </div>
             </div>
        </AbsoluteFill>
    );
};

// ============================================
// MAIN COMPOSITION
// ============================================

export const JellyJumpMinimalAd: React.FC = () => {
    return (
        <AbsoluteFill>
            <Series>
                <Series.Sequence durationInFrames={45}>
                    <Scene1Physics />
                </Series.Sequence>
                <Series.Sequence durationInFrames={45}>
                    <Scene2Process />
                </Series.Sequence>
                <Series.Sequence durationInFrames={45}>
                    <Scene3Privacy />
                </Series.Sequence>
                <Series.Sequence durationInFrames={70}>
                    <Scene4Showcase />
                </Series.Sequence>
                <Series.Sequence durationInFrames={90}>
                    <Scene5Final />
                </Series.Sequence>
            </Series>
        </AbsoluteFill>
    );
};
