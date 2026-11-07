import { useLocale } from "../i18n/locale-context";
import { useMessages } from "../i18n/context";
import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { XIcon } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./button";
import {
  Popover, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger,
} from "./popover";

export interface AnchoredPopoverProps {
  /** A button element (or a component that forwards button props and its ref). */
  trigger: React.ReactElement;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  side?: "top" | "bottom";
  sideOffset?: number;
  /** Auto uses native CSS positioning when supported; floating always uses Base UI. */
  positioning?: "auto" | "floating";
  closeLabel?: string;
}

const subscribe = () => () => {};
const serverSupportsAnchor = () => false;
function supportsAnchor() {
  return typeof CSS !== "undefined"
    && CSS.supports("anchor-name", "--eld-anchor")
    && CSS.supports("position-area", "bottom span-all")
    && CSS.supports("justify-self", "anchor-center")
    && CSS.supports("position-try-fallbacks", "flip-block");
}

/**
 * An opt-in, viewport-anchored non-modal dialog. Base UI retains focus handling,
 * Escape, outside dismissal and accessible naming on both rendering paths.
 * CSS positioning is independent of Floating UI's computed inline coordinates.
 * Open or focused server-rendered instances keep floating positioning on hydration.
 * Use Popover for virtual anchors, custom clipping boundaries or inline sides.
 */
export function AnchoredPopover({
  trigger, title, description, children, open, defaultOpen = false,
  onOpenChange, className, side = "bottom", sideOffset = 6,
  positioning = "auto", closeLabel,
}: AnchoredPopoverProps) {
  const m = useMessages();
  const { locale: language, direction } = useLocale();
  const supported = React.useSyncExternalStore(subscribe, supportsAnchor, serverSupportsAnchor);
  const id = React.useId();
  const anchorName = `--eld-anchor-${id.replace(/[^a-zA-Z0-9_-]/g,
    (character) => `_${character.codePointAt(0)!.toString(16)}_`)}`;
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const isOpen = open ?? internalOpen;
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [nativeEnabled, setNativeEnabled] = React.useState(supported);
  const preserveHydratedRenderer = React.useRef(isOpen);
  const openRef = React.useRef(isOpen);
  React.useEffect(() => {
    openRef.current = isOpen;
  });

  // Hydration starts with the server's floating path; the native path becomes
  // available once anchor support is known on the client. Replacing the
  // primitive while focused or open would discard the trigger, focus and
  // content state, so such instances retain the floating path for their
  // lifetime. This also avoids racing Base UI's asynchronous focus restoration.
  React.useEffect(() => {
    if (!supported || preserveHydratedRenderer.current) return;
    const triggerElement = triggerRef.current;
    if (openRef.current || triggerElement?.contains(triggerElement.ownerDocument.activeElement)) {
      preserveHydratedRenderer.current = true;
      return;
    }
    setNativeEnabled(true);
  }, [supported]);

  const changeOpen = (next: boolean) => {
    if (open === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };
  const native = positioning === "auto" && nativeEnabled;
  const Title = native ? DialogPrimitive.Title : PopoverTitle;
  const Description = native ? DialogPrimitive.Description : PopoverDescription;
  const Close = native ? DialogPrimitive.Close : PopoverPrimitive.Close;
  const contents = (
    <>
      <div className="flex items-start justify-between gap-3">
        <Title className="font-medium">{title}</Title>
        <Close render={<Button variant="ghost" size="icon-sm" className="-mt-1 -me-1" />} aria-label={closeLabel ?? m.common.close}>
          <XIcon />
        </Close>
      </div>
      {description && <Description className="text-muted-foreground">{description}</Description>}
      {children}
    </>
  );

  if (!native) {
    return (
      <Popover open={isOpen} onOpenChange={changeOpen}>
        <PopoverTrigger ref={triggerRef} render={trigger} />
        <PopoverContent data-slot="anchored-popover-content" lang={language} dir={direction} data-positioning="floating"
          side={side} sideOffset={sideOffset}
          className={cn("max-h-[min(28rem,var(--available-height))] max-w-[calc(100vw-1rem)] overflow-y-auto", className)}>
          {contents}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <DialogPrimitive.Root modal={false} open={isOpen} onOpenChange={changeOpen}>
      <DialogPrimitive.Trigger ref={triggerRef} render={trigger} style={{ anchorName }} />
      <DialogPrimitive.Portal>
        <DialogPrimitive.Popup
          data-slot="anchored-popover-content" lang={language} dir={direction}
          data-positioning="css"
          data-eld-motion="popup"
          data-side={side}
          style={{ positionAnchor: anchorName, "--eld-anchor-offset": `${sideOffset}px` } as React.CSSProperties}
          className={cn(
            "z-50 flex w-72 flex-col gap-2.5 rounded-lg bg-popover p-2.5 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none",
            className,
          )}
        >
          {contents}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
