import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";

interface AdminStubPageProps {
  title: string;
  description: string;
}

export default function AdminStubPage({ title, description }: AdminStubPageProps) {
  return (
    <div data-testid={`page-stub-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-foreground">{title}</h1>
        <p className="text-muted-foreground mt-1">Office of the Chief Justice and Trustee — Administration</p>
      </div>
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <p className="text-muted-foreground max-w-md mx-auto">{description}</p>
          <p className="text-xs text-muted-foreground">
            This module is managed through the Sovereign Admin panel.{" "}
            <Link href="/dashboard/admin" className="text-primary hover:underline">Return to Admin Dashboard</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
