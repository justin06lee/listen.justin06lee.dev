import { Suspense } from "react";
import { StudioForm } from "./_form";

export const metadata = { title: "studio · listen." };

export default function Studio() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-[420px] flex-col justify-center gap-8 px-6 py-24">
      <div>
        <h1 className="text-[28px] tracking-tight">studio</h1>
        <p className="mt-2 text-[15px] leading-7 text-white/55">
          the key unlocks the controls on this browser. everyone else gets the
          listen-only page.
        </p>
      </div>
      {/* useSearchParams reads a value only the request knows, so the form is
          a hole in the otherwise static page. */}
      <Suspense fallback={<div className="h-24" />}>
        <StudioForm />
      </Suspense>
    </main>
  );
}
