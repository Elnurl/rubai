import React from "react";
import { Mic, ArrowUp, Menu, Wifi, Battery, Signal, CheckCircle2, Circle, MoreHorizontal } from "lucide-react";
import "./_group.css";

export function Home() {
  return (
    <div className="rubai-ambient-thread min-h-screen bg-[#08090B] flex items-center justify-center p-6 text-[#F2EBDB]">
      {/* Mockup Outer Shell */}
      <div className="relative w-[390px] h-[844px] rounded-[44px] bg-[var(--page-bg)] overflow-hidden shadow-2xl ring-1 ring-white/5 flex flex-col">
        
        {/* Status Bar */}
        <div className="w-full h-12 flex items-center justify-between px-6 pt-2 shrink-0 z-20 relative">
          <span className="text-[15px] font-semibold tracking-tight">9:41</span>
          <div className="flex items-center gap-2">
            <Signal size={16} strokeWidth={2.5} />
            <Wifi size={16} strokeWidth={2.5} />
            <Battery size={24} strokeWidth={1.5} className="mt-0.5" />
          </div>
        </div>

        {/* Top Nav / Chrome */}
        <div className="flex items-center justify-between px-6 py-2 shrink-0 z-20 relative">
          <div className="font-bold text-xl tracking-tight text-[var(--text-primary)] inline-flex items-baseline">
            ruba
            <span className="relative inline-flex items-center">
              <span className="absolute left-1/2 -translate-x-1/2 -top-[10px] w-[6px] h-[6px] rounded-full bg-[var(--primary-green)]" />
              <span>ı</span>
            </span>
          </div>
          <button className="w-10 h-10 rounded-full bg-[var(--elevated-card)] border border-[var(--border)] flex items-center justify-center text-[var(--text-primary)]">
            <Menu size={20} />
          </button>
        </div>

        {/* Scrollable Thread */}
        <div className="flex-1 overflow-y-auto hide-scrollbar px-5 pb-32 pt-4 flex flex-col gap-8 relative z-10">
          
          {/* Date separator */}
          <div className="flex justify-center">
            <span className="text-[13px] font-medium text-[var(--text-muted)] bg-[var(--elevated-card)] px-3 py-1 rounded-full border border-[var(--border)]">Today</span>
          </div>

          {/* Assistant Message - Morning Check-in */}
          <div className="flex flex-col gap-3 max-w-[90%]">
            <div className="flex items-end gap-3">
              <div className="bg-[var(--elevated-card)] border border-[var(--border)] p-4 rounded-2xl rounded-bl-sm">
                <p className="text-[15px] leading-relaxed text-[var(--text-primary)]">
                  Good morning. You've got a solid streak going this week. Let's take a look at your goals for today.
                </p>
              </div>
            </div>
          </div>

          {/* Pinned Goal - Inline Message */}
          <div className="flex flex-col gap-3 max-w-[95%]">
            <div className="bg-[var(--elevated-card)] border border-[var(--primary-green)]/30 p-5 rounded-2xl rounded-bl-sm shadow-[0_0_15px_rgba(46,172,126,0.05)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[var(--primary-green)]/10 blur-[30px] rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none" />
              
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold tracking-wider uppercase text-[var(--primary-green)] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary-green)]" />
                  Goal Nudge
                </span>
                <button className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                  <MoreHorizontal size={16} />
                </button>
              </div>
              
              <h3 className="text-[17px] font-semibold text-[var(--text-primary)] mb-1">
                Run a half marathon in 12 weeks
              </h3>
              <p className="text-[14px] text-[var(--text-muted)] mb-5">
                Week 4 of 12 • Last ran 5km Tuesday.
              </p>
              
              <p className="text-[15px] leading-relaxed text-[var(--text-primary)] mb-4">
                Want to schedule today's run? The weather looks perfect this afternoon.
              </p>
              
              {/* Quick Reply Chips */}
              <div className="flex flex-wrap gap-2">
                <button className="bg-[var(--primary-green)] text-black font-semibold text-[14px] px-4 py-2 rounded-full hover:bg-opacity-90 transition-colors">
                  Schedule it
                </button>
                <button className="bg-[var(--secondary)] text-[var(--text-primary)] border border-[var(--border)] font-medium text-[14px] px-4 py-2 rounded-full">
                  Skip today
                </button>
                <button className="bg-[var(--secondary)] text-[var(--text-primary)] border border-[var(--border)] font-medium text-[14px] px-4 py-2 rounded-full">
                  Show plan
                </button>
              </div>
            </div>
          </div>

          {/* User Message */}
          <div className="flex flex-col gap-3 max-w-[85%] self-end">
            <div className="bg-[var(--secondary)] p-4 rounded-2xl rounded-br-sm text-[15px] leading-relaxed">
              Show plan
            </div>
          </div>

          {/* Assistant Message - Showing Plan */}
          <div className="flex flex-col gap-3 max-w-[90%]">
            <div className="bg-[var(--elevated-card)] border border-[var(--border)] p-4 rounded-2xl rounded-bl-sm">
              <p className="text-[15px] leading-relaxed text-[var(--text-primary)] mb-4">
                Here's what's left for Week 4:
              </p>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3 bg-[var(--secondary)]/50 p-3 rounded-xl border border-[var(--border)]/50">
                  <CheckCircle2 size={18} className="text-[var(--primary-green)]" />
                  <span className="text-[14px] line-through text-[var(--text-muted)]">Tuesday: 5km base run</span>
                </div>
                <div className="flex items-center gap-3 bg-[var(--secondary)] p-3 rounded-xl border border-[var(--border)]">
                  <Circle size={18} className="text-[var(--text-muted)]" />
                  <span className="text-[14px]">Thursday: 6km intervals</span>
                </div>
                <div className="flex items-center gap-3 bg-[var(--secondary)] p-3 rounded-xl border border-[var(--border)]">
                  <Circle size={18} className="text-[var(--text-muted)]" />
                  <span className="text-[14px]">Sunday: 10km long run</span>
                </div>
              </div>
            </div>
          </div>

          <div className="h-4" /> {/* Spacer */}
        </div>

        {/* Bottom Input Area - Persistent */}
        <div className="absolute bottom-0 left-0 w-full p-5 pt-8 bg-gradient-to-t from-[var(--page-bg)] via-[var(--page-bg)] to-transparent z-30">
          <div className="bg-[var(--elevated-card)] border border-[var(--border)] rounded-[24px] p-2 flex flex-col gap-2 shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
            <div className="px-4 pt-3 pb-1">
              <input 
                type="text" 
                placeholder="Ask rubai anything..." 
                className="w-full bg-transparent text-[16px] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none"
              />
            </div>
            
            <div className="flex items-center justify-between px-2 pb-1">
              <div className="flex items-center gap-1">
                <button className="w-10 h-10 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors relative">
                  <div className="absolute inset-0 bg-[var(--primary-green)] rounded-full opacity-0"></div>
                  <Mic size={22} className="relative z-10" />
                </button>
              </div>
              
              <button className="w-10 h-10 rounded-full bg-[var(--primary-green)] flex items-center justify-center text-black hover:opacity-90 transition-opacity">
                <ArrowUp size={20} strokeWidth={2.5} />
              </button>
            </div>
          </div>
          
          {/* Subtle home indicator line */}
          <div className="w-[120px] h-[5px] bg-[#3A3A3C] rounded-full mx-auto mt-6" />
        </div>

      </div>
    </div>
  );
}