"use client";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const schemaHidden = /Invalid schema|schema must be one of|PGRST106/i.test(error.message);
  const missingTables = !schemaHidden && /relation .* does not exist|schema cache|Could not find the table/i.test(error.message);
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-red-200 bg-white p-6">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-slate-700">{error.message || "The page couldn't load."}</p>
      {schemaHidden ? (
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Supabase isn&apos;t exposing the tracker&apos;s tables yet. In Supabase, open Project Settings → Data API and add <code>mocks</code> to Exposed schemas, then reload.
        </p>
      ) : null}
      {missingTables ? (
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          The database tables are missing. Run both SQL files in <code>supabase/migrations</code> in the Supabase SQL editor (see the README), then reload.
        </p>
      ) : null}
      <button type="button" onClick={reset} className="btn-primary mt-4">
        Try again
      </button>
    </div>
  );
}
