import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AlertTriangle, CheckCircle2, FileSignature, KeyRound, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCurrentBearerToken, useAuth } from "@/components/auth-provider";
import { useToast } from "@/hooks/use-toast";

interface AgreementSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  emphasis?: "standard" | "removal" | "signature";
}
interface AgreementDocument {
  key: string; version: string; effectiveDate: string; title: string; subtitle: string;
  scope: string; preamble: string[]; sections: AgreementSection[]; signatureStatement: string;
}
interface AgreementStatus {
  agreement: AgreementDocument;
  contentHash: string;
  requiresSignature: boolean;
  microsoftAuthenticated: boolean;
  authenticatedIdentity: { name: string; email: string; role: string };
  acceptance: null | {
    id: number; signedName: string; signedEmail: string; roleAtSigning: string;
    signatureMethod: string; signatureReceipt: string; agreementVersion: string;
    contentHash: string; signedAt: string;
  };
}
function authHeaders(contentType=false): Record<string,string> {
  const token=getCurrentBearerToken();
  return { ...(token?{Authorization:`Bearer ${token}`}:{}), ...(contentType?{"Content-Type":"application/json"}:{}) };
}
async function loadStatus(): Promise<AgreementStatus> {
  const res=await fetch("/api/trustee-agreement/current",{headers:authHeaders()});
  if(!res.ok){const body=await res.json().catch(()=>({error:`HTTP ${res.status}`})); throw new Error(body.error??`HTTP ${res.status}`);}
  return res.json();
}

export default function TrusteeAgreementPage(){
  const {user,logout}=useAuth();
  const [,setLocation]=useLocation();
  const {toast}=useToast();
  const qc=useQueryClient();
  const [signedName,setSignedName]=useState(user?.name??"");
  const [ackDuties,setAckDuties]=useState(false);
  const [ackRemoval,setAckRemoval]=useState(false);
  const [ackSignature,setAckSignature]=useState(false);
  const params=new URLSearchParams(window.location.search);
  const nextPath=params.get("next");
  const safeNext=nextPath&&nextPath.startsWith("/")&&!nextPath.startsWith("//")?nextPath:"/dashboard/trustee";

  const {data:status,isLoading,error,refetch}=useQuery<AgreementStatus>({
    queryKey:["trustee-agreement-current"], queryFn:loadStatus, staleTime:30_000
  });
  useEffect(()=>{if(!signedName&&status?.authenticatedIdentity.name)setSignedName(status.authenticatedIdentity.name);},[signedName,status?.authenticatedIdentity.name]);

  const accept=useMutation({
    mutationFn:async()=>{
      const res=await fetch("/api/trustee-agreement/accept",{method:"POST",headers:authHeaders(true),body:JSON.stringify({
        signedName,acknowledgedDuties:ackDuties,acknowledgedRemoval:ackRemoval,acknowledgedElectronicSignature:ackSignature
      })});
      if(!res.ok){const body=await res.json().catch(()=>({error:`HTTP ${res.status}`}));throw new Error(body.error??`HTTP ${res.status}`);}
      return res.json();
    },
    onSuccess:async()=>{await qc.invalidateQueries({queryKey:["trustee-agreement-current"]});toast({title:"Trustee Agreement signed",description:"Your current Trustee authority acknowledgment is active."});setLocation(safeNext);},
    onError:(e:Error)=>toast({title:"Signature not recorded",description:e.message,variant:"destructive"}),
  });

  const reauthenticateMicrosoft=()=>{
    const target=`/trustee-agreement?next=${encodeURIComponent(safeNext)}`;
    logout();
    const base=(import.meta.env.BASE_URL as string).replace(/\/$/,"");
    window.location.assign(`${base}/login?next=${encodeURIComponent(target)}`);
  };

  if(isLoading)return <div className="py-16 text-center text-muted-foreground">Loading Trustee Agreement…</div>;
  if(error||!status)return <Card className="max-w-2xl mx-auto mt-8"><CardContent className="py-10 text-center space-y-3"><AlertTriangle className="h-8 w-8 mx-auto text-amber-600"/><p className="font-semibold">Unable to verify the Trustee Agreement.</p><p className="text-sm text-muted-foreground">{error instanceof Error?error.message:"Try again."}</p><Button onClick={()=>refetch()}>Retry</Button></CardContent></Card>;

  const {agreement,acceptance}=status;
  const canSign=status.microsoftAuthenticated&&status.requiresSignature;

  return <div className="max-w-5xl mx-auto space-y-6 pb-12" data-testid="page-trustee-agreement">
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div><p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">Board of Trustees · Governing Instrument</p><h1 className="text-3xl font-serif font-bold mt-1">{agreement.title}</h1><p className="text-muted-foreground mt-1">{agreement.subtitle}</p></div>
      <div className="flex gap-2 flex-wrap"><Badge variant="outline">Version {agreement.version}</Badge><Badge variant="outline">Effective {agreement.effectiveDate}</Badge>{acceptance?<Badge className="bg-emerald-700 text-white">Signed & Current</Badge>:<Badge className="bg-amber-600 text-white">Signature Required</Badge>}</div>
    </div>

    <Card className="border-slate-300"><CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4"/>Scope of Trustee Authority</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><p>{agreement.scope}</p>{agreement.preamble.map((p,i)=><p key={i} className="text-muted-foreground leading-relaxed">{p}</p>)}<p className="text-xs font-mono text-muted-foreground break-all">SHA-256: {status.contentHash}</p></CardContent></Card>

    <div className="space-y-4">{agreement.sections.map(section=><Card key={section.heading} className={section.emphasis==="removal"?"border-amber-300 bg-amber-50/40":section.emphasis==="signature"?"border-blue-300 bg-blue-50/30":""}><CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2">{section.emphasis==="removal"&&<AlertTriangle className="h-4 w-4 text-amber-700"/>}{section.emphasis==="signature"&&<FileSignature className="h-4 w-4 text-blue-700"/>}{section.heading}</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">{section.paragraphs?.map((p,i)=><p key={i} className="leading-relaxed">{p}</p>)}{section.bullets&&<ul className="list-disc pl-5 space-y-2 text-muted-foreground">{section.bullets.map((item,i)=><li key={i}>{item}</li>)}</ul>}</CardContent></Card>)}</div>

    {acceptance?<Card className="border-emerald-300 bg-emerald-50/40"><CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-700"/>Current Agreement Signed</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><p><span className="font-medium">Signed by:</span> {acceptance.signedName}</p><p><span className="font-medium">Microsoft identity:</span> {acceptance.signedEmail}</p><p><span className="font-medium">Signed:</span> {new Date(acceptance.signedAt).toLocaleString()}</p><p><span className="font-medium">Method:</span> Microsoft Entra authenticated electronic signature</p><p className="text-xs font-mono break-all text-muted-foreground">Receipt: {acceptance.signatureReceipt}</p><div className="pt-2"><Button onClick={()=>setLocation(safeNext)}>Continue to Trustee Workspace</Button></div></CardContent></Card>:
    <Card className="border-primary"><CardHeader><CardTitle className="text-lg flex items-center gap-2"><FileSignature className="h-5 w-5"/>Execute Trustee Agreement</CardTitle></CardHeader><CardContent className="space-y-5">
      <div className="rounded-md border bg-muted/30 p-3 text-sm"><p className="font-medium">{status.authenticatedIdentity.name||user?.name}</p><p className="text-xs text-muted-foreground">{status.authenticatedIdentity.email} · {status.authenticatedIdentity.role}</p><div className="flex items-center gap-2 mt-2"><KeyRound className="h-4 w-4"/>{status.microsoftAuthenticated?<span className="text-emerald-700 font-medium">Microsoft-authenticated signing session verified</span>:<span className="text-amber-700 font-medium">Microsoft re-authentication required before signing</span>}</div></div>
      {!status.microsoftAuthenticated&&<div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm space-y-3"><p>You may read the Agreement in this session, but execution requires a fresh Microsoft-authenticated Sovereign Office session.</p><Button variant="outline" onClick={reauthenticateMicrosoft}>Re-authenticate with Microsoft</Button></div>}
      <div><Label htmlFor="trustee-signed-name">Electronic signature — type the name you intend to sign</Label><Input id="trustee-signed-name" value={signedName} onChange={e=>setSignedName(e.target.value)} placeholder="Trustee name" className="mt-1"/></div>
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={ackDuties} onChange={e=>setAckDuties(e.target.checked)}/><span>I have read and understand the fiduciary duties, authority limits, training, upkeep, security, conflict, accounting, and continuity obligations stated above.</span></label>
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={ackRemoval} onChange={e=>setAckRemoval(e.target.checked)}/><span>I understand what can constitute suspension or removal and understand the distinction between correctable good-faith errors, emergency suspension, and a documented final removal decision.</span></label>
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={ackSignature} onChange={e=>setAckSignature(e.target.checked)}/><span>{agreement.signatureStatement}</span></label>
      <div className="rounded-md bg-slate-50 border p-3 text-xs text-muted-foreground">This acceptance is recorded as a Microsoft-authenticated electronic signature with the exact Agreement snapshot, SHA-256 content fingerprint, signing timestamp, and server-generated signature receipt.</div>
      <Button disabled={!canSign||!signedName.trim()||!ackDuties||!ackRemoval||!ackSignature||accept.isPending} onClick={()=>accept.mutate()}>{accept.isPending?"Signing…":"Sign Trustee Agreement"}</Button>
    </CardContent></Card>}
  </div>;
}
