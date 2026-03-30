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

const IconContainer: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = COLORS.primary }) => (
    <div style={{
        width: 250,
        height: 250,
        borderRadius: 40,
        border: `8px solid ${color}`,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.5)",
        boxShadow: `0 0 30px ${color}44`
    }}>
        {children}
    </div>
);

// ============================================
// FEATURE ANIMATIONS
// ============================================

const TrimAction: React.FC = () => {
    const frame = useCurrentFrame();
    const cut = interpolate(frame, [10, 20], [0, 60], { extrapolateRight: "clamp", easing: Easing.bezier(0.2, 0.8, 0.2, 1) });
    const cutLineScale = interpolate(frame, [0, 8, 12], [0, 1, 0], { extrapolateRight: "clamp" });
    
    return (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
            <div style={{ position: "relative", width: 400, height: 40 }}>
                {/* Left Piece */}
                <div style={{ 
                    position: "absolute", 
                    left: 0, 
                    width: "50%", 
                    height: "100%", 
                    backgroundColor: "white", 
                    borderTopLeftRadius: 20,
                    borderBottomLeftRadius: 20,
                    borderTopRightRadius: frame > 10 ? 10 : 0,
                    borderBottomRightRadius: frame > 10 ? 10 : 0,
                    transform: `translateX(-${cut}px)` 
                }} />
                
                {/* Right Piece */}
                <div style={{ 
                    position: "absolute", 
                    right: 0, 
                    width: "50%", 
                    height: "100%", 
                    backgroundColor: "white", 
                    borderTopRightRadius: 20,
                    borderBottomRightRadius: 20,
                    borderTopLeftRadius: frame > 10 ? 10 : 0,
                    borderBottomLeftRadius: frame > 10 ? 10 : 0,
                    transform: `translateX(${cut}px)` 
                }} />
                
                {/* Cut Line Indicator */}
                <div style={{ 
                    position: "absolute", 
                    left: "50%", 
                    top: -60, 
                    width: 4, 
                    height: 160, 
                    backgroundColor: COLORS.primary, 
                    transform: `translateX(-50%) scaleY(${cutLineScale})`,
                    boxShadow: `0 0 20px ${COLORS.primary}`
                }} />
            </div>
            <h2 style={{ fontFamily: FONTS.heading, color: COLORS.primary, marginTop: 150, fontSize: 100 }}>TRIM</h2>
        </AbsoluteFill>
    );
};

const ResizeAction: React.FC = () => {
    const frame = useCurrentFrame();
    const width = interpolate(frame, [0, 20], [400, 200], { extrapolateRight: "clamp", easing: Easing.elastic(1) });
    const height = interpolate(frame, [0, 20], [200, 400], { extrapolateRight: "clamp", easing: Easing.elastic(1) });

    return (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
            <div style={{ 
                width: width, 
                height: height, 
                border: `8px solid ${COLORS.primary}`,
                borderRadius: 20,
                position: "relative"
            }}>
                <div style={{ position: "absolute", top: -20, left: -20, width: 40, height: 40, borderTop: "8px solid white", borderLeft: "8px solid white" }} />
                <div style={{ position: "absolute", bottom: -20, right: -20, width: 40, height: 40, borderBottom: "8px solid white", borderRight: "8px solid white" }} />
            </div>
            <h2 style={{ fontFamily: FONTS.heading, color: COLORS.primary, marginTop: 250, fontSize: 100 }}>RESIZE</h2>
        </AbsoluteFill>
    );
};

const MergeAction: React.FC = () => {
    const frame = useCurrentFrame();
    // Move blocks together
    const pos = interpolate(frame, [0, 12], [150, 0], { extrapolateRight: "clamp", easing: Easing.in(Easing.exp) });
    // Flash on impact
    const flash = interpolate(frame, [12, 16, 25], [0, 1, 0], { extrapolateRight: "clamp" });
    const isMerged = frame >= 12;
    // Dynamic text scale
    const textScale = interpolate(frame, [12, 15], [1, 1.2], { extrapolateRight: "clamp", easing: Easing.out(Easing.back(3)) });

    return (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
            <div style={{ zIndex: 1, position: "relative" }}>
                {!isMerged ? (
                    <div style={{ display: "flex", gap: 10 }}>
                        <div style={{ width: 150, height: 150, backgroundColor: COLORS.secondary, borderRadius: 20, transform: `translateX(${pos}px)` }} />
                        <div style={{ width: 150, height: 150, backgroundColor: "white", borderRadius: 20, transform: `translateX(-${pos}px)` }} />
                    </div>
                ) : (
                    <div style={{ 
                        width: 310, 
                        height: 150, 
                        backgroundColor: COLORS.primary, 
                        borderRadius: 20,
                        transform: `scale(${interpolate(frame, [12, 16], [0.9, 1], { easing: Easing.elastic(1.5) })})`,
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center"
                    }}>
                        <div style={{ width: 4, height: "80%", backgroundColor: "rgba(0,0,0,0.2)", borderRadius: 2 }} />
                    </div>
                )}
            </div>

            <h2 style={{ 
                fontFamily: FONTS.heading, 
                color: COLORS.primary, 
                marginTop: 150, 
                fontSize: 100,
                transform: `scale(${isMerged ? textScale : 1})`,
                zIndex: 2,
                textShadow: "0 10px 30px rgba(0,0,0,0.5)"
            }}>
                MERGE
            </h2>
        </AbsoluteFill>
    );
};

const ConvertAction: React.FC = () => {
    const frame = useCurrentFrame();
    const rotate = interpolate(frame, [0, 20], [0, 180]);
    const isMov = frame < 10;

    return (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
            <div style={{ 
                width: 250, height: 250, 
                backgroundColor: isMov ? COLORS.secondary : COLORS.primary, 
                borderRadius: "50%",
                display: "flex", justifyContent: "center", alignItems: "center",
                transform: `rotateY(${rotate}deg)`
            }}>
                <h2 style={{ fontFamily: FONTS.heading, color: "black", transform: `rotateY(${isMov ? 0 : 180}deg)` }}>
                    {isMov ? "MOV" : "MP4"}
                </h2>
            </div>
            <h2 style={{ fontFamily: FONTS.heading, color: COLORS.primary, marginTop: 150, fontSize: 100 }}>CONVERT</h2>
        </AbsoluteFill>
    );
};

const GifAction: React.FC = () => {
    const frame = useCurrentFrame();
    const rotate = frame * 15;

    return (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
            <div style={{ width: 200, height: 200, border: "20px solid white", borderRadius: "50%", borderRightColor: "transparent", transform: `rotate(${rotate}deg)` }} />
            <div style={{ position: "absolute", fontFamily: FONTS.heading, fontSize: 80, color: COLORS.primary }}>GIF</div>
            <h2 style={{ fontFamily: FONTS.heading, color: COLORS.primary, marginTop: 250, fontSize: 100 }}>CREATE GIF</h2>
        </AbsoluteFill>
    );
};

const FilterAction: React.FC = () => {
    const frame = useCurrentFrame();
    const hue = (frame * 10) % 360;

    return (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
            <div style={{ 
                width: 300, height: 300, 
                backgroundColor: `hsl(${hue}, 100%, 50%)`, 
                borderRadius: 40,
                boxShadow: `0 0 50px hsl(${hue}, 100%, 50%)`
            }} />
            <h2 style={{ fontFamily: FONTS.heading, color: "white", marginTop: 150, fontSize: 100 }}>FILTERS</h2>
        </AbsoluteFill>
    );
};

const EQAction: React.FC = () => {
    const frame = useCurrentFrame();
    
    return (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 20, alignItems: "flex-end", height: 200 }}>
                {[...Array(5)].map((_, i) => (
                    <div key={i} style={{ 
                        width: 40, 
                        height: 50 + Math.sin(frame / 2 + i) * 100, 
                        backgroundColor: COLORS.primary 
                    }} />
                ))}
            </div>
            <h2 style={{ fontFamily: FONTS.heading, color: COLORS.primary, marginTop: 150, fontSize: 100 }}>EQUALIZER</h2>
        </AbsoluteFill>
    );
};

const SpeedAction: React.FC = () => {
    const frame = useCurrentFrame();
    const offset = (frame * 30) % 100;

    return (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 10 }}>
                {[...Array(3)].map((_, i) => (
                    <div key={i} style={{ 
                        width: 0, height: 0, 
                        borderTop: "50px solid transparent",
                        borderBottom: "50px solid transparent",
                        borderLeft: `80px solid ${COLORS.primary}`,
                        opacity: (i + frame/5) % 3 
                    }} />
                ))}
            </div>
             <h2 style={{ fontFamily: FONTS.heading, color: COLORS.primary, marginTop: 150, fontSize: 100 }}>SPEED & REVERSE</h2>
        </AbsoluteFill>
    );
};

const WatermarkAction: React.FC = () => {
    const frame = useCurrentFrame();
    const scale = interpolate(frame, [0, 10], [2, 1], { extrapolateRight: "clamp", easing: Easing.bounce });
    const opacity = interpolate(frame, [0, 10], [0, 1]);

    return (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
            <div style={{ width: 400, height: 300, backgroundColor: "#333", borderRadius: 20, position: "relative" }}>
                <Img 
                    src={staticFile(LOGO)} 
                    style={{ 
                        position: "absolute", bottom: 20, right: 20, width: 80, 
                        transform: `scale(${scale})`, opacity 
                    }} 
                />
            </div>
            <h2 style={{ fontFamily: FONTS.heading, color: COLORS.primary, marginTop: 150, fontSize: 100 }}>WATERMARK</h2>
        </AbsoluteFill>
    );
};

const StreamAction: React.FC = () => {
    const frame = useCurrentFrame();
    const rotate = frame * 12;
    const arc1 = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.quad) });
    const arc2 = interpolate(frame, [5, 15], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.quad) });
    const arc3 = interpolate(frame, [10, 20], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.quad) });
    const textOpacity = interpolate(frame, [12, 20], [0, 1], { extrapolateRight: "clamp" });

    return (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
            <div style={{ position: "relative" }}>
                {/* Spinning ring */}
                <div style={{
                    width: 200, height: 200,
                    border: `16px solid ${COLORS.primary}`,
                    borderRadius: "50%",
                    borderTopColor: "transparent",
                    transform: `rotate(${rotate}deg)`,
                    boxShadow: `0 0 40px ${COLORS.primary}44`
                }} />
                {/* Signal arcs */}
                {[arc1, arc2, arc3].map((a, i) => (
                    <div key={i} style={{
                        position: "absolute", top: -20 - i * 25, right: -20 - i * 25,
                        width: 70 + i * 40, height: 70 + i * 40,
                        borderRadius: "50%",
                        border: `4px solid ${COLORS.primary}`,
                        borderLeftColor: "transparent",
                        borderBottomColor: "transparent",
                        opacity: a * 0.7,
                        transform: `scale(${a})`,
                    }} />
                ))}
                {/* .m3u8 text */}
                <div style={{
                    position: "absolute",
                    top: "50%", left: "50%",
                    transform: "translate(-50%, -50%)",
                    fontFamily: FONTS.heading, fontSize: 40, color: "white",
                    opacity: textOpacity,
                }}>.m3u8</div>
            </div>
            <h2 style={{ fontFamily: FONTS.heading, color: COLORS.primary, marginTop: 150, fontSize: 100 }}>STREAM</h2>
        </AbsoluteFill>
    );
};

const ScreenRecAction: React.FC = () => {
    const frame = useCurrentFrame();
    const monitorScale = interpolate(frame, [0, 8], [0.5, 1], { extrapolateRight: "clamp", easing: Easing.elastic(1.2) });
    const pipSlide = interpolate(frame, [8, 16], [100, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.back(2)) });
    const dotPulse = 1 + Math.sin(frame * 0.8) * 0.4;

    return (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
            <div style={{ position: "relative", transform: `scale(${monitorScale})` }}>
                {/* Monitor */}
                <div style={{
                    width: 350, height: 230,
                    border: `8px solid ${COLORS.primary}`,
                    borderRadius: 20,
                    boxShadow: `0 0 40px ${COLORS.primary}44`,
                }}>
                    {/* Red recording dot */}
                    <div style={{
                        position: "absolute", top: 15, left: 15,
                        width: 22, height: 22,
                        borderRadius: "50%",
                        backgroundColor: "#ff3333",
                        transform: `scale(${dotPulse})`,
                        boxShadow: `0 0 20px #ff3333`,
                    }} />
                </div>
                {/* PiP camera overlay */}
                <div style={{
                    position: "absolute", bottom: 15, right: 15,
                    width: 90, height: 65,
                    borderRadius: 12,
                    border: `4px solid white`,
                    backgroundColor: "#333",
                    transform: `translateX(${pipSlide}px)`,
                }} />
            </div>
            <h2 style={{ fontFamily: FONTS.heading, color: COLORS.primary, marginTop: 150, fontSize: 80 }}>SCREEN RECORD</h2>
        </AbsoluteFill>
    );
};

const RecordAction: React.FC = () => {
    const frame = useCurrentFrame();
    const ringScale = interpolate(frame, [0, 10], [0.3, 1], { extrapolateRight: "clamp", easing: Easing.elastic(1.5) });
    const dotPulse = 1 + Math.sin(frame * 0.6) * 0.15;

    return (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
            {/* Record button */}
            <div style={{ position: "relative", width: 200, height: 200, transform: `scale(${ringScale})` }}>
                <div style={{
                    width: 200, height: 200,
                    borderRadius: "50%",
                    border: `8px solid white`,
                }} />
                <div style={{
                    width: 130, height: 130,
                    borderRadius: "50%",
                    backgroundColor: "#ff3333",
                    position: "absolute", top: 35, left: 35,
                    transform: `scale(${dotPulse})`,
                    boxShadow: `0 0 40px #ff3333`,
                }} />
            </div>
            {/* Waveform bars */}
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", height: 80, marginTop: 30 }}>
                {[...Array(7)].map((_, i) => (
                    <div key={i} style={{
                        width: 12,
                        height: 20 + Math.sin(frame / 2 + i * 1.2) * 40,
                        backgroundColor: COLORS.primary,
                    }} />
                ))}
            </div>
            <h2 style={{ fontFamily: FONTS.heading, color: COLORS.primary, marginTop: 80, fontSize: 100 }}>RECORD</h2>
        </AbsoluteFill>
    );
};

const SceneDetectAction: React.FC = () => {
    const frame = useCurrentFrame();
    const cutLine1 = interpolate(frame, [0, 6, 10], [0, 1, 0], { extrapolateRight: "clamp" });
    const cutLine2 = interpolate(frame, [4, 10, 14], [0, 1, 0], { extrapolateRight: "clamp" });
    const sep = interpolate(frame, [10, 20], [0, 40], { extrapolateRight: "clamp", easing: Easing.out(Easing.back(1.5)) });

    return (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
            <div style={{ position: "relative", width: 400, height: 50 }}>
                {/* Three segments that split apart */}
                {[0, 1, 2].map((i) => {
                    const offset = (i - 1) * sep;
                    return (
                        <div key={i} style={{
                            position: "absolute",
                            left: i * 133 + offset,
                            width: 120,
                            height: "100%",
                            backgroundColor: i === 1 ? COLORS.primary : "white",
                            borderRadius: 12,
                        }} />
                    );
                })}
                {/* Cut line flashes */}
                <div style={{
                    position: "absolute", left: "33%", top: -40,
                    width: 4, height: 130,
                    backgroundColor: COLORS.primary,
                    transform: `translateX(-50%) scaleY(${cutLine1})`,
                    boxShadow: `0 0 20px ${COLORS.primary}`,
                }} />
                <div style={{
                    position: "absolute", left: "66%", top: -40,
                    width: 4, height: 130,
                    backgroundColor: COLORS.primary,
                    transform: `translateX(-50%) scaleY(${cutLine2})`,
                    boxShadow: `0 0 20px ${COLORS.primary}`,
                }} />
            </div>
            <h2 style={{ fontFamily: FONTS.heading, color: COLORS.primary, marginTop: 150, fontSize: 80 }}>SCENE DETECT</h2>
        </AbsoluteFill>
    );
};

const MotionDetectAction: React.FC = () => {
    const frame = useCurrentFrame();
    const gridSize = 5;
    const motionCells = [6, 7, 11, 12, 16, 17, 18];

    return (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${gridSize}, 48px)`, gap: 8 }}>
                {[...Array(gridSize * gridSize)].map((_, i) => {
                    const isMotion = motionCells.includes(i);
                    const delay = isMotion ? motionCells.indexOf(i) * 2 : 0;
                    const cellOpacity = isMotion
                        ? interpolate(frame, [delay, delay + 6], [0.3, 1], { extrapolateRight: "clamp" })
                        : 0.3;
                    const cellScale = isMotion
                        ? interpolate(frame, [delay, delay + 6], [0.8, 1], { extrapolateRight: "clamp", easing: Easing.elastic(1.5) })
                        : 1;
                    return (
                        <div key={i} style={{
                            width: 48, height: 48,
                            borderRadius: 8,
                            backgroundColor: isMotion ? COLORS.primary : "#333",
                            opacity: cellOpacity,
                            transform: `scale(${cellScale})`,
                            boxShadow: isMotion && cellOpacity > 0.6 ? `0 0 15px ${COLORS.primary}44` : "none",
                        }} />
                    );
                })}
            </div>
            <h2 style={{ fontFamily: FONTS.heading, color: COLORS.primary, marginTop: 120, fontSize: 70 }}>MOTION DETECT</h2>
        </AbsoluteFill>
    );
};

const RemoveBgAction: React.FC = () => {
    const frame = useCurrentFrame();
    const greenFade = interpolate(frame, [5, 18], [1, 0], { extrapolateRight: "clamp", easing: Easing.in(Easing.quad) });
    const checkerFade = interpolate(frame, [5, 18], [0, 1], { extrapolateRight: "clamp" });
    const subjectScale = interpolate(frame, [15, 20], [1, 1.1], { extrapolateRight: "clamp", easing: Easing.out(Easing.back(2)) });

    return (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
            <div style={{ position: "relative", width: 300, height: 300, borderRadius: 30, overflow: "hidden" }}>
                {/* Checkerboard (transparency pattern) */}
                <div style={{
                    position: "absolute", inset: 0,
                    opacity: checkerFade,
                    backgroundImage: `
                        linear-gradient(45deg, #666 25%, transparent 25%),
                        linear-gradient(-45deg, #666 25%, transparent 25%),
                        linear-gradient(45deg, transparent 75%, #666 75%),
                        linear-gradient(-45deg, transparent 75%, #666 75%)
                    `,
                    backgroundSize: "30px 30px",
                    backgroundPosition: "0 0, 0 15px, 15px -15px, -15px 0px",
                }} />
                {/* Green screen */}
                <div style={{
                    position: "absolute", inset: 0,
                    backgroundColor: "#00cc44",
                    opacity: greenFade,
                }} />
                {/* Subject rectangle */}
                <div style={{
                    position: "absolute",
                    top: 40, left: 70,
                    width: 160, height: 220,
                    backgroundColor: "#333",
                    borderRadius: 20,
                    transform: `scale(${subjectScale})`,
                }} />
            </div>
            <h2 style={{ fontFamily: FONTS.heading, color: COLORS.primary, marginTop: 100, fontSize: 80 }}>REMOVE BG</h2>
        </AbsoluteFill>
    );
};

const TrackManagerAction: React.FC = () => {
    const frame = useCurrentFrame();
    const slideOut = interpolate(frame, [12, 22], [0, 150], { extrapolateRight: "clamp", easing: Easing.in(Easing.exp) });
    const trackColors = [COLORS.primary, "#ff6644", "#4488ff"];

    return (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
                {trackColors.map((color, i) => {
                    const stagger = interpolate(frame, [i * 2, i * 2 + 8], [-200, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.back(1.5)) });
                    return (
                        <div key={i} style={{
                            width: 300, height: 45,
                            backgroundColor: color,
                            borderRadius: 10,
                            transform: `translateX(${i === 1 ? slideOut + stagger : stagger}px)`,
                            boxShadow: `0 0 20px ${color}44`,
                        }} />
                    );
                })}
            </div>
            <h2 style={{ fontFamily: FONTS.heading, color: COLORS.primary, marginTop: 150, fontSize: 70 }}>TRACK MANAGER</h2>
        </AbsoluteFill>
    );
};

const PlaylistAction: React.FC = () => {
    const frame = useCurrentFrame();

    return (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
            <div style={{ position: "relative", width: 280, height: 220 }}>
                {/* Three stacked cards that fan out */}
                {[0, 1, 2].map((i) => {
                    const spread = interpolate(frame, [2 + i * 3, 12 + i * 3], [0, (i - 1) * 70], { extrapolateRight: "clamp", easing: Easing.out(Easing.back(2)) });
                    const tilt = interpolate(frame, [2 + i * 3, 12 + i * 3], [0, (i - 1) * 6], { extrapolateRight: "clamp", easing: Easing.out(Easing.quad) });
                    return (
                        <div key={i} style={{
                            position: "absolute",
                            width: 250, height: 70,
                            backgroundColor: i === 1 ? COLORS.primary : "#444",
                            borderRadius: 16,
                            left: 15,
                            top: 75,
                            transform: `translateY(${spread}px) rotate(${tilt}deg)`,
                            transformOrigin: "center center",
                            boxShadow: i === 1 ? `0 0 30px ${COLORS.primary}44` : "0 5px 15px rgba(0,0,0,0.3)",
                        }} />
                    );
                })}
            </div>
            {/* Frame step dots */}
            <div style={{ display: "flex", gap: 15, marginTop: 30 }}>
                {[...Array(5)].map((_, i) => {
                    const active = Math.floor(frame / 5) % 5 === i;
                    return (
                        <div key={i} style={{
                            width: 16, height: 16,
                            borderRadius: "50%",
                            backgroundColor: active ? COLORS.primary : "#555",
                            boxShadow: active ? `0 0 15px ${COLORS.primary}` : "none",
                        }} />
                    );
                })}
            </div>
            <h2 style={{ fontFamily: FONTS.heading, color: COLORS.primary, marginTop: 60, fontSize: 100 }}>PLAYLIST</h2>
        </AbsoluteFill>
    );
};

// ============================================
// COMPOSITION
// ============================================

const FeatureGrid: React.FC = () => {
    return (
        <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
             {/* 17 Features in rapid succession */}
             <Series>
                 <Series.Sequence durationInFrames={25}><TrimAction /></Series.Sequence>
                 <Series.Sequence durationInFrames={25}><ResizeAction /></Series.Sequence>
                 <Series.Sequence durationInFrames={25}><MergeAction /></Series.Sequence>
                 <Series.Sequence durationInFrames={25}><ConvertAction /></Series.Sequence>
                 <Series.Sequence durationInFrames={25}><GifAction /></Series.Sequence>
                 <Series.Sequence durationInFrames={25}><FilterAction /></Series.Sequence>
                 <Series.Sequence durationInFrames={25}><EQAction /></Series.Sequence>
                 <Series.Sequence durationInFrames={25}><SpeedAction /></Series.Sequence>
                 <Series.Sequence durationInFrames={25}><WatermarkAction /></Series.Sequence>
                 <Series.Sequence durationInFrames={25}><StreamAction /></Series.Sequence>
                 <Series.Sequence durationInFrames={25}><ScreenRecAction /></Series.Sequence>
                 <Series.Sequence durationInFrames={25}><RecordAction /></Series.Sequence>
                 <Series.Sequence durationInFrames={25}><SceneDetectAction /></Series.Sequence>
                 <Series.Sequence durationInFrames={25}><MotionDetectAction /></Series.Sequence>
                 <Series.Sequence durationInFrames={25}><RemoveBgAction /></Series.Sequence>
                 <Series.Sequence durationInFrames={25}><TrackManagerAction /></Series.Sequence>
                 <Series.Sequence durationInFrames={25}><PlaylistAction /></Series.Sequence>
             </Series>
        </AbsoluteFill>
    );
};

const ScenePrivacy: React.FC = () => {
    const frame = useCurrentFrame();
    const scale = spring({ frame, fps: 30, config: { damping: 12 } });

    return (
        <AbsoluteFill style={{ backgroundColor: COLORS.dark, justifyContent: "center", alignItems: "center" }}>
             <div style={{
                 width: 500, height: 500,
                 borderRadius: "50%",
                 border: `10px solid ${COLORS.primary}`,
                 display: "flex", justifyContent: "center", alignItems: "center",
                 transform: `scale(${scale})`,
                 boxShadow: `0 0 80px ${COLORS.primary}44`
             }}>
                 <Img src={staticFile(BUNNY)} style={{ width: 300 }} />
             </div>
             
             <h2 style={{ fontFamily: FONTS.heading, fontSize: 70, color: "white", marginTop: 60 }}>
                 POWERED BY <br/><span style={{ color: COLORS.primary }}>MEDIABUNNY</span>
             </h2>
        </AbsoluteFill>
    );
};

const SceneOutro: React.FC = () => {
    const frame = useCurrentFrame();
    const pulse = Math.sin(frame / 5) * 0.05 + 1;

    return (
        <AbsoluteFill style={{ backgroundColor: COLORS.background, justifyContent: "center", alignItems: "center" }}>
            <Img src={staticFile(LOGO)} style={{ width: 300, marginBottom: 50 }} />
            
            <div style={{
                backgroundColor: COLORS.primary,
                padding: "30px 100px",
                borderRadius: 80,
                transform: `scale(${pulse})`,
                boxShadow: `0 0 50px ${COLORS.primary}`
            }}>
                <h1 style={{ fontFamily: FONTS.heading, fontSize: 60, color: COLORS.background, margin: 0 }}>
                    START PLAYING
                </h1>
            </div>
            
            <p style={{ fontFamily: FONTS.body, fontSize: 35, color: "#888", marginTop: 50 }}>
                voidall.com/JellyJump
            </p>
        </AbsoluteFill>
    );
};

export const JellyJumpActionAd: React.FC = () => {
    return (
        <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
            <Series>
                <Series.Sequence durationInFrames={30}>
                    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
                        <Img src={staticFile(LOGO)} style={{ width: 400 }} />
                        <h1 style={{ fontFamily: FONTS.heading, fontSize: 100, color: "white", marginTop: 40 }}>PRIVACY FIRST</h1>
                    </AbsoluteFill>
                </Series.Sequence>
                
                {/* 17 Features x 25 frames = 425 frames */}
                <Series.Sequence durationInFrames={425}>
                    <FeatureGrid />
                </Series.Sequence>
                
                <Series.Sequence durationInFrames={60}>
                    <ScenePrivacy />
                </Series.Sequence>
                
                <Series.Sequence durationInFrames={90}>
                    <SceneOutro />
                </Series.Sequence>
            </Series>
        </AbsoluteFill>
    );
};
