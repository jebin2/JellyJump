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
// REUSABLE UI COMPONENTS
// ============================================

const Card: React.FC<{ 
    children: React.ReactNode; 
    width?: number; 
    height?: number; 
    style?: React.CSSProperties 
}> = ({ children, width = 800, height = 500, style }) => (
    <div style={{
        width,
        height,
        backgroundColor: "#1a1a1a",
        borderRadius: 30,
        boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
        border: "1px solid #333",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
        position: "relative",
        ...style
    }}>
        {children}
    </div>
);

const Label: React.FC<{ text: string; delay?: number }> = ({ text, delay = 0 }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    
    const opacity = interpolate(frame, [delay, delay + 10], [0, 1]);
    const y = interpolate(frame, [delay, delay + 10], [20, 0], { easing: Easing.out(Easing.quad) });

    return (
        <h2 style={{
            fontFamily: FONTS.heading,
            fontSize: 60,
            color: "white",
            marginTop: 40,
            opacity,
            transform: `translateY(${y}px)`
        }}>
            {text}
        </h2>
    );
};

// ============================================
// SCENES
// ============================================

const Scene1Intro: React.FC = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    
    const opacity = interpolate(frame, [0, 20], [0, 1]);
    const scale = interpolate(frame, [0, 120], [1, 1.1]);

    return (
        <AbsoluteFill style={{ backgroundColor: COLORS.background, justifyContent: "center", alignItems: "center" }}>
            <div style={{ opacity, transform: `scale(${scale})`, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <Img src={staticFile(LOGO)} style={{ width: 300, marginBottom: 40 }} />
                <h1 style={{ fontFamily: FONTS.heading, fontSize: 90, color: COLORS.primary, margin: 0 }}>
                    JELLYJUMP
                </h1>
                <h2 style={{ fontFamily: FONTS.body, fontSize: 40, color: COLORS.secondary, letterSpacing: 8, marginTop: 20 }}>
                    THE ULTIMATE PLAYER
                </h2>
            </div>
        </AbsoluteFill>
    );
};

const Scene2PlayerFeatures: React.FC = () => {
    const frame = useCurrentFrame();
    
    // Rotate speed dial
    const speedRotation = interpolate(frame, [10, 40], [0, 270], { easing: Easing.bezier(0.25, 0.1, 0.25, 1) });
    const speedValue = interpolate(frame, [10, 40], [1, 4]);

    return (
        <AbsoluteFill style={{ backgroundColor: COLORS.background, justifyContent: "center", alignItems: "center" }}>
             <Sequence from={0}>
                 <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 60 }}>
                     <div style={{ display: "flex", gap: 40 }}>
                         {/* Playback Control Simulation */}
                         <Card width={400} height={400}>
                             <div style={{ 
                                 width: 150, height: 150, 
                                 borderRadius: "50%", 
                                 border: `10px solid ${COLORS.primary}`,
                                 borderTopColor: "transparent",
                                 transform: `rotate(${frame * 2}deg)`
                             }} />
                             <div style={{ position: "absolute", fontSize: 40, color: "white" }}>
                                 LOOP
                             </div>
                         </Card>
                         
                         {/* Speed Control */}
                         <Card width={400} height={400}>
                             <div style={{
                                 width: 250, height: 250,
                                 borderRadius: "50%",
                                 border: "4px solid #333",
                                 position: "relative",
                                 transform: `rotate(${speedRotation}deg)`
                             }}>
                                 <div style={{
                                     position: "absolute", top: 10, left: "50%",
                                     width: 20, height: 20, backgroundColor: COLORS.primary,
                                     borderRadius: "50%", transform: "translateX(-50%)"
                                 }} />
                             </div>
                             <div style={{ position: "absolute", fontSize: 60, fontWeight: "bold", color: "white" }}>
                                 {speedValue.toFixed(1)}x
                             </div>
                         </Card>
                     </div>
                     <Label text="ADVANCED PLAYBACK" />
                 </div>
             </Sequence>
        </AbsoluteFill>
    );
};

const Scene3EditTools: React.FC = () => {
    return (
        <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
            <Sequence from={0} durationInFrames={50}>
                 <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
                     <Card width={600} height={300}>
                         <div style={{ width: "80%", height: 20, backgroundColor: "#333", borderRadius: 10 }}>
                             <div style={{ width: "40%", height: "100%", backgroundColor: COLORS.primary, marginLeft: "30%" }} />
                         </div>
                         <div style={{ position: "absolute", top: -20, left: "30%", width: 4, height: 60, backgroundColor: "white" }} />
                         <div style={{ position: "absolute", top: -20, right: "30%", width: 4, height: 60, backgroundColor: "white" }} />
                     </Card>
                     <Label text="TRIM & CUT" />
                 </AbsoluteFill>
            </Sequence>

            <Sequence from={50} durationInFrames={50}>
                 <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
                     <Card width={400} height={400}>
                         <div style={{ 
                             width: 200, height: 200, 
                             border: `4px dashed ${COLORS.primary}`,
                             display: "flex", justifyContent: "center", alignItems: "center"
                         }}>
                             <div style={{ fontSize: 40, color: "white" }}>CROP</div>
                         </div>
                     </Card>
                     <Label text="CROP & RESIZE" />
                 </AbsoluteFill>
            </Sequence>

            <Sequence from={100} durationInFrames={50}>
                 <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
                     <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                         <Card width={250} height={250}><div style={{ fontSize: 40, color: "#666" }}>.MOV</div></Card>
                         <div style={{ fontSize: 50, color: COLORS.primary }}>→</div>
                         <Card width={250} height={250} style={{ borderColor: COLORS.primary }}><div style={{ fontSize: 40, color: "white" }}>.MP4</div></Card>
                     </div>
                     <Label text="CONVERT FORMATS" />
                 </AbsoluteFill>
            </Sequence>
        </AbsoluteFill>
    );
};

const SceneStreamRecord: React.FC = () => {
    const frame = useCurrentFrame();

    return (
        <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
            {/* Stream */}
            <Sequence from={0} durationInFrames={40}>
                <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
                    <Card width={500} height={350}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
                            {/* Spinning ring with signal arcs */}
                            <div style={{ position: "relative" }}>
                                <div style={{
                                    width: 120, height: 120,
                                    borderRadius: "50%",
                                    border: `8px solid ${COLORS.primary}`,
                                    borderTopColor: "transparent",
                                    transform: `rotate(${frame * 8}deg)`,
                                }} />
                                {[0, 1].map((i) => (
                                    <div key={i} style={{
                                        position: "absolute", top: -10 - i * 15, right: -10 - i * 15,
                                        width: 50 + i * 25, height: 50 + i * 25,
                                        borderRadius: "50%",
                                        border: `3px solid ${COLORS.primary}`,
                                        borderLeftColor: "transparent",
                                        borderBottomColor: "transparent",
                                        opacity: 0.6,
                                    }} />
                                ))}
                            </div>
                            <div style={{ fontFamily: FONTS.body, fontSize: 22, color: COLORS.secondary, letterSpacing: 4 }}>
                                HLS • MP4 • M3U
                            </div>
                        </div>
                    </Card>
                    <Label text="STREAM FROM URL" />
                </AbsoluteFill>
            </Sequence>

            {/* Screen Record */}
            <Sequence from={40} durationInFrames={40}>
                <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
                    <Card width={550} height={380}>
                        <div style={{ position: "relative", width: 400, height: 260 }}>
                            {/* Monitor */}
                            <div style={{
                                width: 400, height: 250,
                                border: `4px solid ${COLORS.primary}`,
                                borderRadius: 15,
                            }}>
                                {/* Red dot */}
                                <div style={{
                                    position: "absolute", top: 15, left: 15,
                                    width: 16, height: 16,
                                    borderRadius: "50%",
                                    backgroundColor: "#ff3333",
                                    boxShadow: "0 0 12px #ff3333",
                                }} />
                            </div>
                            {/* Camera PiP overlay */}
                            <div style={{
                                position: "absolute", bottom: 20, right: 20,
                                width: 100, height: 75,
                                borderRadius: 10,
                                border: "3px solid white",
                                backgroundColor: "#333",
                            }} />
                        </div>
                    </Card>
                    <Label text="SCREEN RECORDING" />
                </AbsoluteFill>
            </Sequence>

            {/* Record */}
            <Sequence from={80} durationInFrames={40}>
                <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
                    <Card width={500} height={350}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 25 }}>
                            {/* Record button */}
                            <div style={{ position: "relative", width: 120, height: 120 }}>
                                <div style={{
                                    width: 120, height: 120,
                                    borderRadius: "50%",
                                    border: "5px solid white",
                                }} />
                                <div style={{
                                    width: 80, height: 80,
                                    borderRadius: "50%",
                                    backgroundColor: "#ff3333",
                                    position: "absolute", top: 20, left: 20,
                                    boxShadow: "0 0 25px #ff3333",
                                }} />
                            </div>
                            {/* Waveform bars */}
                            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 40 }}>
                                {[...Array(9)].map((_, i) => (
                                    <div key={i} style={{
                                        width: 8, height: 10 + Math.sin(frame / 2 + i * 1.1) * 20,
                                        backgroundColor: COLORS.primary,
                                    }} />
                                ))}
                            </div>
                        </div>
                    </Card>
                    <Label text="RECORD VIDEO" />
                </AbsoluteFill>
            </Sequence>
        </AbsoluteFill>
    );
};

const SceneAdvancedTools: React.FC = () => {
    return (
        <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
            {/* Scene Detection */}
            <Sequence from={0} durationInFrames={30}>
                <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                        {[0, 1, 2].map((i) => (
                            <Card key={i} width={200} height={140}>
                                <div style={{ fontSize: 40, color: i === 1 ? COLORS.primary : "#666" }}>
                                    {["A", "B", "C"][i]}
                                </div>
                            </Card>
                        ))}
                    </div>
                    <Label text="SCENE DETECTION" />
                </AbsoluteFill>
            </Sequence>

            {/* Motion Detection */}
            <Sequence from={30} durationInFrames={30}>
                <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
                    <Card width={500} height={350}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 45px)", gap: 10 }}>
                            {[...Array(24)].map((_, i) => {
                                const isMotion = [8, 9, 14, 15, 20, 21].includes(i);
                                return (
                                    <div key={i} style={{
                                        width: 45, height: 45,
                                        borderRadius: 8,
                                        backgroundColor: isMotion ? COLORS.primary : "#333",
                                        opacity: isMotion ? 0.9 : 0.3,
                                        boxShadow: isMotion ? `0 0 10px ${COLORS.primary}44` : "none",
                                    }} />
                                );
                            })}
                        </div>
                    </Card>
                    <Label text="MOTION DETECTION" />
                </AbsoluteFill>
            </Sequence>

            {/* Remove Background */}
            <Sequence from={60} durationInFrames={30}>
                <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                        {/* Before: green screen */}
                        <Card width={250} height={300}>
                            <div style={{
                                width: 180, height: 230,
                                borderRadius: 15,
                                backgroundColor: "#00cc44",
                                display: "flex", justifyContent: "center", alignItems: "center",
                            }}>
                                <div style={{ width: 90, height: 140, borderRadius: 10, backgroundColor: "#333" }} />
                            </div>
                        </Card>
                        <div style={{ fontSize: 50, color: COLORS.primary }}>→</div>
                        {/* After: transparent */}
                        <Card width={250} height={300}>
                            <div style={{
                                width: 180, height: 230,
                                borderRadius: 15,
                                overflow: "hidden",
                                position: "relative",
                            }}>
                                <div style={{
                                    position: "absolute", inset: 0,
                                    backgroundImage: `
                                        linear-gradient(45deg, #666 25%, transparent 25%),
                                        linear-gradient(-45deg, #666 25%, transparent 25%),
                                        linear-gradient(45deg, transparent 75%, #666 75%),
                                        linear-gradient(-45deg, transparent 75%, #666 75%)
                                    `,
                                    backgroundSize: "20px 20px",
                                    backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
                                }} />
                                <div style={{
                                    position: "absolute", inset: 0,
                                    display: "flex", justifyContent: "center", alignItems: "center",
                                }}>
                                    <div style={{ width: 90, height: 140, borderRadius: 10, backgroundColor: "#333" }} />
                                </div>
                            </div>
                        </Card>
                    </div>
                    <Label text="REMOVE BACKGROUND" />
                </AbsoluteFill>
            </Sequence>

            {/* Track Manager */}
            <Sequence from={90} durationInFrames={30}>
                <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
                    <Card width={600} height={300}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 15, width: "80%" }}>
                            {[
                                { color: COLORS.primary, w: "100%" },
                                { color: "#ff6644", w: "75%" },
                                { color: "#4488ff", w: "60%" },
                            ].map((track, i) => (
                                <div key={i} style={{
                                    width: track.w, height: 45,
                                    backgroundColor: track.color,
                                    borderRadius: 10,
                                    boxShadow: `0 0 15px ${track.color}33`,
                                }} />
                            ))}
                        </div>
                    </Card>
                    <Label text="TRACK MANAGER" />
                </AbsoluteFill>
            </Sequence>

            {/* Playlist */}
            <Sequence from={120} durationInFrames={30}>
                <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
                    <Card width={500} height={350}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "80%" }}>
                            {[0, 1, 2].map((i) => (
                                <div key={i} style={{
                                    height: 60,
                                    backgroundColor: i === 0 ? COLORS.primary : "#333",
                                    borderRadius: 12,
                                    boxShadow: i === 0 ? `0 0 15px ${COLORS.primary}33` : "none",
                                }} />
                            ))}
                        </div>
                    </Card>
                    <Label text="PLAYLIST & FRAME STEP" />
                </AbsoluteFill>
            </Sequence>
        </AbsoluteFill>
    );
};

const Scene4Privacy: React.FC = () => {
    const frame = useCurrentFrame();
    
    const shieldOpacity = interpolate(frame, [0, 20], [0, 1]);
    const shieldScale = interpolate(frame, [0, 20], [0.8, 1]);

    return (
        <AbsoluteFill style={{ backgroundColor: COLORS.dark, justifyContent: "center", alignItems: "center" }}>
             <div style={{
                 width: 500, height: 500,
                 borderRadius: "50%",
                 border: `4px solid ${COLORS.primary}`,
                 display: "flex", justifyContent: "center", alignItems: "center",
                 opacity: shieldOpacity,
                 transform: `scale(${shieldScale})`,
                 boxShadow: `0 0 100px ${COLORS.primary}33`
             }}>
                 <Img src={staticFile(BUNNY)} style={{ width: 300 }} />
             </div>
             
             <div style={{ marginTop: 60, textAlign: "center" }}>
                 <h2 style={{ fontFamily: FONTS.heading, fontSize: 60, color: "white", margin: 0 }}>
                     POWERED BY <span style={{ color: COLORS.primary }}>MEDIABUNNY</span>
                 </h2>
                 <h3 style={{ fontFamily: FONTS.body, fontSize: 40, color: "#888", marginTop: 20 }}>
                     100% CLIENT-SIDE • NO UPLOADS
                 </h3>
             </div>
        </AbsoluteFill>
    );
};

const Scene5Outro: React.FC = () => {
    const frame = useCurrentFrame();
    const pulse = Math.sin(frame / 10) * 0.05 + 1;

    return (
        <AbsoluteFill style={{ backgroundColor: COLORS.background, justifyContent: "center", alignItems: "center" }}>
            <Img src={staticFile(LOGO)} style={{ width: 250, marginBottom: 50 }} />
            
            <div style={{
                backgroundColor: COLORS.primary,
                padding: "25px 100px",
                borderRadius: 60,
                transform: `scale(${pulse})`,
                boxShadow: `0 0 50px ${COLORS.primary}66`
            }}>
                <h1 style={{ fontFamily: FONTS.heading, fontSize: 50, color: COLORS.background, margin: 0 }}>
                    LAUNCH PLAYER
                </h1>
            </div>
            
            <p style={{ fontFamily: FONTS.body, fontSize: 30, color: "#666", marginTop: 50 }}>
                voidall.com/JellyJump
            </p>
        </AbsoluteFill>
    );
};

// ============================================
// TRANSITIONS & COMPOSITION
// ============================================

const FadeTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const frame = useCurrentFrame();
    const { durationInFrames } = useVideoConfig();
    
    const opacity = interpolate(
        frame,
        [0, 15, durationInFrames - 15, durationInFrames],
        [0, 1, 1, 0]
    );

    return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

export const JellyJumpFullAd: React.FC = () => {
    return (
        <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
            <Series>
                <Series.Sequence durationInFrames={100}>
                    <FadeTransition><Scene1Intro /></FadeTransition>
                </Series.Sequence>
                <Series.Sequence durationInFrames={120}>
                    <FadeTransition><Scene2PlayerFeatures /></FadeTransition>
                </Series.Sequence>
                <Series.Sequence durationInFrames={150}>
                    <FadeTransition><Scene3EditTools /></FadeTransition>
                </Series.Sequence>
                <Series.Sequence durationInFrames={120}>
                    <FadeTransition><SceneStreamRecord /></FadeTransition>
                </Series.Sequence>
                <Series.Sequence durationInFrames={150}>
                    <FadeTransition><SceneAdvancedTools /></FadeTransition>
                </Series.Sequence>
                <Series.Sequence durationInFrames={100}>
                    <FadeTransition><Scene4Privacy /></FadeTransition>
                </Series.Sequence>
                <Series.Sequence durationInFrames={120}>
                    <FadeTransition><Scene5Outro /></FadeTransition>
                </Series.Sequence>
            </Series>
        </AbsoluteFill>
    );
};
