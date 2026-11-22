/** The sample models, as plain JSON values (exactly what a doclet or plugin would write). */
import type { Model } from "../src/model";
import { javaSample } from "./java";
import { kotlinSample } from "./kotlin";

const plain = (model: Model): Model => JSON.parse(JSON.stringify(model));

export const samples: Record<"java" | "kotlin", Model> = { java: plain(javaSample), kotlin: plain(kotlinSample) };
