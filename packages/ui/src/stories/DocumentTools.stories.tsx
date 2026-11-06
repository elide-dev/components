import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { DeferredContent } from "../components/deferred-content";
import { ReadingProgress } from "../components/reading-progress";
import { TableOfContents } from "../components/table-of-contents";

const meta = {
  title: "Composites/DocumentTools",
  component: DeferredContent,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof DeferredContent>;

export default meta;
type Story = StoryObj<typeof meta>;

const sections = [
  { id: "document-installation", label: "Installation" },
  { id: "document-configuration", label: "Configuration" },
  { id: "document-development", label: "Development" },
  { id: "document-deployment", label: "Deployment" },
];

/** Open this story in its own tab to try the document scroll timeline. The
 * heading is intentionally outside each contained body: the table of contents
 * can measure it without forcing the body to render. */
export const LongDocument: Story = {
  render: () => (
    <>
      <ReadingProgress />
      <div className="mx-auto grid max-w-5xl gap-12 md:grid-cols-[minmax(0,1fr)_12rem]">
        <article className="min-w-0">
          <header className="mb-12 space-y-4">
            <p className="font-mono text-xs text-muted-foreground">Elide documentation</p>
            <h1 className="font-display text-4xl font-semibold">Project guide</h1>
            <p className="text-muted-foreground">From your first command to a production deployment.</p>
          </header>
          {sections.map((section, sectionIndex) => (
            <section key={section.id} aria-labelledby={section.id} className="mb-16">
              <h2 id={section.id} className="mb-6 scroll-mt-8 font-display text-2xl font-semibold">
                {section.label}
              </h2>
              <DeferredContent intrinsicBlockSize="48rem" className="space-y-5">
                <p className="leading-relaxed text-muted-foreground">
                  Keep the project settings alongside your source files so every environment
                  starts from the same configuration. Review changes with your team before
                  releasing a new version.
                </p>
                <dl className="divide-y divide-border rounded-md border border-border px-5">
                  {Array.from({ length: 12 }, (_, index) => (
                    <div key={index} className="grid gap-2 py-4 sm:grid-cols-[8rem_minmax(0,1fr)]">
                      <dt className="font-mono text-sm text-primary-emphasis">
                        step_{sectionIndex + 1}_{index + 1}
                      </dt>
                      <dd className="m-0 text-sm leading-relaxed text-muted-foreground">
                        Check your project configuration, run the local verification, and
                        keep the result with your release notes.
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="text-sm text-muted-foreground">
                  Continue to the next section when your project is ready.
                </p>
              </DeferredContent>
            </section>
          ))}
        </article>
        <aside className="hidden md:block">
          <div className="sticky top-8">
            <TableOfContents items={sections} />
          </div>
        </aside>
      </div>
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const section of sections) {
      const heading = canvas.getByRole("heading", { name: section.label });
      await expect(heading.closest("[data-slot='deferred-content']")).toBeNull();
      await expect(canvas.getByRole("link", { name: section.label })).toHaveAttribute("href", `#${section.id}`);
    }
    await expect(canvas.queryByRole("progressbar")).toBeNull();

    const progress = canvasElement.querySelector<HTMLElement>("[data-slot='reading-progress']")!;
    if (!CSS.supports("animation-timeline: scroll(root block)") || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      await expect(getComputedStyle(progress).display).toBe("none");
      return;
    }

    // Exercise the native timeline, including document-size changes when the
    // browser starts rendering a previously skipped body. No scroll listener
    // updates the indicator; the transform must follow the actual scroll range.
    try {
      await waitFor(() => {
        window.scrollTo(0, document.documentElement.scrollHeight);
        expect(new DOMMatrixReadOnly(getComputedStyle(progress).transform).a).toBeGreaterThan(0.99);
      });
    } finally {
      window.scrollTo(0, 0);
      await waitFor(() => {
        expect(new DOMMatrixReadOnly(getComputedStyle(progress).transform).a).toBeLessThan(0.01);
      });
    }
  },
};
