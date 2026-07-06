export { Button, buttonVariants, type ButtonProps } from "./components/button";
export { Badge, badgeVariants, type BadgeProps } from "./components/badge";
export { Callout, type CalloutProps } from "./components/callout";
export { CodeBlock, CopyButton, type CodeBlockProps } from "./components/code-block";
export { cn } from "./lib/utils";
export { ThemeProvider, useTheme, type Theme, type ThemeProviderProps } from "./components/theme-provider";
export { Breadcrumbs, type BreadcrumbSegment, type BreadcrumbsProps } from "./components/breadcrumbs";
export { PageFooterNav, type PageFooterNavLink, type PageFooterNavProps } from "./components/page-footer-nav";

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
export { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "./components/accordion";
export {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel,
  SelectScrollDownButton, SelectScrollUpButton, SelectSeparator, SelectTrigger, SelectValue,
} from "./components/select";

// --- Tier-2 docs composites (cycle 2, ported from the Elide Docs mockup) ---
export { AppNav, type AppNavProps, type NavLink } from "./components/app-nav";
export {
  SectionTabs, type SectionTabsProps, type SectionTabItem, type SectionTabsVersion,
} from "./components/section-tabs";
export {
  Sidebar, SectionSwitcher, SidebarGroup, SidebarItem,
  type SidebarProps, type SectionSwitcherProps, type SidebarGroupProps,
  type SidebarItemProps, type SidebarSection,
} from "./components/sidebar";
export {
  TableOfContents, type TableOfContentsProps, type TocItem,
} from "./components/table-of-contents";
export {
  MobileNav, type MobileNavProps, type MobileNavItem, type MobileNavGroup, type MobileNavSection,
} from "./components/mobile-nav";
export { CardGrid, FeatureCard, type CardGridProps, type FeatureCardProps } from "./components/card-grid";
export { StatStrip, type Stat, type StatStripProps } from "./components/stat-strip";
export { AiActions, type AiActionsProps, type AiActionItem } from "./components/ai-actions";
export { CopyCommand, type CopyCommandProps } from "./components/copy-command";
export { StatusBadge, type ApiStatus, type StatusBadgeProps } from "./components/status-badge";
export { ApiMethod, ParamRow, type ApiMethodProps, type ParamRowProps } from "./components/api-method";
export {
  SupportMatrix, type SupportMatrixProps, type SupportMatrixColumn,
  type SupportRow, type SupportStatus,
} from "./components/support-matrix";

// As components are ported from the mockups they are exported here. Base-UI-backed
// primitives (Dialog, Popover, DropdownMenu, Combobox/Command, Tooltip, Tabs,
// Select, Sheet, NavigationMenu, ScrollArea, Accordion) are added via the shadcn
// registry — `bunx shadcn@latest add <name>` — then re-themed from tokens.
