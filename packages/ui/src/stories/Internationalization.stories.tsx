import type { Meta, StoryObj } from "@storybook/react-vite";
import { I18nProvider } from "../i18n/provider";
import { localeInfo } from "../i18n/locales";
import ar from "../i18n/locales/ar";
import he from "../i18n/locales/he";
import ja from "../i18n/locales/ja";
import ko from "../i18n/locales/ko";
import de from "../i18n/locales/de";
import hans from "../i18n/locales/zh-Hans";
import hant from "../i18n/locales/zh-Hant";
import { Breadcrumbs } from "../components/breadcrumbs";
import { PageFooterNav } from "../components/page-footer-nav";
import { CopyCommand } from "../components/copy-command";
import { TableOfContents } from "../components/table-of-contents";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/tabs";
import { Switch } from "../components/switch";
import { StatusBadge } from "../components/status-badge";

const catalogs = { ar, he, ja, ko, de, "zh-Hans": hans, "zh-Hant": hant };
function Example({ locale }: { locale: keyof typeof catalogs }) {
  const m = catalogs[locale];
  return <I18nProvider locale={locale} messages={m} style={{ maxWidth: 640, display: "grid", gap: 24 }}>
    <h1 className="text-2xl">{localeInfo[locale].name}</h1>
    <Breadcrumbs segments={[{ label: "Elide", href: "#example" }, { label: m.appNav.docsBadge }]} />
    <Tabs defaultValue="docs"><TabsList aria-label={m.sectionTabs.navLabel}>
      <TabsTrigger value="docs">{m.appNav.docsBadge}</TabsTrigger><TabsTrigger value="api">API</TabsTrigger>
    </TabsList><TabsContent value="docs"><StatusBadge status="supported" /></TabsContent><TabsContent value="api"><StatusBadge status="planned" /></TabsContent></Tabs>
    <label className="flex items-center gap-3">{m.appNav.toggleTheme}<Switch defaultChecked /></label>
    <CopyCommand command="curl elide.sh | bash" label={m.copyCommand.copy} />
    <TableOfContents activeId="example" items={[{ id: "example", label: m.appNav.docsBadge }, { id: "nested", label: m.appNav.install, depth: 1 }]} />
    <PageFooterNav prev={{ href: "#example", label: m.appNav.docsBadge }} next={{ href: "#nested", label: m.appNav.install }} />
  </I18nProvider>;
}
const meta = { title: "Foundations/Internationalization", component: Example, parameters: { layout: "padded" } } satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Arabic: Story = { args: { locale: "ar" } };
export const Hebrew: Story = { args: { locale: "he" } };
export const Japanese: Story = { args: { locale: "ja" } };
export const Korean: Story = { args: { locale: "ko" } };
export const SimplifiedChinese: Story = { args: { locale: "zh-Hans" } };
export const TraditionalChinese: Story = { args: { locale: "zh-Hant" } };
export const German: Story = { args: { locale: "de" } };
