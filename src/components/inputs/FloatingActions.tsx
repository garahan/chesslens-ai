import { Camera, ImagePlus } from "lucide-react";
export function FloatingActions({
  onGallery,
  onCamera,
}: {
  onGallery: () => void;
  onCamera: () => void;
}) {
  return (
    <div className="floating-actions">
      <button aria-label="Choose another image" onClick={onGallery}>
        <ImagePlus size={23} />
      </button>
      <button aria-label="Open camera" onClick={onCamera}>
        <Camera size={23} />
      </button>
    </div>
  );
}
