import { agentTextResponse, renderLlmsIndex } from "@/app/[lang]/docs/_data/agentDocs";

export function GET(): Response {
  return agentTextResponse(renderLlmsIndex());
}
