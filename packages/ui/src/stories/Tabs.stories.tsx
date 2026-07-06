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
      <TabsContent value="js" className="pt-3 text-sm text-muted-foreground">
        console.log(&quot;hello&quot;)
      </TabsContent>
      <TabsContent value="ts" className="pt-3 text-sm text-muted-foreground">
        const x: number = 1
      </TabsContent>
      <TabsContent value="py" className="pt-3 text-sm text-muted-foreground">
        print(&quot;hello&quot;)
      </TabsContent>
    </Tabs>
  ),
};
