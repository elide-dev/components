export { Button, type ButtonProps } from "./components/button";
export { buttonVariants } from "./components/button-variants";
export { Badge, type BadgeProps } from "./components/badge";
export { badgeVariants } from "./components/badge-variants";
export { Callout, type CalloutProps } from "./components/callout";
export { CodeBlock, CopyButton, type CodeBlockProps } from "./components/code-block";
export {
  CommandPalette,
  type CommandPaletteProps,
  type CommandGroup,
  type CommandItem,
} from "./components/command-palette";
export { cn } from "./lib/utils";
export { MessagesProvider, type MessagesProviderProps } from "./i18n/provider";
export { useMessages } from "./i18n/context";
export { en as defaultMessages, type Messages, type PartialMessages } from "./i18n/messages";
export { ThemeProvider, type ThemeProviderProps } from "./components/theme-provider";
export { useTheme, type Theme } from "./components/theme-context";
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
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/tabs";
export { tabsListVariants } from "./components/tabs-variants";
export {
  NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuTrigger,
  NavigationMenuContent, NavigationMenuLink, NavigationMenuIndicator,
  NavigationMenuPositioner,
} from "./components/navigation-menu";
export { navigationMenuTriggerStyle } from "./components/navigation-menu-variants";
export { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "./components/accordion";
export {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel,
  SelectScrollDownButton, SelectScrollUpButton, SelectSeparator, SelectTrigger, SelectValue,
} from "./components/select";

// --- Tier-2 docs composites (cycle 2, ported from the Elide Docs mockup) ---
export { AppNav, type AppNavProps, type NavLink } from "./components/app-nav";
export { ElideLogo, ElideMark, ElideWordmark, type ElideLogoProps } from "./components/elide-logo";
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
