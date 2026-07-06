export { Button, buttonVariants, type ButtonProps } from "./components/button";
export { Badge, badgeVariants, type BadgeProps } from "./components/badge";
export { Callout, type CalloutProps } from "./components/callout";
export { CodeBlock, CopyButton, type CodeBlockProps } from "./components/code-block";
export { cn } from "./lib/utils";
export { ThemeProvider, useTheme, type Theme, type ThemeProviderProps } from "./components/theme-provider";
export { Breadcrumbs, type BreadcrumbSegment, type BreadcrumbsProps } from "./components/breadcrumbs";

// --- Base UI primitives (shadcn `base-nova` registry, re-themed from tokens) ---
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "./components/tooltip";
export {
  Popover, PopoverTrigger, PopoverContent, PopoverHeader, PopoverTitle, PopoverDescription,
} from "./components/popover";
export {
  DropdownMenu, DropdownMenuPortal, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuGroup, DropdownMenuLabel, DropdownMenuItem, DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from "./components/dropdown-menu";
export {
  Dialog, DialogTrigger, DialogPortal, DialogOverlay, DialogContent,
  DialogHeader, DialogFooter, DialogTitle, DialogDescription, DialogClose,
} from "./components/dialog";
export {
  Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription,
} from "./components/sheet";
export { Separator } from "./components/separator";
export { ScrollArea, ScrollBar } from "./components/scroll-area";
export { Switch } from "./components/switch";
export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants } from "./components/tabs";
export {
  NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuTrigger,
  NavigationMenuContent, NavigationMenuLink, NavigationMenuIndicator,
  NavigationMenuPositioner, navigationMenuTriggerStyle,
} from "./components/navigation-menu";

// As components are ported from the mockups they are exported here. Base-UI-backed
// primitives (Dialog, Popover, DropdownMenu, Combobox/Command, Tooltip, Tabs,
// Select, Sheet, NavigationMenu, ScrollArea, Accordion) are added via the shadcn
// registry — `bunx shadcn@latest add <name>` — then re-themed from tokens.
