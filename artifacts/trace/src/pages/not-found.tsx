import { Shield } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="flex items-center justify-center h-full p-6">
      <div className="text-center max-w-sm">
        <Shield className="mx-auto h-10 w-10 text-muted-foreground/40 mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-1">Page not found</h2>
        <p className="text-sm text-muted-foreground mb-4">
          The page you are looking for does not exist.
        </p>
        <Link href="/">
          <span className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium cursor-pointer hover:opacity-90 transition-opacity">
            Return to Dashboard
          </span>
        </Link>
      </div>
    </div>
  );
}
