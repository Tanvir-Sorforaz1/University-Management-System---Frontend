import { GoogleGenAI } from "@google/genai";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/server-session";

const MAX_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 4000;
const SYSTEM_INSTRUCTION = "You are a helpful assistant inside a university management system. Be concise. Do not invent student data, grades or fees.";
const TEMPORARY_UNAVAILABLE_MESSAGE = "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later";

type ChatMessage = { role: "user" | "model"; text: string };

function errorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object" || !("status" in error)) return undefined;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

async function wait(milliseconds: number) {
  await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  return (message.role === "user" || message.role === "model")
    && typeof message.text === "string"
    && message.text.length <= MAX_MESSAGE_LENGTH;
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!cookieStore.has(ACCESS_COOKIE) && !cookieStore.has(REFRESH_COOKIE)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request." }, { status: 400 });
  }

  const messages = body && typeof body === "object" ? (body as Record<string, unknown>).messages : undefined;
  if (!Array.isArray(messages) || messages.length > MAX_MESSAGES || messages.some((message) => !isChatMessage(message))) {
    return NextResponse.json({ message: "Invalid messages." }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ message: "AI assistant is unavailable." }, { status: 503 });

  try {
    const ai = new GoogleGenAI({ apiKey });
    const request = {
      model: "gemini-3.8-flash",
      contents: messages.map(({ role, text }) => ({ role, parts: [{ text }] })),
      config: { systemInstruction: SYSTEM_INSTRUCTION },
    };
    let response;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        response = await ai.models.generateContent(request);
        break;
      } catch (error) {
        if (errorStatus(error) !== 503 || attempt === 2) throw error;
        await wait(500 * (attempt + 1));
      }
    }
    if (!response) {
      throw new Error("Failed to get a valid response from the AI.");
    }
    return NextResponse.json({ text: response.text ?? "" });
  } catch (error) {
    console.error("Gemini request failed.", {
      status: errorStatus(error),
      message: error instanceof Error ? error.message : "Unknown Gemini error",
    });
    return NextResponse.json(
      { message: errorStatus(error) === 503 ? TEMPORARY_UNAVAILABLE_MESSAGE : "The AI assistant could not respond.please check your plan and billing details" },
      { status: 502 },
    );
  }
}