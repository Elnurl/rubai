import React, { useState, useRef } from 'react';
import { Mic, ArrowUp, Plus, User, Battery, Wifi, Signal, CheckCircle2, Circle, ArrowRight } from 'lucide-react';
import './_group.css';

export function Home() {
  const [activeCard, setActiveCard] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const goals = [
    {
      id: 1,
      title: "Run a half marathon in 12 weeks",
      progress: 33,
      context: "Week 4 of 12",
      lastEntry: "Ran 5km on Tuesday",
      nextAction: "Long run (8km) this weekend",
      accent: "var(--primary-green)",
      bgStart: "#14251B",
      bgEnd: "var(--elevated-card)",
      tasks: [
        { done: true, label: "5km interval run" },
        { done: false, label: "8km long run" },
        { done: false, label: "Rest and recover" }
      ]
    },
    {
      id: 2,
      title: "Ship rubai v1 to TestFlight by June 14",
      progress: 66,
      context: "12 of 18 tasks done",
      lastEntry: "Finished auth flow yesterday",
      nextAction: "Fix navigation bug",
      accent: "var(--accent-gold)",
      bgStart: "#2A2011",
      bgEnd: "var(--elevated-card)",
      tasks: [
        { done: true, label: "Setup Clerk auth" },
        { done: true, label: "Design Home variants" },
        { done: false, label: "Testflight submission" }
      ]
    },
    {
      id: 3,
      title: "Read 12 books this year",
      progress: 33,
      context: "4 of 12 books read",
      lastEntry: "Finished 'Atomic Habits'",
      nextAction: "Start reading 'Dune'",
      accent: "#8BA6C1",
      bgStart: "#151B22",
      bgEnd: "var(--elevated-card)",
      tasks: [
        { done: true, label: "Atomic Habits" },
        { done: true, label: "Project Hail Mary" },
        { done: false, label: "Dune" }
      ]
    }
  ];

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const scrollLeft = scrollContainerRef.current.scrollLeft;
      const width = scrollContainerRef.current.clientWidth;
      const index = Math.round(scrollLeft / width);
      if (index !== activeCard) {
        setActiveCard(index);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#08090B] flex items-center justify-center p-6 rubai-card-deck">
      <div className="relative w-[390px] h-[844px] rounded-[44px] bg-[var(--page-bg)] overflow-hidden shadow-2xl ring-1 ring-white/10 flex flex-col">
        
        {/* Status Bar */}
        <div className="h-12 w-full flex items-center justify-between px-6 pt-2 z-50">
          <span className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">9:41</span>
          <div className="flex items-center gap-1.5 text-[var(--text-primary)]">
            <Signal className="w-4 h-4" />
            <Wifi className="w-4 h-4" />
            <Battery className="w-6 h-4" />
          </div>
        </div>

        {/* Header / Chrome */}
        <div className="px-6 py-4 flex items-center justify-between z-50">
          <div className="w-10 h-10 rounded-full bg-[var(--secondary)] border border-[var(--border)] flex items-center justify-center">
            <User className="w-5 h-5 text-[var(--text-muted)]" />
          </div>
          
          <div className="flex flex-col items-center justify-center">
            <span className="font-bold tracking-tight text-[var(--text-primary)] inline-flex items-baseline text-xl">
              ruba
              <span className="relative inline-flex items-center">
                <span className="absolute left-1/2 -translate-x-1/2 -top-[10px] w-[6px] h-[6px] rounded-full bg-[var(--primary-green)]" />
                <span>ı</span>
              </span>
            </span>
            <div className="flex items-center gap-1.5 mt-2">
              {goals.map((_, i) => (
                <div 
                  key={i} 
                  className={`h-1.5 rounded-full transition-all duration-300 ${i === activeCard ? 'w-4 bg-[var(--text-primary)]' : 'w-1.5 bg-[var(--text-muted)] opacity-50'}`}
                />
              ))}
            </div>
          </div>

          <button className="w-10 h-10 rounded-full bg-[var(--secondary)] border border-[var(--border)] flex items-center justify-center text-[var(--text-primary)]">
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Card Deck Area */}
        <div className="flex-1 w-full relative">
          <div 
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="absolute inset-0 flex overflow-x-auto snap-x snap-mandatory snap-x-container w-full h-full"
          >
            {goals.map((goal, idx) => {
              const isActive = activeCard === idx;
              return (
                <div key={goal.id} className="w-full h-full flex-shrink-0 snap-center px-4 pb-28 pt-2">
                  <div 
                    className="w-full h-full rounded-[32px] p-6 flex flex-col relative overflow-hidden transition-transform duration-500"
                    style={{
                      background: `linear-gradient(180deg, ${goal.bgStart} 0%, ${goal.bgEnd} 100%)`,
                      border: `1px solid var(--border)`,
                      transform: isActive ? 'scale(1)' : 'scale(0.95)',
                      opacity: isActive ? 1 : 0.6
                    }}
                  >
                    {/* Background glow top right */}
                    <div 
                      className="absolute -top-20 -right-20 w-64 h-64 rounded-full blur-[80px] opacity-20 pointer-events-none"
                      style={{ backgroundColor: goal.accent }}
                    />

                    <div className="flex items-center justify-between mb-8">
                      <span className="text-sm font-medium" style={{ color: goal.accent }}>
                        {goal.context}
                      </span>
                      <div className="w-12 h-12 rounded-full relative flex items-center justify-center" style={{ border: `3px solid var(--secondary)` }}>
                        <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                          <circle cx="21" cy="21" r="19" fill="transparent" stroke="currentColor" strokeWidth="3" strokeDasharray="120" strokeDashoffset={120 - (120 * goal.progress) / 100} style={{ color: goal.accent }} strokeLinecap="round" />
                        </svg>
                        <span className="text-xs font-bold">{goal.progress}%</span>
                      </div>
                    </div>

                    <h2 className="text-3xl font-bold leading-tight mb-8">
                      {goal.title}
                    </h2>

                    <div className="space-y-4 flex-1">
                      <div className="space-y-3">
                        <h3 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wider">Current Focus</h3>
                        {goal.tasks.map((task, i) => (
                          <div key={i} className="flex items-center gap-3">
                            {task.done ? (
                              <CheckCircle2 className="w-5 h-5 text-[var(--text-muted)]" />
                            ) : (
                              <Circle className="w-5 h-5" style={{ color: goal.accent }} />
                            )}
                            <span className={task.done ? "text-[var(--text-muted)] line-through" : "text-[var(--text-primary)]"}>
                              {task.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-auto p-4 rounded-2xl bg-black/20 border border-white/5 backdrop-blur-sm">
                      <div className="text-xs font-medium text-[var(--text-muted)] mb-1">Next up</div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{goal.nextAction}</span>
                        <ArrowRight className="w-4 h-4 text-[var(--text-muted)]" />
                      </div>
                    </div>
                    
                    <div className="absolute bottom-4 left-6 right-6 text-center text-xs text-[var(--text-muted)]">
                      Last update: {goal.lastEntry}
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Persistent AI Input - Absolute positioned over everything */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[var(--page-bg)] via-[var(--page-bg)] to-transparent pt-12 z-50">
          <div className="relative group">
            {/* Thinking shimmer effect wrapper */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-transparent via-[var(--accent-gold)] to-transparent opacity-0 group-hover:opacity-20 blur rounded-full transition-opacity duration-500" />
            
            <div className="relative flex items-center bg-[var(--elevated-card)] border border-[var(--border)] rounded-full p-2 pl-4 pr-2 shadow-lg">
              <input 
                type="text"
                placeholder="Ask rubai about this goal..."
                className="flex-1 bg-transparent border-none outline-none text-[var(--text-primary)] placeholder-[var(--text-muted)] text-sm"
              />
              <button className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors mr-1">
                <Mic className="w-4 h-4" />
              </button>
              <button className="w-8 h-8 rounded-full bg-[var(--text-primary)] flex items-center justify-center text-[var(--page-bg)] hover:scale-105 transition-transform">
                <ArrowUp className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
