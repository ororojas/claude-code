import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/actions";
import { BoundariesForm, TargetsForm } from "@/components/settings-forms";
import { Card, PageTitle, SectionTitle } from "@/components/ui";
import { loadCore, requireUser } from "@/lib/data";
import { boundariesFor, GRADES, hasCustomBoundaries } from "@/lib/grades";
import { palette } from "@/lib/subjects";
import { ownerAutoLogin } from "@/lib/supabase/env";
import { tutorEnabled } from "@/lib/tutor";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { email } = await requireUser();
  const { subjects, targets, boundaries } = await loadCore();

  return (
    <>
      <PageTitle title="Settings" subtitle="Targets, exam details and the grade boundaries used to grade your papers." />
      <div className="space-y-6">
        {subjects.map((s) => {
          const target = targets.find((t) => t.subject_id === s.id);
          const b = boundariesFor(boundaries, s.id);
          const custom = hasCustomBoundaries(boundaries, s.id);
          const source = boundaries.find((r) => r.subject_id === s.id && (custom ? r.user_id !== null : r.user_id === null))?.source;
          return (
            <Card key={s.id}>
              <SectionTitle>
                <span className="flex items-center gap-2">
                  <span className={`size-2.5 rounded-full ${palette(s.id).dot}`} aria-hidden />
                  {s.board} {s.name}
                </span>
              </SectionTitle>
              {target ? <TargetsForm subjectId={s.id} target={target} /> : null}

              <div className="mt-5 border-t border-slate-100 pt-4">
                <h3 className="text-sm font-semibold">Grade boundaries (raw marks)</h3>
                <p className="mb-3 mt-1 text-xs text-slate-500">
                  {custom ? "Using your own boundaries." : "Using defaults."} {source ? `Source: ${source}.` : null} Grades are worked out as a percentage, so they
                  also apply to AS papers with a different total. When your school publishes mock boundaries, enter them here.
                </p>
                <BoundariesForm
                  subjectId={s.id}
                  maxMarks={s.max_marks}
                  percents={b}
                  defaults={boundariesFor(boundaries.filter((r) => r.user_id === null), s.id)}
                  custom={custom}
                />
                <p className="mt-2 text-xs text-slate-500">
                  As percentages: {GRADES.map((g) => `${g} ${Number.isFinite(b[g]) ? b[g].toFixed(1) : "—"}%`).join(" · ")}
                </p>
              </div>
            </Card>
          );
        })}

        <Card>
          <SectionTitle>Account</SectionTitle>
          <p className="mb-1 text-sm text-slate-600">
            {ownerAutoLogin() ? `No-login mode: everyone who opens this site is signed in as ${email ?? "the owner"}.` : `Signed in as ${email ?? "unknown"}.`}
          </p>
          <p className="mb-3 text-sm text-slate-600">
            Teach Me follow-up tutor: {tutorEnabled() ? "on" : "off (add ANTHROPIC_API_KEY in Vercel to turn it on)"}.
          </p>
          {ownerAutoLogin() ? null : (
            <form action={signOut}>
              <button type="submit" className="btn-secondary">
                <LogOut className="size-4" aria-hidden /> Sign out
              </button>
            </form>
          )}
        </Card>
      </div>
    </>
  );
}
