import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/components/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, LogOut, Loader2, AlertCircle, Database, Calendar } from "lucide-react";
import { format } from "date-fns";

interface TierTransition {
  id: string;
  fromTier: "free" | "pro" | "premium";
  toTier: "free" | "pro" | "premium";
  triggeredBy: string;
  eventType: string | null;
  createdAt: string;
}

interface TierHistoryResponse {
  transitions: TierTransition[];
  total: number;
}

export default function Lookup() {
  const { adminKey, setAdminKey, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TierHistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/");
    }
  }, [isAuthenticated, setLocation]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim()) return;

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId.trim())}/tier-history`, {
        method: "GET",
        headers: {
          "X-Admin-Key": adminKey || "",
          "Content-Type": "application/json",
        },
      });

      if (response.status === 401 || response.status === 403) {
        setAdminKey(null); // Key invalid or expired
        return;
      }

      if (response.status === 404) {
        setError("User not found.");
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.error || `Server error: ${response.status}`);
        return;
      }

      const result: TierHistoryResponse = await response.json();
      setData(result);
    } catch (err) {
      setError("Network error. Could not connect to API.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setAdminKey(null);
    setLocation("/");
  };

  const getTierBadgeProps = (tier: string) => {
    switch (tier) {
      case "free":
        return { variant: "outline" as const, className: "bg-muted text-muted-foreground border-muted-foreground/20 font-mono text-xs" };
      case "pro":
        return { variant: "default" as const, className: "bg-primary text-primary-foreground font-mono text-xs" };
      case "premium":
        return { variant: "default" as const, className: "bg-chart-2 text-primary-foreground font-mono text-xs" };
      default:
        return { variant: "secondary" as const, className: "font-mono text-xs" };
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground flex flex-col">
      <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-primary" />
          <h1 className="font-semibold tracking-tight text-lg">RubAI Ops <span className="text-muted-foreground text-sm font-normal ml-2">/ Tier History</span></h1>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground" data-testid="button-logout">
          <LogOut className="w-4 h-4 mr-2" />
          Lock Session
        </Button>
      </header>

      <main className="flex-1 p-6 max-w-6xl w-full mx-auto space-y-6">
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">User Lookup</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex gap-3">
              <Input
                placeholder="Enter Clerk User ID (e.g. user_2Xy...)"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="font-mono text-sm max-w-md h-10"
                data-testid="input-user-id"
                autoFocus
              />
              <Button type="submit" disabled={loading || !userId.trim()} className="h-10 px-6" data-testid="button-search">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                Search
              </Button>
            </form>
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-md bg-destructive/10 p-4 border border-destructive/20 flex items-center gap-3 text-destructive">
            <AlertCircle className="w-5 h-5" />
            <p className="text-sm font-medium" data-testid="text-error">{error}</p>
          </div>
        )}

        {data && (
          <Card className="border-border shadow-sm overflow-hidden flex flex-col">
            <div className="bg-muted/30 px-6 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Results for:</span>
                <code className="bg-muted px-2 py-0.5 rounded text-xs font-semibold" data-testid="text-result-user-id">{userId}</code>
              </div>
              <Badge variant="secondary" className="font-mono text-xs" data-testid="text-total-count">
                {data.total} Transitions
              </Badge>
            </div>
            
            {data.transitions.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center justify-center">
                <Calendar className="w-12 h-12 text-muted-foreground/20 mb-4" />
                <h3 className="text-lg font-medium text-foreground">No tier history</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                  This user has no recorded tier transitions. They are likely a new user on the default free tier.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/10">
                    <TableRow>
                      <TableHead className="w-[200px] whitespace-nowrap">Timestamp</TableHead>
                      <TableHead>Transition</TableHead>
                      <TableHead>Triggered By</TableHead>
                      <TableHead>Event Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.transitions.map((transition, index) => (
                      <TableRow key={transition.id || index} data-testid={`row-transition-${index}`}>
                        <TableCell className="font-mono text-xs whitespace-nowrap text-muted-foreground">
                          {format(new Date(transition.createdAt), "MMM d, yyyy HH:mm:ss")}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge {...getTierBadgeProps(transition.fromTier)} data-testid={`badge-from-${index}`}>
                              {transition.fromTier}
                            </Badge>
                            <span className="text-muted-foreground/50 font-bold text-xs">→</span>
                            <Badge {...getTierBadgeProps(transition.toTier)} data-testid={`badge-to-${index}`}>
                              {transition.toTier}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {transition.triggeredBy}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {transition.eventType || <span className="opacity-50">—</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        )}
      </main>
    </div>
  );
}
