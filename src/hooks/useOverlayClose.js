import { useRef } from 'react';

/**
 * The props of a modal's full-screen backdrop, so a click beside the box closes it (the owner's ask,
 * R3-010), as the kit's Dialog closes on its overlay: only a press that both starts and ends on the
 * backdrop itself counts — a click inside the box bubbles up with another target, and selecting text
 * inside, then releasing outside, must not throw the modal away.
 */
export function useOverlayClose(onClose) {
  const pressedOnOverlay = useRef(false);
  return {
    onPointerDown: (event) => { pressedOnOverlay.current = event.target === event.currentTarget; },
    onClick: (event) => {
      if (pressedOnOverlay.current && event.target === event.currentTarget) onClose();
      pressedOnOverlay.current = false;
    },
  };
}
