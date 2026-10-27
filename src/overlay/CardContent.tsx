// The inside of a catch card, shared by the single card and by expanded Show all entries. Renders
// every state from DESIGN.md "Catch card": matched, likely, many-to-one, no footnote found, terms on
// another page, loading and the success morph on the action buttons.

import {
  ArrowDownToLine,
  Check,
  CircleAlert,
  Copy,
  ExternalLink,
  ImageDown,
  LocateFixed,
  Search,
  X,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { shareFileName } from '../core';
import { ChipList, ConfidenceTag, FinePrint } from '../ui/components/catch-parts';
import { IconButton, Panel, Skeleton, Button } from '../ui/components/controls';
import { Disclosure } from '../ui/components/Disclosure';
import { copyBody, copyImage, copyText, goToFootnote, goToLegalSection, saveBlob } from './actions';
import type { CatchModel } from './model';
import { renderShare } from './share-render';

type Done = 'copy' | 'save' | 'image' | null;

interface Props {
  model: CatchModel;
  hostname: string;
  /** Element whose computed style supplies the tokens for the share image. */
  styleRoot: () => Element | null;
  /** The card is waiting for a rescan to find a lazy footnote (skeleton, 2 s at most). */
  looking?: boolean;
  headingRef?: (el: HTMLElement | null) => void;
  headingId: string;
  onClose?: () => void;
  /** Announce a status line to screen readers. */
  announce: (text: string) => void;
  /** Hide the claim heading (the rail entry already shows it). */
  hideClaim?: boolean;
}

export function CardContent({
  model,
  hostname,
  styleRoot,
  looking,
  headingRef,
  headingId,
  onClose,
  announce,
  hideClaim,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [done, setDone] = useState<Done>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const flash = useCallback(
    (kind: Exclude<Done, null>, message: string) => {
      setDone(kind);
      setError(null);
      announce(message);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setDone(null);
      }, 1500);
    },
    [announce],
  );

  const fail = useCallback(
    (message: string) => {
      setError(message);
      announce(message);
    },
    [announce],
  );

  const onCopy = useCallback(() => {
    copyText(copyBody(model)).then(
      () => {
        flash('copy', 'Copied');
      },
      () => {
        fail("Couldn't copy. Select the text and copy it yourself.");
      },
    );
  }, [model, flash, fail]);

  const makeImage = useCallback(async () => {
    const root = styleRoot();
    if (!root) throw new Error('No style root');
    return renderShare({ model, hostname, date: new Date() }, root);
  }, [model, hostname, styleRoot]);

  const onSave = useCallback(() => {
    makeImage().then(
      (blob) => {
        const name = saveBlob(blob, hostname);
        flash('save', `Saved ${name}`);
      },
      () => {
        fail("Couldn't make the image. Try again.");
      },
    );
  }, [makeImage, hostname, flash, fail]);

  const onCopyImage = useCallback(() => {
    makeImage()
      .then(copyImage)
      .then(
        () => {
          flash('image', 'Copied image');
        },
        () => {
          fail("Couldn't copy the image. Use Save image instead.");
        },
      );
  }, [makeImage, flash, fail]);

  const onGo = useCallback(() => {
    goToFootnote(model.footnoteEl());
  }, [model]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const k = e.key.toLowerCase();
    if (k === 'c') onCopy();
    else if (k === 's') onSave();
    else if (k === 'i') onCopyImage();
    else if (k === 'g') onGo();
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  const c = model.card;
  const hasFootnote = model.shownText !== null;
  const level =
    c.kind === 'likely' || (c.kind === 'many-to-one' && c.tag === 'Likely match')
      ? 'likely'
      : 'matched';
  const reason = c.kind === 'likely' ? c.reason : c.kind === 'many-to-one' ? c.reason : null;

  let body: ReactNode;
  if (looking && !hasFootnote) {
    body = (
      <div className="cl-card__body" aria-busy="true">
        <p className="cl-note">Looking for the footnote…</p>
        <Skeleton h={16} />
        <Skeleton h={16} w="72%" />
      </div>
    );
  } else if (c.kind === 'not-found') {
    body = (
      <div className="cl-card__body">
        <Panel icon={<CircleAlert size={16} strokeWidth={1.5} aria-hidden />}>{c.copy}</Panel>
        <div>
          <Button
            variant="ghost"
            onClick={() => {
              goToLegalSection(document);
            }}
          >
            <Search size={16} strokeWidth={1.5} aria-hidden />
            Search the page
          </Button>
        </div>
      </div>
    );
  } else if (c.kind === 'external') {
    body = (
      <div className="cl-card__body">
        <p className="cl-note">Terms are on another page:</p>
        <a className="cl-card__ext" href={c.href} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={16} strokeWidth={1.5} aria-hidden />
          <span>{c.copy.replace('Terms are on another page: ', '')}</span>
        </a>
      </div>
    );
  } else {
    body = (
      <div className="cl-card__body">
        <ChipList chips={model.chips} />
        {model.shownText !== null && (
          <div data-fine>
            <FinePrint text={model.shownText} spans={model.shownSpans} scroll />
          </div>
        )}
        {model.fullText && model.expanderLabel && (
          <Disclosure
            open={expanded}
            onOpenChange={setExpanded}
            label={expanded ? 'Show less' : model.expanderLabel}
          >
            <FinePrint text={model.fullText} spans={model.fullSpans} scroll />
          </Disclosure>
        )}
      </div>
    );
  }

  const showTag =
    hasFootnote && (c.kind === 'matched' || c.kind === 'likely' || c.kind === 'many-to-one');

  return (
    <div onKeyDown={onKeyDown}>
      {!hideClaim && (
        <div className="cl-card__head">
          <h3
            className="cl-card__claim"
            id={headingId}
            tabIndex={-1}
            ref={headingRef}
            title={model.claimText}
          >
            {model.claimText}
          </h3>
          <div className="cl-card__meta">
            {showTag && <ConfidenceTag level={level} reason={reason} />}
            {onClose && (
              <IconButton label="Close" keys="Esc" onClick={onClose}>
                <X size={16} strokeWidth={1.5} aria-hidden />
              </IconButton>
            )}
          </div>
        </div>
      )}
      <div style={{ height: hideClaim ? 0 : 12 }} />
      {body}
      <div style={{ height: 12 }} />
      {c.kind !== 'not-found' && (
        <div className="cl-card__actions">
          <IconButton
            label={done === 'copy' ? 'Copied' : 'Copy text'}
            keys="C"
            done={done === 'copy'}
            onClick={onCopy}
          >
            {done === 'copy' ? (
              <Check size={16} strokeWidth={1.5} aria-hidden />
            ) : (
              <Copy size={16} strokeWidth={1.5} aria-hidden />
            )}
          </IconButton>
          <IconButton
            label={done === 'save' ? 'Saved' : 'Save image'}
            keys="S"
            done={done === 'save'}
            onClick={onSave}
          >
            {done === 'save' ? (
              <Check size={16} strokeWidth={1.5} aria-hidden />
            ) : (
              <ArrowDownToLine size={16} strokeWidth={1.5} aria-hidden />
            )}
          </IconButton>
          <IconButton
            label={done === 'image' ? 'Copied image' : 'Copy image'}
            keys="I"
            done={done === 'image'}
            onClick={onCopyImage}
          >
            {done === 'image' ? (
              <Check size={16} strokeWidth={1.5} aria-hidden />
            ) : (
              <ImageDown size={16} strokeWidth={1.5} aria-hidden />
            )}
          </IconButton>
          {hasFootnote && (
            <IconButton label="Go to footnote" keys="G" onClick={onGo}>
              <LocateFixed size={16} strokeWidth={1.5} aria-hidden />
            </IconButton>
          )}
          {done === 'save' && (
            <span className="cl-card__status" role="status">
              {shareFileName(hostname, new Date())}
            </span>
          )}
        </div>
      )}
      {error && (
        <p className="cl-card__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
