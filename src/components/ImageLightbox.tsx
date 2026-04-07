import { useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

export type LightboxImage = { url: string; name: string };

type Props = {
  images: LightboxImage[];
  index: number;
  onClose: () => void;
  onNav: (next: number) => void;
};

export function ImageLightbox({ images, index, onClose, onNav }: Props) {
  const hasPrev = index > 0;
  const hasNext = index < images.length - 1;
  const current = images[index];

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowLeft' && hasPrev) onNav(index - 1);
    if (e.key === 'ArrowRight' && hasNext) onNav(index + 1);
  }, [onClose, onNav, index, hasPrev, hasNext]);

  useEffect(() => {
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  return (
    <div className="lb-backdrop" onClick={onClose}>
      {/* Close */}
      <button className="lb-close" onClick={onClose} title="Close (Esc)">
        <X size={20} />
      </button>

      {/* Prev */}
      {hasPrev && (
        <button
          className="lb-arrow lb-arrow--left"
          onClick={(e) => { e.stopPropagation(); onNav(index - 1); }}
          title="Previous"
        >
          <ChevronLeft size={28} />
        </button>
      )}

      {/* Image */}
      <div className="lb-img-wrap" onClick={(e) => e.stopPropagation()}>
        <img
          key={current.url}
          src={current.url}
          alt={current.name}
          className="lb-img"
        />
        {current.name && (
          <div className="lb-caption">
            {images.length > 1 && (
              <span className="lb-counter">{index + 1} / {images.length}</span>
            )}
            <span className="lb-name">{current.name}</span>
          </div>
        )}
      </div>

      {/* Next */}
      {hasNext && (
        <button
          className="lb-arrow lb-arrow--right"
          onClick={(e) => { e.stopPropagation(); onNav(index + 1); }}
          title="Next"
        >
          <ChevronRight size={28} />
        </button>
      )}

      {/* Dot indicators */}
      {images.length > 1 && (
        <div className="lb-dots" onClick={(e) => e.stopPropagation()}>
          {images.map((_, i) => (
            <button
              key={i}
              className={`lb-dot${i === index ? ' lb-dot--active' : ''}`}
              onClick={() => onNav(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
