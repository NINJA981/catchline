// Disclosure adapted from @motion-primitives/disclosure (shadcn registry, MIT) and restyled to the
// Catchline tokens: a real button with aria-expanded/aria-controls, height and opacity animated with
// the 250ms ease-out from DESIGN.md (--dur-4), and no animation under reduced motion.

import { AnimatePresence, m } from 'motion/react';
import { useId, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { EASE_OUT } from './motion';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Button label; shown whether open or closed. */
  label: ReactNode;
  children: ReactNode;
}

export function Disclosure({ open, onOpenChange, label, children }: Props) {
  const id = useId();
  return (
    <div>
      <button
        type="button"
        className="cl-disclose"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          onOpenChange(!open);
        }}
      >
        {label}
        <ChevronDown size={16} strokeWidth={1.5} aria-hidden />
      </button>
      <div id={id} style={{ overflow: 'hidden' }}>
        <AnimatePresence initial={false}>
          {open && (
            <m.div
              key="content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: EASE_OUT }}
            >
              {children}
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
