'use client';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';

/** FPS from the frame callback. This is an approximation, not a GPU profiler. */
export default function WorldPerformance({ onSample }: { onSample: (fps: number) => void }) {
  const seconds = useRef(0);
  const frames = useRef(0);
  useFrame((_state, delta) => {
    if (!Number.isFinite(delta) || delta <= 0) return;
    seconds.current += delta;
    frames.current += 1;
    if (seconds.current < 1.35) return;
    const fps = Math.round(frames.current / seconds.current);
    frames.current = 0;
    seconds.current = 0;
    onSample(fps);
  });
  return null;
}
