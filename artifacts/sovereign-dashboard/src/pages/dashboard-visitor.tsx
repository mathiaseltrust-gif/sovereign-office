import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "wouter";
import { Send, Loader2, Leaf } from "lucide-react";

const API = import.meta.env.VITE_API_BASE_URL ?? "";
const SERVICE_KEY = import.meta.env.VITE_SERVICE_KEY ?? "";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_QUESTIONS = [
  "How can I find out if I have indigenous roots?",
  "How do I trace my ancestral lineage?",
  "What questions should I ask my elders about our family history?",
  "Where do I start if I want to learn more about my heritage?",
];

const WELCOME_MESSAGE: ChatMessage = {
  role: "assistant",
  content:
    "Welcome. I'm a Heritage Guide — I'm here to help you explore questions about ancestry, indigenous identity, and family roots. This is a place for honest questions and unhurried answers.\n\nI don't hold memory between visits, and nothing you share here is stored. Every conversation is a fresh beginning.\n\nWhat's on your mind?",
};

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} gap-2`}>
      {!isUser && (
        <div className="shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
          <Leaf className="h-3.5 w-3.5 text-primary" />
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-muted text-foreground rounded-tl-sm"
        }`}
      >
        {msg.content}
      </div>
    </div>
  );
}

function HeritageGuideChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = { role: "user", content: trimmed };
    const history = messages.filter(m => m !== WELCOME_MESSAGE);
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const r = await fetch(`${API}/api/kaya/public`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(SERVICE_KEY ? { "x-service-key": SERVICE_KEY } : {}),
        },
        body: JSON.stringify({
          message: trimmed,
          history: history.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (r.status === 429) {
        setError("Take a moment — we ask that you give a little space between questions so each one can land.");
        setMessages(prev => prev.filter(m => m !== userMsg));
        return;
      }

      if (!r.ok) {
        setError("Something went quiet on our end. Please try again in a moment.");
        return;
      }

      const data = await r.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
    } catch {
      setError("A connection issue interrupted us. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [messages, loading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <div className="flex flex-col" style={{ height: 480 }}>
      {/* Message thread */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {messages.map((m, i) => (
          <MessageBubble key={i} msg={m} />
        ))}
        {loading && (
          <div className="flex justify-start gap-2">
            <div className="shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
              <Leaf className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
        {error && (
          <p className="text-[11px] text-center text-amber-700 bg-amber-50 rounded-lg px-3 py-2">{error}</p>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggested questions — only show if at start */}
      {messages.length === 1 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {SUGGESTED_QUESTIONS.map(q => (
            <button
              key={q}
              onClick={() => send(q)}
              className="text-[10px] px-2.5 py-1 rounded-full border border-primary/30 text-primary hover:bg-primary/5 transition-colors text-left"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border px-3 py-3 flex gap-2 items-end bg-background rounded-b-xl">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about ancestry or heritage…"
          className="text-sm resize-none min-h-[40px] max-h-[120px] flex-1 border-0 shadow-none focus-visible:ring-0 p-2 bg-muted/30 rounded-xl"
          rows={1}
          disabled={loading}
        />
        <Button
          size="sm"
          className="h-9 w-9 p-0 shrink-0 rounded-xl"
          onClick={() => send(input)}
          disabled={loading || !input.trim()}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}

const PUBLIC_RESOURCES = [
  { title: "Public Records Search", desc: "Search publicly available court records, filings, and instruments.", href: "/search" },
  { title: "Tribal Law Library", desc: "Browse publicly accessible tribal laws, statutes, and legal doctrines.", href: "/law" },
  { title: "Submit Press Inquiry", desc: "Submit a media inquiry or press access request.", href: "/complaints" },
];

export default function VisitorDashboard() {
  return (
    <div data-testid="page-visitor-dashboard" className="max-w-2xl space-y-8">
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-3xl font-serif font-bold text-foreground">Visitor & Media Portal</h1>
          <Badge variant="outline" className="border-amber-400 text-amber-700">Restricted Access</Badge>
        </div>
        <p className="text-muted-foreground mt-2">
          Welcome to the Mathias El Tribe Visitor Portal. Access is limited to publicly available information only.
          For tribal member services, please contact the Office of the Chief Justice and Trustee.
        </p>
      </div>

      {/* Heritage Guide Chat */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2 border-b border-border">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <Leaf className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Heritage Guide</CardTitle>
                <p className="text-[10px] text-muted-foreground">Ancestry · Identity · Lineage · Roots</p>
              </div>
            </div>
            <Badge variant="outline" className="text-[10px] border-muted-foreground/30 text-muted-foreground">
              No account required · Not saved
            </Badge>
          </div>
        </CardHeader>
        <HeritageGuideChat />
      </Card>

      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="pt-5">
          <p className="text-sm font-semibold text-amber-800 mb-1">Notice to Visitors and Media</p>
          <p className="text-sm text-amber-700">
            This portal is governed by the inherent sovereign authority of the Mathias El Tribe. All visitors
            and media representatives are subject to tribal protocols. Unauthorized access to restricted areas,
            recording without consent, or misrepresentation of tribal matters may result in immediate removal
            and referral to the Office of the Chief Justice.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Available Resources</h2>
        {PUBLIC_RESOURCES.map((r) => (
          <Link key={r.title} href={r.href}>
            <Card className="cursor-pointer hover:border-primary transition-colors">
              <CardContent className="pt-4 pb-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm text-foreground">{r.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{r.desc}</p>
                </div>
                <Button size="sm" variant="outline" className="shrink-0 ml-4">Open</Button>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm uppercase tracking-widest">Contact the Office of the Chief Justice and Trustee</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">For press credentials, official media inquiries, or tribal affairs assistance:</p>
          <div className="text-sm space-y-1">
            <p className="font-medium">Office of the Chief Justice & Trustee</p>
            <p className="text-muted-foreground">Mathias El Tribe — Sovereign Seat of Government</p>
            <p className="text-muted-foreground">All requests submitted through this portal are reviewed by tribal staff.</p>
          </div>
          <div className="pt-2">
            <Link href="/complaints">
              <Button size="sm">Submit Inquiry or Request</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
