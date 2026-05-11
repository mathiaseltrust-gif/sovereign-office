import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function OnboardingPendingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="text-4xl mb-3">📋</div>
          <CardTitle className="text-xl font-serif">Lineage Under Review</CardTitle>
          <Badge variant="outline" className="mx-auto mt-2 text-amber-600 border-amber-400">Pending Review</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Thank you for submitting your lineage information. Our administrative team is reviewing
            your claim to confirm your descendant status.
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
            <p className="text-sm font-semibold text-amber-800">What happens next</p>
            <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
              <li>An administrator will review your lineage claim</li>
              <li>You will receive a notification once a decision is made</li>
              <li>Typical review time is 5–10 business days</li>
            </ul>
          </div>

          <div className="bg-muted rounded-lg p-4">
            <p className="text-sm font-semibold mb-1">While you wait</p>
            <p className="text-sm text-muted-foreground">
              You currently have limited visitor access to the system. Full member features will be
              unlocked once your lineage is verified.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Link href="/notifications">
              <Button variant="outline" className="w-full">Check Notifications</Button>
            </Link>
            <Link href="/dashboard/visitor">
              <Button variant="ghost" className="w-full text-muted-foreground">Continue as Visitor</Button>
            </Link>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            If you believe this is an error or have additional documentation, please contact the
            Sovereign Office directly.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
