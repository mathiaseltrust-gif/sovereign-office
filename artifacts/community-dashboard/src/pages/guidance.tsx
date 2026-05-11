import { useState } from "react";
import { Scale, Send, Clock, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import {
  useGetAiGuidance,
  useListAiGuidanceHistory,
  getListAiGuidanceHistoryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface GuidanceResult {
  answer: string;
  citations: string[];
  disclaimer: string;
}

export default function Guidance() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<GuidanceResult | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: history, isLoading: historyLoading } = useListAiGuidanceHistory();

  const getGuidance = useGetAiGuidance({
    mutation: {
      onSuccess: (data) => {
        setResult(data as unknown as GuidanceResult);
        queryClient.invalidateQueries({ queryKey: getListAiGuidanceHistoryQueryKey() });
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Could not retrieve guidance. Please try again.",
          variant: "destructive",
        });
      },
    },
  });

  const handleAsk = () => {
    if (!question.trim()) return;
    setResult(null);
    getGuidance.mutate({ data: { question } });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleAsk();
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-primary">Legal Guidance</h1>
        <p className="text-muted-foreground mt-1">
          Ask questions about your tribal rights, ICWA protections, trust status, and federal Indian law.
        </p>
      </div>

      {/* Question input */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Scale className="h-5 w-5 text-primary" />
            Ask a Legal Question
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="e.g. What are my rights under ICWA if a state agency tries to remove my child? Or: Does the federal trust responsibility cover my health care?"
            rows={4}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            data-testid="input-guidance-question"
          />
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-muted-foreground">Press Ctrl+Enter to submit</p>
            <Button
              onClick={handleAsk}
              disabled={!question.trim() || getGuidance.isPending}
              className="gap-2"
              data-testid="button-ask-guidance"
            >
              <Send className="h-4 w-4" />
              {getGuidance.isPending ? "Thinking..." : "Ask"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading state */}
      {getGuidance.isPending && (
        <Card className="border-primary/10 bg-primary/5">
          <CardContent className="py-6 space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/4 mt-4" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {result && !getGuidance.isPending && (
        <Card className="border-primary/30 bg-primary/5 animate-in fade-in duration-400" data-testid="guidance-result">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-primary">
              <Scale className="h-5 w-5" />
              Guidance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-foreground leading-relaxed whitespace-pre-wrap" data-testid="guidance-answer">
              {result.answer}
            </p>

            {result.citations && result.citations.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Citations</p>
                <div className="flex flex-wrap gap-2">
                  {result.citations.map((cite, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="text-xs font-normal border-primary/30 text-foreground"
                      data-testid={`citation-${i}`}
                    >
                      {cite}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {result.disclaimer && (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">{result.disclaimer}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* History */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-semibold text-lg">Recent Questions</h2>
        </div>

        {historyLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : !history || history.length === 0 ? (
          <Card className="py-8 text-center border-dashed">
            <CardContent>
              <p className="text-sm text-muted-foreground">Your guidance history will appear here.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2" data-testid="guidance-history">
            {history.map((record) => (
              <Card
                key={record.id}
                className="cursor-pointer hover:border-primary/30 transition-colors"
                data-testid={`history-record-${record.id}`}
                onClick={() => setExpandedHistory(expandedHistory === record.id ? null : record.id)}
              >
                <CardContent className="py-3 px-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-1">{record.question}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatDate(record.createdAt)}</p>
                    </div>
                    {expandedHistory === record.id
                      ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                      : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    }
                  </div>
                  {expandedHistory === record.id && (
                    <div className="mt-3 pt-3 border-t space-y-3">
                      <p className="text-sm text-foreground leading-relaxed">{record.answer}</p>
                      {record.citations && (record.citations as string[]).length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {(record.citations as string[]).map((cite, i) => (
                            <Badge key={i} variant="outline" className="text-xs font-normal">{cite}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
