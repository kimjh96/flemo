# Chrome presentation-pipeline falsifications

All of these were measured ineffective against layer-1:

- Driver choice: compiled vs player.
- Every easing shape: snap, governor, 60Hz cadence-lock, bezier.
- Every warm variant: per-transition, interaction, permanent 1px, fullscreen.
- Keepalive rAF on/off.
- `canvas.captureStream` video and real hardware-decoded h264 video.
- The CADisplayLink flag.
- Page-side present-timing compensation: future present times are unknowable.

The VRR-area hypothesis is dead: animation existence requests VRR max-rate regardless of area. Permanent 1px warming already requested it, and tremble persisted.

One warm survived falsification and shipped: never-stopping keepalive rAF for compiled Blink transitions. An on/off per-transition loop barely helped; the permanent loop was device-confirmed. It steadies pacing but does not fix layer-1.
