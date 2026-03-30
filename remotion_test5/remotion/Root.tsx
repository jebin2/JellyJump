import React from "react";
import { Composition } from "remotion";
import { JellyJumpAd } from "./compositions/JellyJumpAd";
import { JellyJumpVisualAd } from "./compositions/JellyJumpVisualAd";
import { JellyJumpMinimalAd } from "./compositions/JellyJumpMinimalAd";
import { JellyJumpFastAd } from "./compositions/JellyJumpFastAd";
import { JellyJumpFullAd } from "./compositions/JellyJumpFullAd";
import { JellyJumpActionAd } from "./compositions/JellyJumpActionAd";
import "./style.css";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="JellyJumpAd"
        component={JellyJumpAd}
        durationInFrames={345} // 11.5 seconds * 30 fps
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="JellyJumpVisualAd"
        component={JellyJumpVisualAd}
        durationInFrames={330} // 11 seconds * 30 fps
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="JellyJumpMinimalAd"
        component={JellyJumpMinimalAd}
        durationInFrames={295} // ~10 seconds
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="JellyJumpFastAd"
        component={JellyJumpFastAd}
        durationInFrames={240} // 8 seconds
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="JellyJumpFullAd"
        component={JellyJumpFullAd}
        durationInFrames={860} // ~29 seconds
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="JellyJumpActionAd"
        component={JellyJumpActionAd}
        durationInFrames={605} // ~20 seconds
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};