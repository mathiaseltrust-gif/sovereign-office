import { Link } from "wouter";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <div className="text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
        <h2 className="text-xl font-semibold text-foreground mb-1">Page Not Found</h2>
        <p className="text-sm text-muted-foreground mb-4">That page doesn't exist.</p>
        <Link href="/jurisdiction">
          <span className="text-sm text-primary underline cursor-pointer">
            Go to Jurisdiction Lookup
          </span>
        </Link>
      </div>
    </div>
  );
}
