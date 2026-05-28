// 流体渐变 blob 背景

import { useEffect, useRef } from 'preact/hooks';

export function FluidBlobs() {
  const blob1Ref = useRef(null);
  const blob2Ref = useRef(null);
  const blob3Ref = useRef(null);

  useEffect(() => {
    let animId;

    function animate() {
      animId = requestAnimationFrame(animate);
      const t = Date.now() / 1000;

      if (blob1Ref.current) {
        blob1Ref.current.style.transform = `translate(${Math.sin(t * 0.3) * 30}px, ${Math.cos(t * 0.4) * 20}px) scale(${1 + Math.sin(t * 0.5) * 0.1})`;
      }
      if (blob2Ref.current) {
        blob2Ref.current.style.transform = `translate(${Math.cos(t * 0.35) * 25}px, ${Math.sin(t * 0.45) * 30}px) scale(${1 + Math.cos(t * 0.6) * 0.08})`;
      }
      if (blob3Ref.current) {
        blob3Ref.current.style.transform = `translate(${Math.sin(t * 0.4) * 20}px, ${Math.cos(t * 0.35) * 25}px) scale(${1 + Math.sin(t * 0.55) * 0.12})`;
      }
    }
    animate();

    return () => { if (animId) cancelAnimationFrame(animId); };
  }, []);

  return (
    <div class="fluid-blobs">
      <div ref={blob1Ref} class="fluid-blob blob-1" />
      <div ref={blob2Ref} class="fluid-blob blob-2" />
      <div ref={blob3Ref} class="fluid-blob blob-3" />
    </div>
  );
}
