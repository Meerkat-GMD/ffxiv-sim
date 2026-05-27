import {
  useEffect,
  useRef,
  type Dispatch,
  type KeyboardEvent,
  type MouseEvent,
  type SetStateAction,
} from 'react';
import {
  clampPointToCircle,
  normalize,
  type Point,
} from '../sim/geometry';
import { type Player } from '../sim/players';
import { type Role } from '../sim/roles';
import { type ActiveTelegraph, type ResolvedEffect } from '../sim/timeline';
import { type MarkerAsset } from './MarkerTray';

const CANVAS_SIZE = 720;
const ARENA_RADIUS = 180;
const TOKEN_RADIUS = 12;
const MARKER_RADIUS = 8;
const MOVE_UNITS_PER_SECOND = 180;
const MAX_FRAME_SECONDS = 0.05;

type MovementKey = 'up' | 'down' | 'left' | 'right';

const MOVEMENT_CODES: Record<string, MovementKey> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
};

const MOVEMENT_VECTORS: Record<MovementKey, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

type ArenaCanvasProps = {
  activeTelegraphs?: ActiveTelegraph[];
  players: Player[];
  controlledRole: Role | undefined;
  onMoveControlledRole?: (role: Role, position: Point) => void;
  onMoveMarker?: (markerId: string, position: Point) => void;
  onPlaceMarker?: (position: Point) => void;
  placedMarkers?: PlacedMarker[];
  resolvedEffects?: ResolvedEffect[];
  selectedMarker?: MarkerAsset;
  setPlayers: Dispatch<SetStateAction<Player[]>>;
  timelineTime?: number;
};

export type PlacedMarker = {
  asset: MarkerAsset;
  id: string;
  position: Point;
};

type CanvasRect = Pick<DOMRect, 'height' | 'left' | 'top' | 'width'>;

export function movementKeyFromEventCode(
  code: string,
): MovementKey | undefined {
  return MOVEMENT_CODES[code];
}

export function movementVectorFromKeys(keys: ReadonlySet<MovementKey>): Point {
  const direction = Array.from(keys).reduce<Point>(
    (total, key) => ({
      x: total.x + MOVEMENT_VECTORS[key].x,
      y: total.y + MOVEMENT_VECTORS[key].y,
    }),
    { x: 0, y: 0 },
  );

  if (direction.x === 0 && direction.y === 0) {
    return direction;
  }

  return normalize(direction);
}

export function moveControlledPlayer(
  players: Player[],
  controlledRole: Role | undefined,
  delta: Point,
  arenaRadius = ARENA_RADIUS,
  tokenRadius = TOKEN_RADIUS,
): Player[] {
  if (!controlledRole || (delta.x === 0 && delta.y === 0)) {
    return players;
  }

  return players.map((player) => {
    if (player.role !== controlledRole) {
      return player;
    }

    const nextPosition = clampPointToCircle(
      {
        x: player.position.x + delta.x,
        y: player.position.y + delta.y,
      },
      { x: 0, y: 0 },
      arenaRadius,
      tokenRadius,
    );

    return {
      ...player,
      position: nextPosition,
    };
  });
}

export function canvasClientPointToArenaPoint(
  point: { clientX: number; clientY: number },
  rect: CanvasRect,
): Point {
  const center = CANVAS_SIZE / 2;
  const arenaPixelRadius = CANVAS_SIZE * 0.39;
  const scale = arenaPixelRadius / ARENA_RADIUS;
  const canvasX = ((point.clientX - rect.left) / rect.width) * CANVAS_SIZE;
  const canvasY = ((point.clientY - rect.top) / rect.height) * CANVAS_SIZE;

  return clampPointToCircle(
    {
      x: (canvasX - center) / scale,
      y: (canvasY - center) / scale,
    },
    { x: 0, y: 0 },
    ARENA_RADIUS,
    MARKER_RADIUS,
  );
}

export function arenaPointToCanvasPercent(position: Point) {
  const center = CANVAS_SIZE / 2;
  const arenaPixelRadius = CANVAS_SIZE * 0.39;
  const scale = arenaPixelRadius / ARENA_RADIUS;

  return {
    left: ((center + position.x * scale) / CANVAS_SIZE) * 100,
    top: ((center + position.y * scale) / CANVAS_SIZE) * 100,
  };
}

export function ArenaCanvas({
  activeTelegraphs = [],
  players,
  controlledRole,
  onMoveControlledRole,
  onMoveMarker,
  onPlaceMarker,
  placedMarkers = [],
  resolvedEffects = [],
  selectedMarker,
  setPlayers,
  timelineTime = 0,
}: ArenaCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pressedKeysRef = useRef<Set<MovementKey>>(new Set());
  const draggingMarkerIdRef = useRef<string | undefined>(undefined);
  const lastFrameRef = useRef<number | undefined>(undefined);

  function clearInteractionState() {
    pressedKeysRef.current.clear();
    draggingMarkerIdRef.current = undefined;
  }

  useEffect(() => {
    window.addEventListener('blur', clearInteractionState);

    return () => {
      window.removeEventListener('blur', clearInteractionState);
    };
  }, []);

  useEffect(() => {
    function handleWindowMouseMove(event: globalThis.MouseEvent) {
      const markerId = draggingMarkerIdRef.current;
      const canvas = canvasRef.current;

      if (!markerId || !canvas || !onMoveMarker) {
        return;
      }

      onMoveMarker(
        markerId,
        canvasClientPointToArenaPoint(
          { clientX: event.clientX, clientY: event.clientY },
          canvas.getBoundingClientRect(),
        ),
      );
    }

    function handleWindowMouseUp() {
      draggingMarkerIdRef.current = undefined;
    }

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      draggingMarkerIdRef.current = undefined;
    };
  }, [onMoveMarker]);

  useEffect(() => {
    let frameId = 0;

    const step = (timestamp: number) => {
      const lastFrame = lastFrameRef.current ?? timestamp;
      const elapsedSeconds = Math.min(
        (timestamp - lastFrame) / 1000,
        MAX_FRAME_SECONDS,
      );
      lastFrameRef.current = timestamp;

      const direction = movementVectorFromKeys(pressedKeysRef.current);

      if (direction.x !== 0 || direction.y !== 0) {
        setPlayers((currentPlayers) =>
          {
            const nextPlayers = moveControlledPlayer(currentPlayers, controlledRole, {
              x: direction.x * MOVE_UNITS_PER_SECOND * elapsedSeconds,
              y: direction.y * MOVE_UNITS_PER_SECOND * elapsedSeconds,
            });
            const movedPlayer = nextPlayers.find(
              (player) => player.role === controlledRole,
            );

            if (controlledRole && movedPlayer) {
              onMoveControlledRole?.(controlledRole, movedPlayer.position);
            }

            return nextPlayers;
          },
        );
      }

      frameId = window.requestAnimationFrame(step);
    };

    frameId = window.requestAnimationFrame(step);

    return () => {
      window.cancelAnimationFrame(frameId);
      clearInteractionState();
      lastFrameRef.current = undefined;
    };
  }, [controlledRole, onMoveControlledRole, setPlayers]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');

    if (!canvas || !context) {
      return;
    }

    drawArena(
      context,
      players,
      controlledRole,
      activeTelegraphs,
      resolvedEffects,
      timelineTime,
    );
  }, [activeTelegraphs, players, controlledRole, resolvedEffects, timelineTime]);

  function handleKeyDown(event: KeyboardEvent<HTMLCanvasElement>) {
    const movementKey = movementKeyFromEventCode(event.code);

    if (!movementKey) {
      return;
    }

    event.preventDefault();
    pressedKeysRef.current.add(movementKey);
  }

  function handleKeyUp(event: KeyboardEvent<HTMLCanvasElement>) {
    const movementKey = movementKeyFromEventCode(event.code);

    if (!movementKey) {
      return;
    }

    event.preventDefault();
    pressedKeysRef.current.delete(movementKey);
  }

  function handleMouseDown(event: MouseEvent<HTMLCanvasElement>) {
    event.currentTarget.focus();
  }

  function handleMarkerMouseDown(
    markerId: string,
    event: MouseEvent<HTMLImageElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();
    canvasRef.current?.focus();
    draggingMarkerIdRef.current = markerId;
  }

  function handleClick(event: MouseEvent<HTMLCanvasElement>) {
    if (!selectedMarker || !onPlaceMarker) {
      return;
    }

    onPlaceMarker(
      canvasClientPointToArenaPoint(
        { clientX: event.clientX, clientY: event.clientY },
        event.currentTarget.getBoundingClientRect(),
      ),
    );
  }

  return (
    <section className="arena-panel" aria-label="Arena canvas">
      <div className="arena-stage">
        <canvas
          aria-label="Circular arena with player positions"
          className="arena-canvas"
          height={CANVAS_SIZE}
          onBlur={clearInteractionState}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onMouseDown={handleMouseDown}
          ref={canvasRef}
          tabIndex={0}
          width={CANVAS_SIZE}
        >
          Arena canvas
        </canvas>
        <div className="placed-marker-layer" aria-label="Placed markers">
          {placedMarkers.map((marker) => {
            const position = arenaPointToCanvasPercent(marker.position);

            return (
              <img
                alt={`Placed ${marker.asset.alt}`}
                className="placed-marker"
                height="36"
                key={marker.id}
                onMouseDown={(event) => handleMarkerMouseDown(marker.id, event)}
                src={marker.asset.src}
                style={{
                  left: `${position.left}%`,
                  top: `${position.top}%`,
                }}
                width="36"
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function drawArena(
  context: CanvasRenderingContext2D,
  players: Player[],
  controlledRole: Role | undefined,
  activeTelegraphs: ActiveTelegraph[] = [],
  resolvedEffects: ResolvedEffect[] = [],
  timelineTime = 0,
) {
  const center = CANVAS_SIZE / 2;
  const arenaPixelRadius = CANVAS_SIZE * 0.39;
  const scale = arenaPixelRadius / ARENA_RADIUS;

  context.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  context.fillStyle = '#020617';
  context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  drawGrid(context, center, arenaPixelRadius);
  drawTicks(context, center, arenaPixelRadius);

  context.beginPath();
  context.arc(center, center, arenaPixelRadius, 0, Math.PI * 2);
  context.strokeStyle = '#fde047';
  context.lineWidth = 10;
  context.stroke();

  context.beginPath();
  context.arc(center, center, 11 * scale, 0, Math.PI * 2);
  context.fillStyle = '#ef4444';
  context.fill();
  context.lineWidth = 4;
  context.strokeStyle = '#f8fafc';
  context.stroke();

  drawTelegraphs(context, center, scale, activeTelegraphs);
  drawResolvedEffects(context, center, scale, resolvedEffects, timelineTime);

  for (const player of players) {
    const x = center + player.position.x * scale;
    const y = center + player.position.y * scale;
    const tokenRadius = TOKEN_RADIUS * scale;
    const isControlled = player.role === controlledRole;

    context.beginPath();
    context.arc(x, y, tokenRadius, 0, Math.PI * 2);
    context.fillStyle = player.color;
    context.fill();
    context.lineWidth = isControlled ? 7 : 4;
    context.strokeStyle = isControlled ? '#ffffff' : '#020617';
    context.stroke();

    if (isControlled) {
      context.beginPath();
      context.arc(x, y, tokenRadius + 8, 0, Math.PI * 2);
      context.lineWidth = 3;
      context.strokeStyle = '#fde047';
      context.stroke();
    }

    context.font = 'bold 24px Inter, ui-sans-serif, system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.lineWidth = 5;
    context.strokeStyle = '#020617';
    context.strokeText(player.role, x, y);
    context.fillStyle = '#f8fafc';
    context.fillText(player.role, x, y);
  }
}

function drawTelegraphs(
  context: CanvasRenderingContext2D,
  center: number,
  scale: number,
  telegraphs: ActiveTelegraph[],
) {
  for (const telegraph of telegraphs) {
    drawTelegraphShape(context, center, scale, telegraph);
    context.fillStyle = 'rgba(239, 68, 68, 0.22)';
    context.fill();
    context.lineWidth = 5;
    context.strokeStyle = 'rgba(248, 113, 113, 0.86)';
    context.stroke();
  }
}

function drawResolvedEffects(
  context: CanvasRenderingContext2D,
  center: number,
  scale: number,
  effects: ResolvedEffect[],
  timelineTime: number,
) {
  const recentEffects = effects.filter(
    (effect) =>
      effect.resolvedAt <= timelineTime && timelineTime - effect.resolvedAt <= 0.75,
  );

  for (const effect of recentEffects) {
    drawTelegraphShape(context, center, scale, effect);
    context.fillStyle = 'rgba(248, 113, 113, 0.42)';
    context.fill();
    context.lineWidth = 9;
    context.strokeStyle = 'rgba(254, 202, 202, 0.95)';
    context.stroke();
  }
}

function drawTelegraphShape(
  context: CanvasRenderingContext2D,
  center: number,
  scale: number,
  telegraph: ActiveTelegraph | ResolvedEffect,
) {
  const x = center + telegraph.position.x * scale;
  const y = center + telegraph.position.y * scale;
  const shape = telegraph.shape ?? {
    radius: telegraph.radius,
    shape: 'circle' as const,
  };

  context.beginPath();

  switch (shape.shape) {
    case 'circle':
    case 'stack':
      context.arc(x, y, shape.radius * scale, 0, Math.PI * 2);
      return;
    case 'donut':
      context.arc(x, y, shape.outerRadius * scale, 0, Math.PI * 2);
      context.arc(x, y, shape.innerRadius * scale, 0, Math.PI * 2, true);
      return;
    case 'line':
      context.save();
      context.translate(x, y);
      context.rotate((shape.rotation * Math.PI) / 180);
      context.rect(0, (-shape.width * scale) / 2, shape.length * scale, shape.width * scale);
      context.restore();
      return;
    case 'cone':
      context.moveTo(x, y);
      context.arc(
        x,
        y,
        shape.radius * scale,
        ((shape.rotation - shape.angle / 2) * Math.PI) / 180,
        ((shape.rotation + shape.angle / 2) * Math.PI) / 180,
      );
      context.lineTo(x, y);
      return;
  }
}

function drawGrid(
  context: CanvasRenderingContext2D,
  center: number,
  arenaPixelRadius: number,
) {
  context.save();
  context.beginPath();
  context.arc(center, center, arenaPixelRadius, 0, Math.PI * 2);
  context.clip();

  context.strokeStyle = '#1f2937';
  context.lineWidth = 2;

  const gridStep = arenaPixelRadius / 3;

  for (
    let offset = -arenaPixelRadius;
    offset <= arenaPixelRadius;
    offset += gridStep
  ) {
    context.beginPath();
    context.moveTo(center - arenaPixelRadius, center + offset);
    context.lineTo(center + arenaPixelRadius, center + offset);
    context.stroke();

    context.beginPath();
    context.moveTo(center + offset, center - arenaPixelRadius);
    context.lineTo(center + offset, center + arenaPixelRadius);
    context.stroke();
  }

  context.strokeStyle = '#64748b';
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(center - arenaPixelRadius, center);
  context.lineTo(center + arenaPixelRadius, center);
  context.moveTo(center, center - arenaPixelRadius);
  context.lineTo(center, center + arenaPixelRadius);
  context.stroke();

  context.restore();
}

function drawTicks(
  context: CanvasRenderingContext2D,
  center: number,
  arenaPixelRadius: number,
) {
  context.strokeStyle = '#f8fafc';
  context.lineWidth = 5;

  for (let index = 0; index < 16; index += 1) {
    const angle = (index / 16) * Math.PI * 2;
    const inner = arenaPixelRadius - (index % 4 === 0 ? 26 : 16);
    const outer = arenaPixelRadius + 2;

    context.beginPath();
    context.moveTo(
      center + Math.cos(angle) * inner,
      center + Math.sin(angle) * inner,
    );
    context.lineTo(
      center + Math.cos(angle) * outer,
      center + Math.sin(angle) * outer,
    );
    context.stroke();
  }
}
