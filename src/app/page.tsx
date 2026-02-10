import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col p-4 md:p-8">
      <nav className="flex justify-end py-6">
        <Link href="/login" className="text-xs uppercase tracking-widest text-gray-400 hover:text-sumi">
          Sign in
        </Link>
      </nav>

      <main className="glass-panel rounded-[2rem] md:rounded-[3rem] flex-1 p-8 md:p-16 flex flex-col justify-center items-start">
        <h1 className="text-3xl md:text-4xl font-light leading-tight mb-8">Kettei</h1>
        <p className="text-lg md:text-2xl font-light leading-relaxed max-w-3xl whitespace-pre-line mb-10">
          {"Sometimes, we choose\nnot to force an answer,\nbut to hold steady for one clear moment\nwithin the noise and confusion-\nto finally see what the heart has been seeking all along."}
        </p>
        <Link
          href="/question"
          className="group inline-flex items-center gap-4 px-8 py-3 rounded-full border border-gray-200 hover:border-kintsugi transition-all"
        >
          <span className="text-xs uppercase tracking-widest text-gray-500 group-hover:text-black">
            begin the journey
          </span>
          <span className="text-lg">→</span>
        </Link>
      </main>
    </div>
  );
}
