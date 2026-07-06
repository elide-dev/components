# `@elide/ui` Base UI Primitive Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 11 themed, story-covered interactive primitives in `@elide/ui`, generated via the shadcn CLI on `@base-ui/react` and themed entirely from `@elide/tokens`.

**Architecture:** shadcn CLI v4 (Base UI mode) generates each primitive into `packages/ui/src/components/`; we re-theme it to token-backed Tailwind utilities (no hardcoded color), re-export from `src/index.ts`, add a light+dark Storybook story, then build/lint/visually-diff against `Elide Docs.dc.html`.

**Tech Stack:** Bun workspaces + Turbo, TypeScript 6, React 19, `@base-ui/react` 1.6, Tailwind v4, tsup (`--dts`), Storybook 10, ESLint 10 (flat), Chrome DevTools MCP for visual diff.

## Global Constraints

- Package manager is **Bun**; run scripts with `bun run …` (never `bun build` — that's Bun's bundler). Filtered builds: `bun run --filter @elide/ui build`.
- **No hardcoded color/hex** in components — only token-backed utilities (`bg-popover`, `text-foreground`, `border`, `ring-ring`, …) resolving from `@elide/tokens`.
- Components import Base UI from **`@base-ui/react`** (the installed scope). If shadcn emits `@base-ui-components/react`, rewrite the import (see Task 1).
- `cn` lives at `src/lib/utils` — do not let shadcn overwrite it.
- All shadcn-expected CSS vars already resolve from `@elide/tokens` (`--background/foreground/card/popover/muted/accent/primary/border/input/ring/destructive/radius`). Do **not** add a competing `:root` color block.
- Every primitive ends its task green on `bun run --filter @elide/ui build` **and** `bun run --filter @elide/ui lint`, and its story renders in both themes.
- **No git commits** unless the user requests them; each task's checkpoint is build + lint + visual diff, not a commit.
- Stories import types from `@storybook/react-vite`; theme is supplied by the existing Storybook decorator (`globals.theme` → `dark`/light).

---

## File Structure

- **Create** `packages/ui/components.json` — shadcn config (Base UI, Tailwind v4, aliases).
- **Create** `packages/ui/src/components/<name>.tsx` — one per primitive (generated + themed).
- **Create** `packages/ui/src/stories/<Name>.stories.tsx` — one per primitive.
- **Modify** `packages/ui/src/index.ts` — add re-exports (one line block per primitive).
- **Modify** `COMPONENTS.md` — flip statuses `registry → done`; record any deferral.
- Possibly **create** `packages/ui/src/hooks/` if a generated primitive ships a hook.

---

## Standard Primitive Procedure (referenced by every primitive task)

Each primitive task performs these steps; the per-task section fills in the **name**, **Base UI API notes**, **story states**, and **mockup region**.

1. **Generate:** `cd packages/ui && bunx shadcn@latest add <name> --yes`
2. **Reconcile imports:** open `src/components/<name>.tsx`; if it imports `@base-ui-components/react`, replace with `@base-ui/react`. Confirm no new hardcoded color vars were injected into `styles.css`.
3. **Re-theme:** remove any shadcn default palette/`data-[state]` colors that hardcode hex; ensure surfaces use `bg-popover`/`bg-card`, text uses `text-foreground`/`text-muted-foreground`, borders use `border`/`border-input`, focus uses `ring-ring`, radius uses `rounded-md`/`rounded-lg`. Match the mockup region's radius/shadow/padding.
4. **Export:** add the component + its public subcomponents/types to `src/index.ts`.
5. **Story:** create `src/stories/<Name>.stories.tsx` with the listed states.
6. **Build + lint:** `bun run --filter @elide/ui build && bun run --filter @elide/ui lint` — both clean.
7. **Visual diff:** rebuild Storybook (`bun run --filter @elide/storybook build`), navigate `http://127.0.0.1:6099/iframe.html?id=<story-id>&globals=theme:dark`, screenshot, compare to the mockup region. Adjust theming until it matches.
8. **Status:** flip the row in `COMPONENTS.md` to `done`.

If a primitive is unavailable on Base UI / the registry, do **not** silently drop it: note it in `COMPONENTS.md` + the spec and either hand-author on the nearest Base UI primitive or defer with a written reason (applies especially to `Command`, Task 11).

---

### Task 1: Infrastructure + Tooltip (reference primitive)

**Files:**
- Create: `packages/ui/components.json`
- Create: `packages/ui/src/components/tooltip.tsx`
- Create: `packages/ui/src/stories/Tooltip.stories.tsx`
- Modify: `packages/ui/src/index.ts`
- Modify: `COMPONENTS.md`

**Interfaces:**
- Produces: `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider` (Base UI naming may differ — export whatever the generated file's public surface is, documented in the export block). Later tasks rely only on `components.json` + the proven procedure, not on Tooltip's API.

- [ ] **Step 1: Author `components.json`**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/styles.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "src/components",
    "ui": "src/components",
    "lib": "src/lib",
    "utils": "src/lib/utils",
    "hooks": "src/hooks"
  }
}
```

- [ ] **Step 2: Confirm Base UI mode + registry reachability**

Run: `cd packages/ui && bunx shadcn@latest add tooltip --yes`
Expected: a `src/components/tooltip.tsx` is written. If the CLI prompts for a framework, choose the library/manual option; if it asks Radix vs Base UI, choose **Base UI**. If it insists on writing CSS vars, decline / then revert any `:root` color block it added to `styles.css` (keep only our `@source`/font/base layers).

- [ ] **Step 3: Record the import-name decision**

Inspect the generated import. Note in `COMPONENTS.md` (or a comment) whether Base UI resolves as `@base-ui/react` (expected) or `@base-ui-components/react`. If the latter, rewrite to `@base-ui/react` and verify it type-checks in Step 6. This decision applies to all later primitives.

- [ ] **Step 4: Re-theme `tooltip.tsx`**

Ensure the content surface uses tokens, e.g. the panel: `rounded-md border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md`. Remove any hardcoded colors. Keep Base UI's positioning/anchor props intact.

- [ ] **Step 5: Export from `src/index.ts`**

Append (adjust names to the generated public surface):

```ts
export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "./components/tooltip";
```

- [ ] **Step 6: Build + lint**

Run: `cd /Users/sam/workspace/elide-components && bun run --filter @elide/ui build && bun run --filter @elide/ui lint`
Expected: DTS build succeeds; ESLint reports 0 problems. Fix any unused-import or type errors (e.g. React 19 `props` typing) before proceeding.

- [ ] **Step 7: Story**

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "../components/tooltip";
import { Button } from "../components/button";

const meta = {
  title: "Primitives/Tooltip",
  parameters: { layout: "centered" },
} satisfies Meta;
export default meta;

export const Default: StoryObj = {
  render: () => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={<Button variant="ghost" size="icon">?</Button>} />
        <TooltipContent>Search — ⌘K</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
};
```

(If the generated API has no `TooltipProvider`, drop it and wrap per the generated file's documented usage.)

- [ ] **Step 8: Visual diff**

Ensure the static servers are up (`:6099` Storybook, `:6098` mockup). Rebuild Storybook, open `http://127.0.0.1:6099/iframe.html?id=primitives-tooltip--default&globals=theme:dark`, screenshot, and confirm the tooltip surface matches the nav icon-button tooltips in the mockup. Adjust until it matches.

- [ ] **Step 9: Update `COMPONENTS.md`**

Flip `Tooltip` to **done**; add the import-name note.

---

### Task 2: Popover

**Files:** Create `src/components/popover.tsx`, `src/stories/Popover.stories.tsx`; Modify `src/index.ts`, `COMPONENTS.md`.
**Base UI:** `Popover` (Trigger / Positioner / Popup). **Mockup region:** language / section switchers (elevated panel, `bg-popover`, `border`, `rounded-lg`, soft shadow).
**Story states:** `Default` — a `Button` trigger opening a small panel with two rows.

Follow the Standard Primitive Procedure. Export block:

```ts
export { Popover, PopoverTrigger, PopoverContent } from "./components/popover";
```

Story:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Popover, PopoverTrigger, PopoverContent } from "../components/popover";
import { Button } from "../components/button";

const meta = { title: "Primitives/Popover", parameters: { layout: "centered" } } satisfies Meta;
export default meta;

export const Default: StoryObj = {
  render: () => (
    <Popover>
      <PopoverTrigger render={<Button variant="outline">EN</Button>} />
      <PopoverContent className="w-48">
        <div className="text-sm">English</div>
        <div className="text-sm text-muted-foreground">Español</div>
      </PopoverContent>
    </Popover>
  ),
};
```
Verify: build + lint + diff (`primitives-popover--default`).

---

### Task 3: DropdownMenu

**Files:** Create `src/components/dropdown-menu.tsx`, `src/stories/DropdownMenu.stories.tsx`; Modify `src/index.ts`, `COMPONENTS.md`.
**Base UI:** `Menu` (Trigger / Positioner / Popup / Item / Separator). **Mockup region:** locale menu, "Ask AI" split button menu.
**Story states:** `Default` — trigger opening items + a separator + a destructive-styled item.

Export block (map to generated names):

```ts
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "./components/dropdown-menu";
```

Story:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "../components/dropdown-menu";
import { Button } from "../components/button";

const meta = { title: "Primitives/DropdownMenu", parameters: { layout: "centered" } } satisfies Meta;
export default meta;

export const Default: StoryObj = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline">Ask AI</Button>} />
      <DropdownMenuContent>
        <DropdownMenuItem>Copy as Markdown</DropdownMenuItem>
        <DropdownMenuItem>Open in ChatGPT</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Open in Claude</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
```
Verify: build + lint + diff (`primitives-dropdownmenu--default`).

---

### Task 4: Dialog

**Files:** Create `src/components/dialog.tsx`, `src/stories/Dialog.stories.tsx`; Modify `src/index.ts`, `COMPONENTS.md`.
**Base UI:** `Dialog` (Trigger / Backdrop / Popup / Title / Description / Close). **Mockup region:** modal base (centered card, `bg-card`, `border`, `rounded-xl`, backdrop blur/scrim).
**Story states:** `Default` — trigger → modal with title, description, and a close `Button`.

Export block:

```ts
export {
  Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogClose,
} from "./components/dialog";
```

Story:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogClose,
} from "../components/dialog";
import { Button } from "../components/button";

const meta = { title: "Primitives/Dialog", parameters: { layout: "centered" } } satisfies Meta;
export default meta;

export const Default: StoryObj = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button>Open</Button>} />
      <DialogContent>
        <DialogTitle>Delete project</DialogTitle>
        <DialogDescription className="text-muted-foreground">This cannot be undone.</DialogDescription>
        <DialogClose render={<Button variant="outline">Cancel</Button>} />
      </DialogContent>
    </Dialog>
  ),
};
```
Verify: build + lint + diff (`primitives-dialog--default`).

---

### Task 5: Sheet

**Files:** Create `src/components/sheet.tsx`, `src/stories/Sheet.stories.tsx`; Modify `src/index.ts`, `COMPONENTS.md`.
**Base UI:** built on `Dialog`; add a `side` prop (`left`/`right`/`top`/`bottom`) driving the popup's positioning + slide-in. If shadcn's Base UI registry has no `sheet`, hand-author it as a thin wrapper over the Task 4 `Dialog` primitive with side variants (documented in the file). **Mockup region:** mobile nav drawer (full-height side panel, `bg-card`, slide from left).
**Story states:** `Left` and `Right`.

Export block:

```ts
export { Sheet, SheetTrigger, SheetContent, SheetTitle, SheetClose } from "./components/sheet";
```

Story:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Sheet, SheetTrigger, SheetContent, SheetTitle } from "../components/sheet";
import { Button } from "../components/button";

const meta = { title: "Primitives/Sheet", parameters: { layout: "centered" } } satisfies Meta;
export default meta;

export const Left: StoryObj = {
  render: () => (
    <Sheet>
      <SheetTrigger render={<Button variant="outline">Menu</Button>} />
      <SheetContent side="left" className="w-72">
        <SheetTitle>Navigation</SheetTitle>
      </SheetContent>
    </Sheet>
  ),
};
```
Verify: build + lint + diff (`primitives-sheet--left`).

---

### Task 6: Separator

**Files:** Create `src/components/separator.tsx`, `src/stories/Separator.stories.tsx`; Modify `src/index.ts`, `COMPONENTS.md`.
**Base UI:** `Separator` (orientation `horizontal`/`vertical`). **Mockup region:** nav dividers (1px `bg-border`). **Story states:** `Horizontal`, `Vertical`.

Export block:

```ts
export { Separator } from "./components/separator";
```

Story:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Separator } from "../components/separator";

const meta = { title: "Primitives/Separator", parameters: { layout: "centered" } } satisfies Meta;
export default meta;

export const Horizontal: StoryObj = {
  render: () => (
    <div className="w-64 text-sm">
      Docs<Separator className="my-3" />Enterprise
    </div>
  ),
};
export const Vertical: StoryObj = {
  render: () => (
    <div className="flex h-6 items-center gap-3 text-sm">
      Docs<Separator orientation="vertical" />Blog
    </div>
  ),
};
```
Verify: build + lint + diff (`primitives-separator--horizontal`).

---

### Task 7: ScrollArea

**Files:** Create `src/components/scroll-area.tsx`, `src/stories/ScrollArea.stories.tsx`; Modify `src/index.ts`, `COMPONENTS.md`.
**Base UI:** `ScrollArea` (Root / Viewport / Scrollbar / Thumb). **Mockup region:** sidebar / palette scroll (thin thumb, `bg-border`-ish, over `bg-transparent`). **Story states:** `Default` — a fixed-height box with overflowing rows.

Export block:

```ts
export { ScrollArea } from "./components/scroll-area";
```

Story:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ScrollArea } from "../components/scroll-area";

const meta = { title: "Primitives/ScrollArea", parameters: { layout: "centered" } } satisfies Meta;
export default meta;

export const Default: StoryObj = {
  render: () => (
    <ScrollArea className="h-48 w-64 rounded-lg border p-3">
      <div className="flex flex-col gap-2 text-sm text-muted-foreground">
        {Array.from({ length: 30 }, (_, i) => <div key={i}>Item {i + 1}</div>)}
      </div>
    </ScrollArea>
  ),
};
```
Verify: build + lint + diff (`primitives-scrollarea--default`).

---

### Task 8: Switch

**Files:** Create `src/components/switch.tsx`, `src/stories/Switch.stories.tsx`; Modify `src/index.ts`, `COMPONENTS.md`.
**Base UI:** `Switch` (Root / Thumb). **Mockup region:** theme toggle option (checked = `bg-primary`, thumb `bg-background`, `rounded-full`). **Story states:** `Off`, `On` (`defaultChecked`).

Export block:

```ts
export { Switch } from "./components/switch";
```

Story:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Switch } from "../components/switch";

const meta = { title: "Primitives/Switch", component: Switch, parameters: { layout: "centered" } } satisfies Meta<typeof Switch>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Off: Story = {};
export const On: Story = { args: { defaultChecked: true } };
```
Verify: build + lint + diff (`primitives-switch--on`).

---

### Task 9: Tabs

**Files:** Create `src/components/tabs.tsx`, `src/stories/Tabs.stories.tsx`; Modify `src/index.ts`, `COMPONENTS.md`.
**Base UI:** `Tabs` (Root / List / Tab / Panel). **Mockup region:** content tabbing (active tab `text-foreground` with a `bg-primary` underline/indicator; inactive `text-muted-foreground`). **Story states:** `Default` — three tabs.

Export block:

```ts
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/tabs";
```

Story:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/tabs";

const meta = { title: "Primitives/Tabs", parameters: { layout: "centered" } } satisfies Meta;
export default meta;

export const Default: StoryObj = {
  render: () => (
    <Tabs defaultValue="js" className="w-96">
      <TabsList>
        <TabsTrigger value="js">JavaScript</TabsTrigger>
        <TabsTrigger value="ts">TypeScript</TabsTrigger>
        <TabsTrigger value="py">Python</TabsTrigger>
      </TabsList>
      <TabsContent value="js" className="pt-3 text-sm text-muted-foreground">console.log("hi")</TabsContent>
      <TabsContent value="ts" className="pt-3 text-sm text-muted-foreground">const x: number = 1</TabsContent>
      <TabsContent value="py" className="pt-3 text-sm text-muted-foreground">print("hi")</TabsContent>
    </Tabs>
  ),
};
```
Verify: build + lint + diff (`primitives-tabs--default`).

---

### Task 10: NavigationMenu

**Files:** Create `src/components/navigation-menu.tsx`, `src/stories/NavigationMenu.stories.tsx`; Modify `src/index.ts`, `COMPONENTS.md`.
**Base UI:** `NavigationMenu` (Root / List / Item / Trigger / Content / Link / Positioner / Popup). **Mockup region:** primary nav links (Docs / Enterprise / Blog / Pricing; hover uses `bg-[var(--hover)]`, active `text-foreground`). **Story states:** `Default` — three top links, one with a dropdown content panel.

Export block:

```ts
export {
  NavigationMenu, NavigationMenuList, NavigationMenuItem,
  NavigationMenuTrigger, NavigationMenuContent, NavigationMenuLink,
} from "./components/navigation-menu";
```

Story:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  NavigationMenu, NavigationMenuList, NavigationMenuItem,
  NavigationMenuTrigger, NavigationMenuContent, NavigationMenuLink,
} from "../components/navigation-menu";

const meta = { title: "Primitives/NavigationMenu", parameters: { layout: "centered" } } satisfies Meta;
export default meta;

export const Default: StoryObj = {
  render: () => (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem><NavigationMenuLink href="#">Docs</NavigationMenuLink></NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Product</NavigationMenuTrigger>
          <NavigationMenuContent>
            <NavigationMenuLink href="#">Runtime</NavigationMenuLink>
            <NavigationMenuLink href="#">Toolchain</NavigationMenuLink>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem><NavigationMenuLink href="#">Pricing</NavigationMenuLink></NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  ),
};
```
Verify: build + lint + diff (`primitives-navigationmenu--default`).

---

### Task 11: Command (⌘K base) — verify availability first

**Files:** Create `src/components/command.tsx`, `src/stories/Command.stories.tsx`; Modify `src/index.ts`, `COMPONENTS.md`.
**Decision gate (do this first):** run `cd packages/ui && bunx shadcn@latest add command --yes` and inspect the result.
- If it generates on **Base UI Combobox** (or a Base UI primitive) → theme + export + story as usual.
- If it pulls **`cmdk`** → acceptable as an interim (record the dependency in `COMPONENTS.md`), theme it, and proceed.
- If neither is cleanly available → **defer Command** to the CommandPalette composite cycle; record the deferral in `COMPONENTS.md` + the spec's risk section and skip the remaining steps. Do not block Tasks 1–10.

**Mockup region:** `<!-- COMMAND PALETTE OVERLAY -->` — 560px panel, `rounded-[14px]`, `border-strong`, `bg-popover`, search row with icon + `esc` chip, grouped results (`Pages` / `Actions`), active row `bg-primary-soft`.
**Story states (if built):** `Default` — search input + two groups of items.

Export block (if built; adjust to generated surface):

```ts
export {
  Command, CommandInput, CommandList, CommandGroup, CommandItem, CommandEmpty,
} from "./components/command";
```

Story (if built):

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Command, CommandInput, CommandList, CommandGroup, CommandItem, CommandEmpty } from "../components/command";

const meta = { title: "Primitives/Command", parameters: { layout: "centered" } } satisfies Meta;
export default meta;

export const Default: StoryObj = {
  render: () => (
    <Command className="w-[560px] rounded-[14px] border">
      <CommandInput placeholder="Search or ask AI…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Pages">
          <CommandItem>SQLite in JavaScript</CommandItem>
          <CommandItem>Host APIs</CommandItem>
        </CommandGroup>
        <CommandGroup heading="Actions">
          <CommandItem>Ask AI about “sqlite”</CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  ),
};
```
Verify: build + lint + diff (`primitives-command--default`), or record deferral.

---

## Final checkpoint

- [ ] `bun run build` (all packages) and `bun run lint` pass from a **cold cache** (`rm -rf .turbo packages/*/dist apps/storybook/storybook-static`).
- [ ] All 11 primitives (minus any documented deferral) exported from `@elide/ui`, each with a light+dark story that visually matches its mockup region.
- [ ] `COMPONENTS.md` statuses updated; import-name decision + any deferral recorded.
- [ ] Summarize what shipped, what (if anything) was deferred and why.
