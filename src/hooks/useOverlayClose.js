import { useRef } from 'react';

/**
 * The props of a modal's full-screen backdrop, so a click beside the box closes it (the owner's ask,
 * R3-010), as the kit's Dialog closes on its overlay: only a press that both starts and ends on the
 * backdrop itself counts — a click inside the box bubbles up with another target; selecting text
 * inside, then releasing outside, must not throw the modal away; nor must a drag begun beside the box
 * and released inside it, whose click the browser sends to the backdrop (the two ends' common ancestor).
 */
export function useOverlayClose(onClose) {
  const pressedOnOverlay = useRef(false);
  const releasedInside = useRef(false);
  return {
    onPointerDown: (event) => {
      pressedOnOverlay.current = event.target === event.currentTarget;
      releasedInside.current = false;
    },
    onPointerUp: (event) => { releasedInside.current = event.target !== event.currentTarget; },
    onClick: (event) => {
      if (pressedOnOverlay.current && !releasedInside.current && event.target === event.currentTarget) onClose();
      pressedOnOverlay.current = false;
      releasedInside.current = false;
    },
  };
}
