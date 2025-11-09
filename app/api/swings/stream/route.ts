import { swingsBus } from "@/lib/bus";

export const runtime = "nodejs";

export async function GET() {
  let unsubscribe: (() => void) | null = null;
  let pingInterval: NodeJS.Timeout | null = null;
  let isActive = true;

  return new Response(
    new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        console.log("[SSE /swings/stream] 🔌 New SSE connection established");
        
        const send = (obj: any) => {
          if (!isActive) return;
          try {
            const data = `data: ${JSON.stringify(obj)}\n\n`;
            console.log("[SSE /swings/stream] 📤 Sending swing data:", obj);
            controller.enqueue(encoder.encode(data));
          } catch (error) {
            console.error('[SSE /swings/stream] ❌ Error sending SSE data:', error);
            isActive = false;
          }
        };
        
        // Subscribe to swing events
        console.log("[SSE /swings/stream] 👂 Subscribing to swing events");
        unsubscribe = swingsBus.on((evt) => {
          if (!isActive) return;
          console.log("[SSE /swings/stream] 📨 Received swing event from bus:", evt);
          send(evt);
        });
        
        // Keep-alive ping every 20s
        pingInterval = setInterval(() => {
          if (!isActive) {
            if (pingInterval) clearInterval(pingInterval);
            return;
          }
          try {
            controller.enqueue(encoder.encode(":\n\n"));
          } catch (error) {
            // Stream may be closed
            isActive = false;
            if (pingInterval) clearInterval(pingInterval);
          }
        }, 20000);
      },
      cancel() {
        // Cleanup on cancel
        console.log("[SSE /swings/stream] 🧹 Cleaning up SSE connection (stream cancelled)");
        isActive = false;
        if (unsubscribe) {
          unsubscribe();
          unsubscribe = null;
        }
        if (pingInterval) {
          clearInterval(pingInterval);
          pingInterval = null;
        }
      },
    }),
    {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    }
  );
}

