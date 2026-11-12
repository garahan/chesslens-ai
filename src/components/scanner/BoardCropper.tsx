import { useRef, useState, type PointerEvent } from "react";
import { Modal } from "../layout/Modal";
import type { BoardCrop } from "../../duolingo";
export function BoardCropper({
  image,
  initial,
  onApply,
  onCancel,
}: {
  image: string;
  initial?: BoardCrop;
  onApply: (crop: BoardCrop) => void;
  onCancel: () => void;
}) {
  const [dimensions, setDimensions] = useState({ width: 1, height: 1 });
  const [crop, setCrop] = useState({ x: 0, y: 0, size: 1 });
  const area = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    x: number;
    y: number;
    crop: typeof crop;
    resize: boolean;
  } | null>(null);
  const bound = (value: typeof crop) => {
    const size = Math.max(
      Math.min(dimensions.width, dimensions.height) * 0.2,
      Math.min(value.size, dimensions.width, dimensions.height),
    );
    return {
      size,
      x: Math.max(0, Math.min(value.x, dimensions.width - size)),
      y: Math.max(0, Math.min(value.y, dimensions.height - size)),
    };
  };
  const start = (event: PointerEvent<HTMLElement>, resize = false) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, crop, resize };
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || !area.current) return;
    const scale = dimensions.width / area.current.getBoundingClientRect().width;
    const dx = (event.clientX - drag.current.x) * scale,
      dy = (event.clientY - drag.current.y) * scale;
    setCrop(
      bound(
        drag.current.resize
          ? {
              ...drag.current.crop,
              size: drag.current.crop.size + (dx + dy) / 2,
            }
          : {
              ...drag.current.crop,
              x: drag.current.crop.x + dx,
              y: drag.current.crop.y + dy,
            },
      ),
    );
  };
  return (
    <Modal label="Adjust board crop" onDismiss={onCancel}>
      <section className="modal crop-dialog">
        <div className="modal-heading">
          <h2>Align the board</h2>
          <button className="text-button" onClick={onCancel}>
            Cancel
          </button>
        </div>
        <p>
          Drag the box over the board. Use the corner to fit all 64 squares,
          keeping the characters and buttons outside.
        </p>
        <div
          ref={area}
          className="crop-image-area"
          style={{
            width: `min(100%, calc(50svh * ${dimensions.width / dimensions.height}))`,
          }}
          onPointerMove={move}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
        >
          <img
            src={image}
            alt="Screenshot for board cropping"
            draggable={false}
            onLoad={(event) => {
              const { naturalWidth: width, naturalHeight: height } =
                event.currentTarget;
              setDimensions({ width, height });
              setCrop(
                initial
                  ? { x: initial.x, y: initial.y, size: initial.size }
                  : {
                      x: (width - Math.min(width, height) * 0.95) / 2,
                      y: (height - Math.min(width, height) * 0.95) / 2,
                      size: Math.min(width, height) * 0.95,
                    },
              );
            }}
          />
          <div
            className="crop-box"
            style={{
              left: `${(crop.x / dimensions.width) * 100}%`,
              top: `${(crop.y / dimensions.height) * 100}%`,
              width: `${(crop.size / dimensions.width) * 100}%`,
              height: `${(crop.size / dimensions.height) * 100}%`,
            }}
            onPointerDown={(event) => start(event)}
          >
            <svg viewBox="0 0 8 8" aria-hidden="true">
              {Array.from({ length: 7 }, (_, i) => (
                <g key={i}>
                  <path d={`M${i + 1} 0V8M0 ${i + 1}H8`} />
                </g>
              ))}
            </svg>
            <button
              className="crop-resize"
              aria-label="Drag to resize board crop"
              onPointerDown={(event) => start(event, true)}
            >
              ↘
            </button>
          </div>
        </div>
        <div className="crop-sliders">
          {(
            [
              {
                key: "x",
                label: "Horizontal position",
                max: dimensions.width - crop.size,
              },
              {
                key: "y",
                label: "Vertical position",
                max: dimensions.height - crop.size,
              },
              {
                key: "size",
                label: "Board size",
                max: Math.min(dimensions.width, dimensions.height),
              },
            ] as const
          ).map(({ key, label, max }) => (
            <label key={key}>
              {label}
              <input
                aria-label={label}
                type="range"
                min={
                  key === "size"
                    ? Math.min(dimensions.width, dimensions.height) * 0.2
                    : 0
                }
                max={Math.max(1, max)}
                step="0.5"
                value={crop[key]}
                onChange={(event) =>
                  setCrop(bound({ ...crop, [key]: Number(event.target.value) }))
                }
              />
            </label>
          ))}
        </div>
        <button
          className="primary"
          onClick={() =>
            onApply({
              ...bound(crop),
              imageWidth: dimensions.width,
              imageHeight: dimensions.height,
            })
          }
        >
          Recognize this board
        </button>
      </section>
    </Modal>
  );
}
