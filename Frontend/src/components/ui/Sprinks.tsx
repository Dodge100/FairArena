"use client";
import React, { useId } from "react";
import { useEffect, useState } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import type { Container, SingleOrMultiple } from "@tsparticles/engine";
import { loadSlim } from "@tsparticles/slim";
import { cn } from "../../libs/utils";
import { motion, useAnimation } from "motion/react";
import { useTheme } from "../../theme-context"; // ⭐ IMPORT THE THEME

type ParticlesProps = {
  id?: string;
  className?: string;
  background?: string;
  minSize?: number;
  maxSize?: number;
  speed?: number;
  particleDensity?: number;
};

export const SparklesCore = (props: ParticlesProps) => {
  const {
    id,
    className,
    background,
    minSize,
    maxSize,
    speed,
    particleDensity,
  } = props;

  const { theme } = useTheme(); // ⭐ GET THE CURRENT THEME

  // ⭐ NEON COLOR FOR LIGHT  
  // ⭐ SOFT WHITE FOR DARK  
  const particleColor = theme === "light" ? "#d9ff00" : "#ffffff";

  const [init, setInit] = useState(false);

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    }).then(() => setInit(true));
  }, []);

  const controls = useAnimation();

  const particlesLoaded = async (container?: Container) => {
    if (container) {
      controls.start({
        opacity: 1,
        transition: { duration: 1 },
      });
    }
  };

  const generatedId = useId();

  return (
    <motion.div animate={controls} className={cn("opacity-0", className)}>
      {init && (
        <Particles
          id={id || generatedId}
          className="h-full w-full"
          particlesLoaded={particlesLoaded}
          options={{
            background: {
              color: {
                value: background || "transparent",
              },
            },
            fullScreen: {
              enable: false,
              zIndex: 1,
            },

            fpsLimit: 120,
            interactivity: {
              events: {
                onClick: { enable: true, mode: "push" },
                resize: { enable: true },
              },
              modes: {
                push: { quantity: 4 },
              },
            },

            particles: {
              color: {
                value: particleColor, // ⭐ THEME-AWARE COLOR
              },

              number: {
                density: {
                  enable: true,
                  width: 400,
                  height: 400,
                },
                value: particleDensity || 120,
              },

              opacity: {
                value: { min: 0.1, max: 1 },
                animation: {
                  enable: true,
                  speed: speed || 4,
                },
              },

              shape: {
                type: "circle",
              },

              size: {
                value: { min: minSize || 1, max: maxSize || 3 },
              },

              move: {
                enable: true,
                speed: { min: 0.1, max: 1 },
                direction: "none",
                outModes: { default: "out" },
              },
            },

            detectRetina: true,
          }}
        />
      )}
    </motion.div>
  );
};
