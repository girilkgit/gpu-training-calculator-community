import OrbHero from './OrbHero';

const POINTS = ['Know how long your run will take', 'See what crashes really cost you', 'Get a budget range before you commit'];

/**
 * Page header. Orb on the left as a mark, title beside it, and on wide screens
 * three short customer benefits on the right so the banner has no empty middle.
 */
export default function HeroBanner() {
  return (
    <header className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-sky-50 px-4 py-3 dark:border-slate-700 dark:from-slate-800/60 dark:to-slate-900 sm:px-6 sm:py-4">
      <div className="flex items-center gap-3 sm:gap-5">
        <OrbHero className="h-28 w-32 shrink-0 sm:h-40 sm:w-56" />
        <div className="min-w-0 flex-1">
          <p className="hidden text-[10px] font-medium uppercase tracking-widest text-slate-500 dark:text-slate-400 sm:block sm:text-xs">
            Training time and cost estimator
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            GPU Training Calculator
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 sm:text-base">
            Time, failures and cost for large training runs
          </p>
        </div>
        <div className="hidden shrink-0 border-l border-slate-200 pl-6 dark:border-slate-700 lg:block">
          <ul className="space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
            {POINTS.map((p) => (
              <li key={p} className="flex items-center gap-2">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </header>
  );
}
