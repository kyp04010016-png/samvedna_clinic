import React from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number;
  onChange?: (newRating: number) => void;
  readonly?: boolean;
  size?: number;
}

export const StarRating: React.FC<StarRatingProps> = ({
  rating,
  onChange,
  readonly = false,
  size = 20,
}) => {
  return (
    <div className="inline-flex items-center gap-1" role="group" aria-label={`Rating: ${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= rating;
        if (readonly) {
          return (
            <Star
              key={star}
              size={size}
              className={filled ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}
            />
          );
        }
        return (
          <button
            key={star}
            type="button"
            onClick={() => onChange && onChange(star)}
            className="p-1 rounded hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-green-600 transition-transform active:scale-95"
            aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
          >
            <Star
              size={size}
              className={
                filled
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-slate-300 hover:text-amber-300'
              }
            />
          </button>
        );
      })}
    </div>
  );
};
