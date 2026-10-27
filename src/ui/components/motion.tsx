// Motion setup shared by every surface. LazyMotion keeps the bundle to the DOM animation features;
// reduced motion follows the system unless the user forced it in Options (DESIGN.md Motion Tokens).

import { domAnimation, LazyMotion, MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';

/** DESIGN.md SPRING.snappy: toggle thumb, selection indicator. */
export const SPRING_SNAPPY = { type: 'spring', visualDuration: 0.18, bounce: 0 } as const;
/** DESIGN.md SPRING.ui: card dock, popovers. */
export const SPRING_UI = { type: 'spring', visualDuration: 0.25, bounce: 0.05 } as const;
/** DESIGN.md --ease-out. */
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export function MotionProvider({ reduce, children }: { reduce: boolean; children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion={reduce ? 'always' : 'user'}>{children}</MotionConfig>
    </LazyMotion>
  );
}
