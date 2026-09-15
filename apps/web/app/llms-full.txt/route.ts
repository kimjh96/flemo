import { agentTextResponse, renderLlmsFull } from "@/app/[lang]/docs/_data/agentDocs";

export function GET(): Response {
  return agentTextResponse(renderLlmsFull());
}
