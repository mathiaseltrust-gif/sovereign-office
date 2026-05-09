import { useState } from "react";
import { useClassifyText } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

export default function ClassifyPage() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<any>(null);
  const classify = useClassifyText();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    classify.mutate({ data: { text } }, {
      onSuccess: (data) => {
        setResult(data);
        toast({ title: "Classified", description: "Text classified through doctrine pipeline." });
      },
      onError: () => toast({ title: "Error", description: "Classification failed.", variant: "destructive" }),
    });
  };

  return (
    <div data-testid="page-classify">
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-foreground">Text Classification</h1>
        <p className="text-muted-foreground mt-1">Classify through the sovereign doctrine pipeline — generates NFR, task, and calendar event automatically</p>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="classify-text">Text to classify</Label>
              <Textarea
                id="classify-text"
                data-testid="input-classify-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={8}
                placeholder="Enter text describing an action, land use situation, or sovereign matter to classify through the doctrine pipeline…"
                className="mt-1"
              />
            </div>
            <Button type="submit" data-testid="button-classify" disabled={classify.isPending || !text.trim()}>
              {classify.isPending ? "Classifying…" : "Classify & Generate NFR"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-4 animate-in fade-in" data-testid="classify-result">
          <Card>
            <CardHeader><CardTitle className="text-sm">Classification Result</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Badge data-testid="badge-actor-type">Actor: {result.classification?.actorType}</Badge>
                <Badge variant="outline" data-testid="badge-land-status">Land: {result.classification?.landStatus}</Badge>
                <Badge variant="secondary" data-testid="badge-action-type">Action: {result.classification?.actionType}</Badge>
              </div>
            </CardContent>
          </Card>

          {result.doctrine && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Doctrines Applied</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {result.doctrine.doctrinesApplied?.length > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Doctrines</div>
                    <div className="flex flex-wrap gap-1">{result.doctrine.doctrinesApplied.map((d: string) => <Badge key={d} variant="outline" className="text-xs">{d}</Badge>)}</div>
                  </div>
                )}
                {result.doctrine.federalLaw?.length > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Federal Law</div>
                    <ul className="list-disc list-inside text-sm space-y-1">{result.doctrine.federalLaw.map((l: string) => <li key={l}>{l}</li>)}</ul>
                  </div>
                )}
                {result.doctrine.guardrails?.length > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Sovereignty Guardrails</div>
                    <ul className="list-disc list-inside text-sm space-y-1">{result.doctrine.guardrails.map((g: string) => <li key={g}>{g}</li>)}</ul>
                  </div>
                )}
                {result.doctrine.recommendation && (
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Recommendation</div>
                    <p className="text-sm font-medium">{result.doctrine.recommendation}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {result.nfr && (
              <Card>
                <CardHeader><CardTitle className="text-xs uppercase tracking-widest">NFR Created</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm font-medium">NFR #{result.nfr.id}</p>
                  <Badge variant="outline" className="mt-1">{result.nfr.status}</Badge>
                  {result.nfr.pdfUrl && <p className="text-xs text-muted-foreground mt-1">PDF available</p>}
                </CardContent>
              </Card>
            )}
            {result.task && (
              <Card>
                <CardHeader><CardTitle className="text-xs uppercase tracking-widest">Task Created</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm font-medium">{result.task.title}</p>
                  {result.task.dueDate && <p className="text-xs text-muted-foreground mt-1">Due: {new Date(result.task.dueDate).toLocaleDateString()}</p>}
                </CardContent>
              </Card>
            )}
            {result.calendarEvent && (
              <Card>
                <CardHeader><CardTitle className="text-xs uppercase tracking-widest">Calendar Event</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm font-medium">{result.calendarEvent.title}</p>
                  {result.calendarEvent.date && <p className="text-xs text-muted-foreground mt-1">{new Date(result.calendarEvent.date).toLocaleDateString()}</p>}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
