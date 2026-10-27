import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "@/lib/utils";
import { registerOverlayBranch } from "./use-overlay-behavior";

const PopoverContext = React.createContext<{
  trigger: React.RefObject<HTMLButtonElement | null>;
  close: () => void;
} | null>(null);

function Popover({ open: controlledOpen, defaultOpen = false, onOpenChange, ...props }: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  const trigger = React.useRef<HTMLButtonElement>(null);
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const setOpen = React.useCallback((open: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(open);
    onOpenChange?.(open);
  }, [controlledOpen, onOpenChange]);
  const context = React.useMemo(() => ({ trigger, close: () => setOpen(false) }), [setOpen]);
  return <PopoverContext.Provider value={context}><PopoverPrimitive.Root open={controlledOpen ?? uncontrolledOpen} onOpenChange={setOpen} {...props} /></PopoverContext.Provider>;
}

function PopoverTrigger({ ref, ...props }: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  const context = React.useContext(PopoverContext);
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" ref={node => {
    if (context) context.trigger.current = node;
    if (typeof ref === "function") return ref(node);
    if (ref) ref.current = node;
  }} {...props} />;
}

function PopoverContent({ className, align = "center", sideOffset = 4, ref, ...props }: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  const context = React.useContext(PopoverContext);
  const unregister = React.useRef<(() => void) | undefined>(undefined);
  React.useEffect(() => () => unregister.current?.(), []);
  return <PopoverPrimitive.Portal><PopoverPrimitive.Content
    data-slot="popover-content"
    align={align}
    sideOffset={sideOffset}
    collisionPadding={12}
    ref={node => {
      unregister.current?.();
      unregister.current = node && context?.trigger.current
        ? registerOverlayBranch(node, context.trigger.current, context.close)
        : undefined;
      if (typeof ref === "function") return ref(node);
      if (ref) ref.current = node;
    }}
    className={cn("z-[150] w-72 max-w-[calc(100vw-1.5rem)] origin-(--radix-popover-content-transform-origin) rounded-md border border-border bg-popover p-4 text-popover-foreground shadow-md outline-hidden data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 motion-reduce:animate-none", className)}
    {...props}
  /></PopoverPrimitive.Portal>;
}

const PopoverAnchor = PopoverPrimitive.Anchor;
export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };
