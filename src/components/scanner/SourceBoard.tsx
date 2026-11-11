import type { BoardCrop } from "../../duolingo";

/** Show the actual imported pixels, without sending the image to a server. */
export function SourceBoard({
  image,
  crop,
  square,
  orientation = "white",
  sourceOrientation = "white",
}: {
  image: string;
  crop: BoardCrop;
  square?: string;
  orientation?: "white" | "black";
  sourceOrientation?: "white" | "black";
}) {
  let { x, y, size } = crop;
  if (square) {
    const canonical =
      (8 - Number(square[1])) * 8 + "abcdefgh".indexOf(square[0]);
    const visual = sourceOrientation === "black" ? 63 - canonical : canonical;
    size = crop.size / 8;
    x += (visual % 8) * size;
    y += Math.floor(visual / 8) * size;
  }
  return (
    <svg
      className={square ? "source-square" : "source-board"}
      viewBox={`${x} ${y} ${size} ${size}`}
      role="img"
      aria-label={
        square
          ? `Original screenshot square ${square}`
          : "Original screenshot board"
      }
    >
      <image
        href={image}
        width={crop.imageWidth}
        height={crop.imageHeight}
        transform={
          !square && orientation !== sourceOrientation
            ? `rotate(180 ${x + size / 2} ${y + size / 2})`
            : undefined
        }
      />
    </svg>
  );
}
