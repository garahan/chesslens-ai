import { Camera, ImagePlus, SlidersHorizontal } from "lucide-react";
export function FloatingActions({
  onGallery,
  onCamera,
  onMore,
}: {
  onGallery: () => void;
  onCamera: () => void;
  onMore: () => void;
}) {
  return (
    <nav className="action-dock" aria-label="Quick tools">
      <button aria-label="Choose another image" onClick={onGallery}>
        <ImagePlus size={20} />
        <span>Image</span>
      </button>
      <button aria-label="Open camera" onClick={onCamera}>
        <Camera size={20} />
        <span>Camera</span>
      </button>
      <button aria-label="More tools" onClick={onMore}>
        <SlidersHorizontal size={20} />
        <span>Tools</span>
      </button>
    </nav>
  );
}
