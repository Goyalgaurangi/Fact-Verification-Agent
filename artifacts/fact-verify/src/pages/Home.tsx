import React, { useState, useRef, useEffect } from 'react';
import { useInvestigate } from '@workspace/api-client-react';
import { Shield, ShieldAlert, ShieldCheck, Microscope, Search, SearchCode, Scale, Database, ChevronDown, ChevronRight, FileImage, UploadCloud, X, ArrowRight } from 'lucide-react';
import type { InvestigateResult, AgentStep, VerifiedClaim, SourceItem } from '@workspace/api-client-react/src/generated/api.schemas';

// Convert file to base64
const toBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      let encoded = reader.result?.toString() || '';
      // Strip data:image/png;base64, prefix
      const commaIdx = encoded.indexOf(',');
      if (commaIdx !== -1) {
        encoded = encoded.substring(commaIdx + 1);
      }
      resolve(encoded);
    };
    reader.onerror = error => reject(error);
  });

function classNames(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

// --- Components ---

const AgentIcon = ({ agentId, className }: { agentId: string; className?: string }) => {
  switch (agentId) {
    case 'research': return <Microscope className={className} />;
    case 'verification': return <SearchCode className={className} />;
    case 'skeptic': return <Scale className={className} />;
    case 'final': return <Database className={className} />;
    default: return <Search className={className} />;
  }
};

const getAgentColor = (agentId: string) => {
  switch (agentId) {
    case 'research': return 'text-blue-400 border-blue-500/30 bg-blue-500/10';
    case 'verification': return 'text-purple-400 border-purple-500/30 bg-purple-500/10';
    case 'skeptic': return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
    case 'final': return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    default: return 'text-gray-400 border-gray-500/30 bg-gray-500/10';
  }
};

const getAgentAccent = (agentId: string) => {
  switch (agentId) {
    case 'research': return 'bg-blue-500';
    case 'verification': return 'bg-purple-500';
    case 'skeptic': return 'bg-amber-500';
    case 'final': return 'bg-emerald-500';
    default: return 'bg-gray-500';
  }
};

const TraceMessage = ({ step, index, visible }: { step: AgentStep; index: number; visible: boolean }) => {
  if (!visible) return null;
  
  return (
    <div 
      className="flex gap-4 p-4 rounded-lg bg-card/40 border border-border/50 animate-message-reveal shadow-sm relative overflow-hidden"
      style={{ animationFillMode: 'forwards' }}
    >
      <div className={classNames("absolute left-0 top-0 bottom-0 w-1", getAgentAccent(step.agent_id))} />
      <div className={classNames("flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border", getAgentColor(step.agent_id))}>
        <AgentIcon agentId={step.agent_id} className="w-5 h-5" />
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm tracking-wide text-foreground">{step.agent}</span>
          <span className="text-xs text-muted-foreground font-mono">{new Date(step.timestamp).toLocaleTimeString()}</span>
        </div>
        <p className="text-sm text-foreground/80 leading-relaxed font-mono whitespace-pre-wrap">{step.message}</p>
      </div>
    </div>
  );
};

const VerdictBadge = ({ verdict }: { verdict: string }) => {
  if (verdict === 'Verified') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/15 border border-success/30 text-success text-xs font-semibold uppercase tracking-wider">
        <ShieldCheck className="w-3.5 h-3.5" />
        Verified
      </div>
    );
  }
  if (verdict === 'Partially Verified') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-warning/15 border border-warning/30 text-warning text-xs font-semibold uppercase tracking-wider">
        <Shield className="w-3.5 h-3.5" />
        Partial
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/15 border border-destructive/30 text-destructive text-xs font-semibold uppercase tracking-wider">
      <ShieldAlert className="w-3.5 h-3.5" />
      Low Verif
    </div>
  );
};

const SourceList = ({ sources }: { sources: SourceItem[] }) => {
  const [expanded, setExpanded] = useState(false);
  
  if (!sources || sources.length === 0) return null;
  
  return (
    <div className="mt-3">
      <button 
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium group"
      >
        {expanded ? <ChevronDown className="w-3 h-3 group-hover:text-primary transition-colors" /> : <ChevronRight className="w-3 h-3 group-hover:text-primary transition-colors" />}
        {sources.length} {sources.length === 1 ? 'Source' : 'Sources'}
      </button>
      
      {expanded && (
        <div className="mt-2 space-y-2 pl-4 border-l border-border/50">
          {sources.map((s, i) => (
            <a 
              key={i} 
              href={s.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block p-2 rounded-md bg-card/30 hover:bg-card/80 border border-transparent hover:border-border/50 transition-all text-xs"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-primary hover:underline line-clamp-1">{s.title}</span>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <span className="text-[10px] uppercase tracking-wider bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                    {s.source_type.replace('_', ' ')}
                  </span>
                  <span className={classNames(
                    "text-[10px] font-mono px-1.5 py-0.5 rounded",
                    s.reliability_score >= 80 ? "text-success bg-success/10" : 
                    s.reliability_score >= 50 ? "text-warning bg-warning/10" : "text-destructive bg-destructive/10"
                  )}>
                    {s.reliability_score}/100
                  </span>
                </div>
              </div>
              <span className="text-muted-foreground line-clamp-1 text-[10px]">{s.url}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

const Progress = ({ value, className }: { value: number, className?: string }) => {
  const isHigh = value >= 80;
  const isMed = value >= 50 && value < 80;
  
  return (
    <div className={classNames("w-full bg-secondary rounded-full h-1.5 overflow-hidden", className)}>
      <div 
        className={classNames(
          "h-full rounded-full transition-all duration-1000 ease-out",
          isHigh ? "bg-success" : isMed ? "bg-warning" : "bg-destructive"
        )}
        style={{ width: `${value}%` }}
      />
    </div>
  );
};

export default function Home() {
  const [query, setQuery] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [visibleStepCount, setVisibleStepCount] = useState(0);
  
  const investigateMutation = useInvestigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const traceEndRef = useRef<HTMLDivElement>(null);
  
  // Status poller
  const [statusIdx, setStatusIdx] = useState(0);
  const statuses = [
    "Waking Research Agent...",
    "Searching web and academic databases...",
    "Extracting verifiable claims...",
    "Cross-referencing sources...",
    "Skeptic Agent challenging evidence...",
    "Detecting conflicting information...",
    "Calculating final confidence scores...",
    "Finalizing report..."
  ];

  useEffect(() => {
    let interval: number;
    if (investigateMutation.isPending) {
      interval = window.setInterval(() => {
        setStatusIdx(prev => (prev + 1) % statuses.length);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [investigateMutation.isPending, statuses.length]);

  // Trace animation
  useEffect(() => {
    if (investigateMutation.data?.agent_trace) {
      const traceCount = investigateMutation.data.agent_trace.length;
      if (visibleStepCount < traceCount) {
        const timer = setTimeout(() => {
          setVisibleStepCount(prev => prev + 1);
        }, 600);
        return () => clearTimeout(timer);
      } else {
        // Auto-scroll when new bubbles appear
        setTimeout(() => {
          traceEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } else {
      setVisibleStepCount(0);
    }
  }, [investigateMutation.data, visibleStepCount]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp')) {
      setImageFile(file);
      const url = URL.createObjectURL(file);
      setImagePreview(url);
    }
  };
  
  const removeImage = () => {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp')) {
      setImageFile(file);
      const url = URL.createObjectURL(file);
      setImagePreview(url);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query && !imageFile) return;

    let base64 = null;
    let mimeType = null;

    if (imageFile) {
      base64 = await toBase64(imageFile);
      mimeType = imageFile.type;
    }

    setVisibleStepCount(0);
    investigateMutation.mutate({
      data: {
        query: query || null,
        image_base64: base64,
        image_mime_type: mimeType
      }
    });
  };

  const setExample = () => {
    removeImage();
    const exampleQuery = "Is electric aviation commercially viable?";
    setQuery(exampleQuery);
    // Needs a tick for React to update state before form submission
    setTimeout(() => {
      setVisibleStepCount(0);
      investigateMutation.mutate({
        data: {
          query: exampleQuery,
          image_base64: null,
          image_mime_type: null
        }
      });
    }, 50);
  };

  const data = investigateMutation.data;
  const isRunning = investigateMutation.isPending;
  const error = investigateMutation.error;
  const hasResult = !!data;
  
  const allTraceVisible = data ? visibleStepCount >= data.agent_trace.length : false;

  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground selection:bg-primary/30 font-sans dark">
      {/* Top Nav/Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-primary/20 border border-primary/50 flex items-center justify-center">
              <Microscope className="w-5 h-5 text-primary" />
            </div>
            <h1 className="font-bold tracking-tight text-lg flex items-center gap-2">
              DeepVerify 
              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-muted text-muted-foreground tracking-widest border border-border/50">Sys:Active</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-4 text-sm font-mono text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className={classNames("w-2 h-2 rounded-full", isRunning ? "bg-amber-500 animate-pulse" : "bg-emerald-500")} />
              {isRunning ? 'Processing...' : 'Ready'}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12 space-y-12">
        
        {/* Input Section - Moves up when running/has result */}
        <section className={classNames(
          "transition-all duration-700 ease-in-out max-w-3xl mx-auto",
          (isRunning || hasResult) ? "scale-95 opacity-80" : "scale-100 opacity-100 py-12"
        )}>
          {!isRunning && !hasResult && (
            <div className="text-center space-y-4 mb-8">
              <h2 className="text-4xl font-bold tracking-tight">Investigate a Claim</h2>
              <p className="text-muted-foreground text-lg">Deploy a multi-agent swarm to research, verify, and challenge any assertion.</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 relative">
            <div className="relative group rounded-2xl bg-card border border-border/50 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 transition-all shadow-xl shadow-black/20 flex flex-col sm:flex-row overflow-hidden">
              
              <div className="flex-1 p-2 flex flex-col">
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Enter a claim, article text, or question..."
                  className="w-full h-32 sm:h-full min-h-[120px] bg-transparent resize-none p-4 outline-none text-base placeholder:text-muted-foreground/60"
                  disabled={isRunning}
                />
              </div>
              
              <div 
                className={classNames(
                  "w-full sm:w-64 border-t sm:border-t-0 sm:border-l border-border/50 bg-muted/20 p-4 flex flex-col items-center justify-center gap-3 transition-colors",
                  !imageFile && !isRunning && "hover:bg-muted/40 cursor-pointer"
                )}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => !imageFile && !isRunning && fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageUpload} 
                  accept="image/png, image/jpeg, image/webp" 
                  className="hidden" 
                  disabled={isRunning}
                />
                
                {imagePreview ? (
                  <div className="relative w-full h-full min-h-[100px] rounded-lg overflow-hidden border border-border group/img">
                    <img src={imagePreview} alt="Upload preview" className="w-full h-full object-cover" />
                    {!isRunning && (
                      <button 
                        type="button" 
                        onClick={(e) => { e.stopPropagation(); removeImage(); }}
                        className="absolute top-2 right-2 p-1 bg-black/60 hover:bg-black text-white rounded-full transition-colors opacity-0 group-hover/img:opacity-100"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-full bg-background border border-border/50 flex items-center justify-center">
                      <UploadCloud className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-sm font-medium">Attach evidence</p>
                      <p className="text-[10px] text-muted-foreground font-mono">PNG, JPG up to 5MB</p>
                    </div>
                  </>
                )}
              </div>
            </div>
            
            <div className="flex items-center justify-between px-2">
              <button
                type="button"
                onClick={setExample}
                disabled={isRunning}
                className="text-xs font-mono text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
              >
                <ArrowRight className="w-3 h-3" />
                Try an example
              </button>
              
              <button
                type="submit"
                disabled={isRunning || (!query && !imageFile)}
                className="px-6 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm transition-all shadow-[0_0_20px_rgba(var(--color-primary),0.2)] hover:shadow-[0_0_30px_rgba(var(--color-primary),0.4)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isRunning ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Investigating
                  </>
                ) : (
                  'Deploy Agents'
                )}
              </button>
            </div>
          </form>

          {error && (
            <div className="mt-6 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive flex gap-3 animate-in fade-in slide-in-from-top-4">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <div>
                <h4 className="font-semibold text-sm">System Error</h4>
                <p className="text-sm opacity-90">{error.error || "An unknown error occurred during execution."}</p>
              </div>
            </div>
          )}
        </section>

        {/* Running Status overlay */}
        {isRunning && !hasResult && (
          <section className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
            <div className="p-8 rounded-2xl bg-card border border-primary/20 shadow-[0_0_40px_-10px_rgba(var(--color-primary),0.1)] text-center space-y-8">
              <div className="flex justify-center gap-6">
                {['research', 'verification', 'skeptic', 'final'].map((agent, i) => {
                  const isActive = i <= (statusIdx % 4);
                  return (
                    <div key={agent} className={classNames(
                      "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500 border relative",
                      isActive ? getAgentColor(agent) : "text-muted-foreground border-border bg-muted/20 grayscale opacity-40",
                      i === (statusIdx % 4) && "scale-110 shadow-lg shadow-[var(--tw-shadow-color)] " + getAgentColor(agent).split(' ')[1]
                    )}>
                      <AgentIcon agentId={agent} className="w-5 h-5" />
                      {i === (statusIdx % 4) && (
                        <span className="absolute -bottom-2 -right-2 w-3 h-3 rounded-full bg-primary animate-ping" />
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="space-y-2">
                <p className="font-mono text-sm text-primary uppercase tracking-widest animate-pulse">
                  {statuses[statusIdx]}
                </p>
                <p className="text-xs text-muted-foreground">Swarm execution in progress. This may take up to a minute.</p>
              </div>
            </div>
          </section>
        )}

        {/* Trace Output */}
        {hasResult && data && (
          <section className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            
            {/* Context/Input Summary */}
            <div className="flex items-start gap-4 p-5 rounded-xl bg-card border border-border">
              <div className="p-2 rounded-lg bg-secondary text-muted-foreground">
                <FileImage className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-mono uppercase text-muted-foreground tracking-wider mb-1">Target</h3>
                <p className="text-sm font-medium leading-relaxed">"{data.query}"</p>
              </div>
            </div>

            {/* Agent Trace Transcript */}
            <div className="space-y-4 pb-4">
              <div className="flex items-center gap-3 px-2">
                <div className="h-px bg-border flex-1" />
                <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Agent Communications</span>
                <div className="h-px bg-border flex-1" />
              </div>

              <div className="space-y-3">
                {data.agent_trace.map((step, i) => (
                  <TraceMessage key={i} step={step} index={i} visible={i < visibleStepCount} />
                ))}
                <div ref={traceEndRef} />
              </div>
            </div>

            {/* Final Report (Reveals after trace finishes) */}
            {allTraceVisible && (
              <div className="pt-8 border-t border-border animate-in fade-in slide-in-from-bottom-8 duration-1000 space-y-6">
                <div className="flex items-end justify-between">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-3">
                      <Database className="w-6 h-6 text-emerald-500" />
                      Final Verified Claims
                    </h2>
                    <p className="text-muted-foreground text-sm mt-1">Deterministically synthesized by Final Agent.</p>
                  </div>
                </div>

                <div className="grid gap-6">
                  {data.claims.map((claim) => (
                    <div key={claim.id} className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                      <div className="p-5 border-b border-border/50 bg-card/50">
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <p className="text-base font-medium leading-relaxed flex-1">{claim.claim_text}</p>
                          <VerdictBadge verdict={claim.verdict} />
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs font-mono">
                          <div className="flex-1">
                            <div className="flex justify-between mb-1.5">
                              <span className="text-muted-foreground">Confidence Score</span>
                              <span className="font-bold">{claim.confidence_score}%</span>
                            </div>
                            <Progress value={claim.confidence_score} />
                          </div>
                          <div className="w-px h-8 bg-border" />
                          <div className="flex flex-col gap-1 w-32 shrink-0">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Sources</span>
                              <span>{claim.source_count}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Avg Rel.</span>
                              <span className={claim.avg_reliability >= 80 ? 'text-success' : claim.avg_reliability >= 50 ? 'text-warning' : 'text-destructive'}>
                                {claim.avg_reliability}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {(claim.skeptic_note || claim.outdated_or_conflicting) && (
                        <div className="p-4 bg-amber-500/5 border-b border-border/50 flex gap-3">
                          <Scale className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          <div>
                            <span className="text-xs font-bold uppercase tracking-wider text-amber-500 block mb-1">Skeptic's Note</span>
                            <p className="text-sm text-foreground/80 leading-relaxed">{claim.skeptic_note}</p>
                          </div>
                        </div>
                      )}

                      <div className="p-2 px-4 bg-muted/10">
                        <SourceList sources={claim.sources} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
