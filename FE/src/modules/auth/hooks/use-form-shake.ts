import { useState } from 'react';

/**
 * Shakes a form once (`auth-shake` in index.css, skipped for reduced motion) when a submit fails:
 * call `shake()` on invalid input or an API error, spread `shakeProps` on the `<form>`.
 */
export const useFormShake = () => {
  const [shaking, setShaking] = useState(false);
  return {
    shake: () => setShaking(true),
    shakeProps: {
      className: shaking ? 'auth-shake' : '',
      onAnimationEnd: () => setShaking(false),
    },
  };
};
