import Anthropic from "@anthropic-ai/sdk";
import { teachCard } from "@/content";
import { createClient } from "@/lib/supabase/server";
import { TUTOR_MODEL, tutorEnabled, tutorSystemPrompt } from "@/lib/tutor";

export const runtime = "nodejs";
export const maxDuration = 120;

interface IncomingTurn {
  role: "user" | "assistant";
  content: string;
}

function validTurns(value: unknown): IncomingTurn[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) return null;
  const turns: IncomingTurn[] = [];
  for (const [i, t] of value.entries()) {
    if (!t || typeof t !== "object") return null;
    const { role, content } = t as Record<string, unknown>;
    const expected = i % 2 === 0 ? "user" : "assistant";
    if (role !== expected || typeof content !== "string" || !content.trim() || content.length > 6000) return null;
    turns.push({ role: expected, content });
  }
  return turns[turns.length - 1].role === "user" ? turns : null;
}

export async function POST(request: Request) {
  if (!tutorEnabled()) return new Response("The tutor isn't set up. Add ANTHROPIC_API_KEY to enable it.", { status: 503 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return new Response("Sign in first.", { status: 401 });

  const body = (await request.json().catch(() => null)) as { topicId?: unknown; messages?: unknown } | null;
  const topicId = typeof body?.topicId === "string" ? body.topicId : "";
  const card = teachCard(topicId);
  const turns = validTurns(body?.messages);
  if (!card || !turns) return new Response("Bad request.", { status: 400 });

  const { data: topic } = await supabase.from("topics").select("title, subjects(name, board, paper_label)").eq("id", topicId).single();
  const subject = (topic?.subjects ?? null) as unknown as { name: string; board: string; paper_label: string } | null;
  if (!topic || !subject) return new Response("Unknown topic.", { status: 404 });

  const client = new Anthropic();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const reply = client.beta.messages.stream({
          model: TUTOR_MODEL,
          max_tokens: 16000,
          // If a safety classifier declines, retry on Anthropic's recommended fallback model.
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          output_config: { effort: "medium" },
          system: tutorSystemPrompt({ board: subject.board, subject: subject.name, paper: subject.paper_label, topicTitle: topic.title, card }),
          messages: turns,
        });
        for await (const event of reply) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await reply.finalMessage();
        if (final.stop_reason === "refusal") {
          controller.enqueue(encoder.encode("\n\n(The tutor couldn't answer that one. Try rephrasing the question.)"));
        } else if (final.stop_reason === "max_tokens") {
          controller.enqueue(encoder.encode("\n\n(Answer cut short. Ask for the rest.)"));
        }
      } catch (error) {
        let message = "Something went wrong talking to the tutor.";
        if (error instanceof Anthropic.AuthenticationError) message = "The tutor's API key was rejected. Check ANTHROPIC_API_KEY.";
        else if (error instanceof Anthropic.RateLimitError) message = "The tutor is rate limited. Wait a minute and try again.";
        else if (error instanceof Anthropic.APIError) message = `Tutor error (${error.status}). Try again shortly.`;
        controller.enqueue(encoder.encode(`\n\n${message}`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
