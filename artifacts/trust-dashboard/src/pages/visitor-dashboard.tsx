import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Scale, LogOut, Send, CheckCircle2, FileText, Building2, Globe, Phone } from "lucide-react";

interface RequestItem {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const REQUEST_TYPES: RequestItem[] = [
  {
    id: "public_statement",
    label: "Request Public Statement",
    description: "Request an official public statement from the Office of the Chief Justice & Trustee.",
    icon: FileText,
  },
  {
    id: "press_access",
    label: "Request Press Access",
    description: "Apply for credentialed press access to tribal proceedings or public events.",
    icon: Globe,
  },
  {
    id: "charitable_trust_info",
    label: "Request Charitable Trust Information",
    description: "Request publicly available information about the Mathias El Tribe Charitable Trust.",
    icon: Building2,
  },
  {
    id: "niac_info",
    label: "Request NIAC Information",
    description: "Request general information about the National Indigenous Affairs Council.",
    icon: FileText,
  },
  {
    id: "iee_verification",
    label: "Request I.E.E. Verification",
    description: "Request verification of Indigenous Economic Enterprise standing or certification.",
    icon: CheckCircle2,
  },
  {
    id: "tribal_contact",
    label: "Request Tribal Contact",
    description: "Request official contact with a tribal representative for governmental matters.",
    icon: Phone,
  },
];

export default function VisitorDashboard() {
  const { user, logout } = useAuth();
  const [submitted, setSubmitted] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [org, setOrg] = useState("");
  const [contact, setContact] = useState("");

  function handleSubmit(id: string) {
    setSubmitted((prev) => [...prev, id]);
    setActive(null);
    setMessage("");
    setOrg("");
    setContact("");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-sidebar border-b border-sidebar-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center">
            <Scale className="w-4 h-4 text-sidebar-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-sidebar-primary leading-tight">Mathias El Tribe</p>
            <p className="text-[10px] text-sidebar-foreground/60 leading-tight">Office of the Chief Justice & Trustee — Public Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-sidebar-foreground/70">
            {user?.name} · <span className="capitalize">Visitor / Media</span>
          </span>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-foreground">Visitor & Media Portal</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-lg mx-auto">
            Use the forms below to submit official requests to the Mathias El Tribe. All requests are reviewed by the Office of the Chief Justice & Trustee.
          </p>
        </div>

        {submitted.length > 0 && (
          <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900 rounded-xl px-5 py-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-800 dark:text-green-400">
                  {submitted.length} request{submitted.length !== 1 ? "s" : ""} submitted
                </p>
                <ul className="mt-1 space-y-0.5">
                  <li className="text-xs text-green-700 dark:text-green-500">Your request has been submitted.</li>
                  <li className="text-xs text-green-700 dark:text-green-500">Processing time varies.</li>
                  <li className="text-xs text-green-700 dark:text-green-500">You will be contacted if approved.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {REQUEST_TYPES.map((req) => {
            const Icon = req.icon;
            const done = submitted.includes(req.id);
            const open = active === req.id;

            return (
              <div
                key={req.id}
                className={`bg-card border rounded-xl shadow-sm overflow-hidden transition-all ${
                  done ? "border-green-200 dark:border-green-900 opacity-70" : "border-card-border"
                }`}
              >
                <button
                  type="button"
                  disabled={done}
                  onClick={() => setActive(open ? null : req.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-muted/30 transition-colors disabled:cursor-not-allowed"
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    done
                      ? "bg-green-100 dark:bg-green-900/30"
                      : "bg-muted"
                  }`}>
                    {done
                      ? <CheckCircle2 className="w-4.5 h-4.5 text-green-600 dark:text-green-400" />
                      : <Icon className="w-4 h-4 text-muted-foreground" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                      {req.label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{req.description}</p>
                  </div>
                  {done ? (
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium flex-shrink-0">Submitted</span>
                  ) : (
                    <span className="text-xs text-primary font-medium flex-shrink-0">{open ? "Cancel" : "Submit →"}</span>
                  )}
                </button>

                {open && !done && (
                  <div className="px-5 pb-5 border-t border-card-border">
                    <p className="text-xs text-muted-foreground pt-4 pb-3">{req.description}</p>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium mb-1">Your Name / Organization</label>
                        <input
                          value={org}
                          onChange={(e) => setOrg(e.target.value)}
                          placeholder="Name or organization making this request"
                          className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Contact Email or Phone</label>
                        <input
                          value={contact}
                          onChange={(e) => setContact(e.target.value)}
                          placeholder="How should we reach you?"
                          className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Message (optional)</label>
                        <textarea
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          placeholder="Provide any additional context for your request…"
                          rows={3}
                          className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSubmit(req.id)}
                        disabled={!org.trim() || !contact.trim()}
                        className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        <Send className="w-4 h-4" /> Submit Request
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Mathias El Tribe — A Sovereign Nation Exercising Inherent Authority Under Tribal, Federal, and International Law.
          </p>
        </div>
      </div>
    </div>
  );
}
