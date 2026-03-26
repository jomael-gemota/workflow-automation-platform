import { memo } from 'react';
import {
  getBezierPath,
  EdgeLabelRenderer,
  type EdgeProps,
} from '@xyflow/react';

export type EdgeExecutionStatus = 'idle' | 'waiting' | 'flowing' | 'success' | 'failure' | 'skipped';

interface ExecutionEdgeData extends Record<string, unknown> {
  executionStatus?: EdgeExecutionStatus;
  label?: string;
}

// ── Colour palette ──────────────────────────────────────────────
// "idle"    — slate-400: clearly readable on the dark canvas
// "waiting" — slate-500: dimmer than idle, signalling "about to start"
// "skipped" — slate-500: same hue as waiting but indicates branch not taken
const COLORS = {
  idle:    '#94a3b8',   // slate-400
  waiting: '#64748b',   // slate-500  — pre-execution dim
  flowing: '#3b82f6',   // blue-500
  success: '#22c55e',   // green-500
  failure: '#ef4444',   // red-500
  skipped: '#64748b',   // slate-500
} satisfies Record<EdgeExecutionStatus, string>;

// ── Base-line opacity per status ─────────────────────────────────
const BASE_OPACITY: Record<EdgeExecutionStatus, number> = {
  idle:    0.65,
  waiting: 0.30,   // noticeably dimmer — matches the dimmed node opacity
  flowing: 0.15,   // near-invisible — the sweep is the focal element
  success: 1,
  failure: 1,
  skipped: 0.45,
};

const BASE_WIDTH: Record<EdgeExecutionStatus, number> = {
  idle:    1.5,
  waiting: 1.5,
  flowing: 1.5,
  success: 2.5,
  failure: 2.5,
  skipped: 1.5,
};

export const ExecutionEdge = memo(function ExecutionEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeProps) {
  const d = data as ExecutionEdgeData | undefined;
  const status: EdgeExecutionStatus = d?.executionStatus ?? 'idle';

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const color        = COLORS[status];
  const baseOpacity  = BASE_OPACITY[status];
  const baseWidth    = BASE_WIDTH[status];
  const isFlowing    = status === 'flowing';
  const isSuccess    = status === 'success';
  const isFailure    = status === 'failure';

  return (
    <>
      {/*
        ── 1. Base path ───────────────────────────────────────────────
        Always rendered.  CSS transitions smoothly shift the colour and
        opacity when status changes (e.g. flowing→success).
      */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={color}
        strokeWidth={baseWidth}
        strokeOpacity={baseOpacity}
        markerEnd={markerEnd}
        style={{
          transition:
            'stroke 0.55s ease, stroke-opacity 0.55s ease, stroke-width 0.3s ease',
        }}
      />

      {/*
        ── 2. Progress-bar sweep (flowing only) ───────────────────────
        Uses pathLength="1" so stroke-dashoffset values are normalised
        to [0, 1] regardless of the actual curve length.
        The keyframe animates dashoffset 1→0 (source→target fill) and
        fades opacity in/out at the edges so the loop restart is
        invisible — giving a seamless, repeating progress-bar effect.
      */}
      {isFlowing && (
        <>
          {/* soft glow halo behind the sweep so it "lifts" off the canvas */}
          <path
            d={edgePath}
            fill="none"
            stroke={COLORS.flowing}
            strokeWidth={9}
            strokeOpacity={0.12}
            style={{ pointerEvents: 'none' }}
          />
          {/* the actual progress bar */}
          <path
            d={edgePath}
            fill="none"
            stroke={COLORS.flowing}
            strokeWidth={3}
            strokeLinecap="round"
            pathLength={1}
            className="edge-progress-sweep"
            style={{ pointerEvents: 'none' }}
          />
        </>
      )}

      {/*
        ── 3. Completion glow (success / failure) ────────────────────
        A soft halo that appears after the sweep finishes and the base
        line has transitioned to its final colour.
      */}
      {(isSuccess || isFailure) && (
        <path
          d={edgePath}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeOpacity={0.1}
          style={{
            pointerEvents: 'none',
            transition: 'stroke 0.55s ease, stroke-opacity 0.55s ease',
          }}
        />
      )}

      {/* ── 4. Optional label ──────────────────────────────────────── */}
      {d?.label && (
        <EdgeLabelRenderer>
          <span
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              fontSize: 9,
              fontWeight: 600,
              color,
              background: '#0f172a',
              padding: '1px 4px',
              borderRadius: 3,
              border: `1px solid ${color}44`,
              pointerEvents: 'none',
              transition: 'color 0.55s ease',
            }}
            className="nodrag nopan"
          >
            {String(d.label)}
          </span>
        </EdgeLabelRenderer>
      )}
    </>
  );
});
