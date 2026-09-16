import { useEffect } from 'react';
import { oversizedPhotos, smallerPhoto, withPhotoReplaced } from '@/utils/smallerPhotos';

/**
 * Each photo in the résumé store saved at camera size by an older build replaced by its smaller
 * copy once that is made (smallerPhotos.js): after the store loads, and whenever a résumé comes in
 * with one. It runs on every change of `resumes`, so it asks only for the photos still too large:
 * the copy is made once a session and shared, and one no copy can be made of answers at once.
 */
export function useSmallerPhotos(resumes, setAppState) {
  useEffect(() => {
    for (const src of oversizedPhotos(resumes)) {
      smallerPhoto(src).then((copy) => {
        if (copy) setAppState((prev) => withPhotoReplaced(prev, src, copy));
      });
    }
  }, [resumes, setAppState]);
}
