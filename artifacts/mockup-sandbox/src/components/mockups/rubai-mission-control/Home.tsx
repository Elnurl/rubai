import React from "react";
import { Mic, ArrowUp, CheckCircle2, ChevronRight, Sparkles, Target, Activity, User, Plus } from "lucide-react";
import "./_group.css";

export function Home() {
  return (
    <div className="min-h-screen bg-[#08090B] flex items-center justify-center p-6 rubai-theme">
      <div 
        className="relative w-[390px] h-[844px] rounded-[44px] overflow-hidden shadow-2xl ring-1 ring-white/5 flex flex-col"
        style={{ backgroundColor: "var(--page-bg)" }}
      >
        {/* Status Bar */}
        <div className="h-12 flex items-center justify-between px-6 shrink-0 z-10">
          <span className="text-[15px] font-medium tracking-tight mt-1" style={{ color: "var(--text-primary)" }}>9:41</span>
          <div className="flex items-center gap-1.5 mt-1">
            {/* Cellular */}
            <div className="flex items-end gap-[1px] h-2.5">
              <div className="w-[3px] h-1 bg-[var(--text-primary)] rounded-sm" />
              <div className="w-[3px] h-1.5 bg-[var(--text-primary)] rounded-sm" />
              <div className="w-[3px] h-2 bg-[var(--text-primary)] rounded-sm" />
              <div className="w-[3px] h-2.5 bg-[var(--text-muted)] rounded-sm" />
            </div>
            {/* Wifi */}
            <svg width="15" height="11" viewBox="0 0 15 11" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7.5 10.5C8.32843 10.5 9 9.82843 9 9C9 8.17157 8.32843 7.5 7.5 7.5C6.67157 7.5 6 8.17157 6 9C6 9.82843 6.67157 10.5 7.5 10.5Z" fill="currentColor" style={{color: "var(--text-primary)"}}/>
              <path d="M2.54546 5.86396C5.27928 3.12921 9.72072 3.12921 12.4545 5.86396" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{color: "var(--text-primary)"}}/>
              <path d="M0.423981 3.74264C4.32943 -0.162704 10.6706 -0.162704 14.576 3.74264" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{color: "var(--text-primary)"}}/>
            </svg>
            {/* Battery */}
            <div className="w-[22px] h-3 border border-[var(--text-muted)] rounded-[4px] p-[1px] flex items-center relative">
              <div className="h-full bg-[var(--text-primary)] rounded-[2px] w-[70%]" />
              <div className="absolute -right-[3px] w-[2px] h-1 bg-[var(--text-muted)] rounded-r-[1px]" />
            </div>
          </div>
        </div>

        {/* Content Scrollable */}
        <div className="flex-1 overflow-y-auto hide-scrollbar px-5 pb-48 pt-2">
          
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[22px] tracking-tight text-[#F2EBDB] inline-flex items-baseline">
                ruba
                <span className="relative inline-flex items-center">
                  <span className="absolute left-1/2 -translate-x-1/2 -top-[10px] w-[5px] h-[5px] rounded-full bg-[#2EAC7E]" />
                  <span>ı</span>
                </span>
              </span>
            </div>
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--secondary)] text-[var(--text-primary)]">
              <User size={16} />
            </div>
          </div>

          {/* Hero: Today's Focus */}
          <div className="mb-8">
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-3 text-[var(--text-muted)]">Today's Focus</h2>
            
            <div className="bg-[var(--elevated-card)] rounded-[24px] p-6 ring-1 ring-[var(--border)] relative overflow-hidden">
              {/* Decorative gradient glow */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--primary-green)]/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
              
              <div className="flex gap-4 items-start mb-6 relative">
                {/* Circular Progress */}
                <div className="relative w-16 h-16 shrink-0">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="var(--secondary)" strokeWidth="8" />
                    <circle cx="50" cy="50" r="45" fill="none" stroke="var(--primary-green)" strokeWidth="8" strokeDasharray="282.7" strokeDashoffset="188.5" strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[13px] font-bold text-[var(--primary-green)]">33%</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className="w-2 h-2 rounded-full bg-[var(--primary-green)]" />
                    <span className="text-[11px] font-medium text-[var(--text-muted)]">Half Marathon Plan • Wk 4</span>
                  </div>
                  <h3 className="text-xl font-bold leading-tight text-[var(--text-primary)]">Run 8km</h3>
                  <p className="text-sm text-[var(--text-muted)] mt-1">Tempo pace. Last ran 5km on Tuesday.</p>
                </div>
              </div>

              <button className="w-full h-12 bg-[var(--primary-green)] text-[#0B0C09] font-semibold rounded-[16px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
                <CheckCircle2 size={18} strokeWidth={2.5} />
                Mark Complete
              </button>
            </div>
          </div>

          {/* Secondary Goals */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Active Goals</h2>
              <button className="w-6 h-6 rounded-full bg-[var(--secondary)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <Plus size={14} />
              </button>
            </div>
            
            <div className="flex gap-3 overflow-x-auto hide-scrollbar -mx-5 px-5">
              
              {/* Chip 1 */}
              <div className="bg-[var(--secondary)] border border-[var(--border)] rounded-[16px] p-3 w-[160px] shrink-0">
                <div className="text-[13px] font-medium text-[var(--text-primary)] leading-snug mb-3">Ship rubai v1 to TestFlight</div>
                <div className="flex flex-col gap-1.5">
                  <div className="h-1 bg-[var(--border)] rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--accent-gold)] w-[66%]" />
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] font-medium">12 of 18 tasks</div>
                </div>
              </div>

              {/* Chip 2 */}
              <div className="bg-[var(--secondary)] border border-[var(--border)] rounded-[16px] p-3 w-[160px] shrink-0">
                <div className="text-[13px] font-medium text-[var(--text-primary)] leading-snug mb-3">Read 12 books this year</div>
                <div className="flex flex-col gap-1.5">
                  <div className="h-1 bg-[var(--border)] rounded-full overflow-hidden">
                    <div className="h-full bg-[#8E8772] w-[33%]" />
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] font-medium">4 of 12 • Atomic Habits</div>
                </div>
              </div>

            </div>
          </div>

          {/* AI Insight */}
          <div className="bg-[#E2A435]/10 border border-[#E2A435]/20 rounded-[20px] p-4 flex gap-3">
            <Sparkles className="text-[var(--accent-gold)] shrink-0 mt-0.5" size={18} />
            <div>
              <p className="text-sm text-[#F2EBDB] leading-snug font-medium">
                You're 1 day behind on the running plan. Want to swap tomorrow's rest day?
              </p>
              <button className="text-[12px] font-semibold text-[var(--accent-gold)] mt-2 flex items-center gap-1">
                Adjust schedule <ChevronRight size={12} strokeWidth={3} />
              </button>
            </div>
          </div>

        </div>

        {/* Bottom Area (Fixed) */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[var(--page-bg)] via-[var(--page-bg)] to-transparent pt-12 pb-6 px-5 z-20">
          
          {/* Floating Action Chips */}
          <div className="flex items-center gap-2 mb-4 overflow-x-auto hide-scrollbar">
            <button className="h-8 px-3 rounded-full bg-[var(--secondary)] border border-[var(--border)] text-[12px] font-medium text-[var(--text-primary)] shrink-0 shadow-sm flex items-center gap-1.5">
              Reflect
            </button>
            <button className="h-8 px-3 rounded-full bg-[var(--secondary)] border border-[var(--border)] text-[12px] font-medium text-[var(--text-primary)] shrink-0 shadow-sm flex items-center gap-1.5">
              Plan tomorrow
            </button>
            <button className="h-8 px-3 rounded-full bg-[var(--secondary)] border border-[var(--border)] text-[12px] font-medium text-[var(--text-primary)] shrink-0 shadow-sm flex items-center gap-1.5">
              Check in
            </button>
          </div>

          {/* Persistent AI Input */}
          <div className="bg-[var(--elevated-card)] border border-[var(--border)] rounded-[24px] p-1.5 flex items-center shadow-lg mb-6">
            <button className="w-10 h-10 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--secondary)] transition-colors shrink-0">
              <Mic size={20} />
            </button>
            <input 
              type="text" 
              placeholder="Ask rubai anything..." 
              className="flex-1 bg-transparent border-none text-[15px] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none px-2 font-medium"
            />
            <button className="w-10 h-10 rounded-[18px] bg-[var(--primary-green)] text-[#0B0C09] flex items-center justify-center shrink-0">
              <ArrowUp size={20} strokeWidth={3} />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center justify-around px-2">
            <button className="flex flex-col items-center gap-1 text-[var(--text-primary)]">
              <div className="w-12 h-8 rounded-full bg-[var(--secondary)] flex items-center justify-center">
                <Target size={20} />
              </div>
              <span className="text-[10px] font-semibold">Today</span>
            </button>
            <button className="flex flex-col items-center gap-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              <div className="w-12 h-8 rounded-full flex items-center justify-center">
                <Activity size={20} />
              </div>
              <span className="text-[10px] font-medium">Goals</span>
            </button>
            <button className="flex flex-col items-center gap-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              <div className="w-12 h-8 rounded-full flex items-center justify-center">
                <User size={20} />
              </div>
              <span className="text-[10px] font-medium">You</span>
            </button>
          </div>

          {/* iPhone Home Indicator */}
          <div className="w-[134px] h-[5px] bg-[#FFFFFF]/30 rounded-full mx-auto mt-6" />
        </div>

      </div>
    </div>
  );
}
