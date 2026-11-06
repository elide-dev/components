import { renderToString } from "preact-render-to-string";
import { Consumer } from "./consumer";

export function prerender(platform: boolean) {
  return renderToString(<Consumer platform={platform} />);
}
