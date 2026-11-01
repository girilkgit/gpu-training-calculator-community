import { useMemo, useState } from 'react';
import type { CalculatorState, CalculatorResult } from '@/hooks/useCalculator';
import { formatDuration } from '@/lib/format';

/**
 * Help box: written answers, no AI. Collapsed by default.
 * Each answer is a function of the current calculator state, so it quotes the
 * user's own numbers. To add a question, add one entry to buildFaq().
 */

type Faq = { id: string; q: string; keywords: string; popular?: boolean; a: React.ReactNode };

function usd(v: number): string {
  if (!isFinite(v) || v < 0) return '—';
  if (v >= 1e6) return `$${(v / 1e6).toFixed(v >= 1e7 ? 0 : 2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}

function buildFaq(state: CalculatorState, result: CalculatorResult): Faq[] {
  const { run, cost } = result;
  const gpus = state.job.gpus;
  const mfuPct = Math.round(state.job.mfu * 100);
  const crashes = run.expectedFailures;
  const crashText = crashes < 10 ? crashes.toFixed(1) : Math.round(crashes).toLocaleString();
  const lost = Math.max(0, run.totalHours - run.trainHours);

  return [
    {
      id: 'mfu',
      q: 'What is MFU?',
      popular: true,
      keywords: 'mfu utilisation utilization efficiency flops speed model flops',
      a: (
        <>
          <p>
            MFU (model FLOPs utilisation) is the share of a GPU's peak speed that real training actually uses. No
            real job reaches 100%, because GPUs wait on memory and on each other.
          </p>
          <p>
            You have it set to <b>{mfuPct}%</b>, so the run takes {formatDuration(run.trainHours)} of pure training instead of the
            ideal {formatDuration(state.job.idealHours)}. Published figures vary: Meta reported about 41% for Llama 3,
            Lambda cites 35–45%, and SemiAnalysis measured around 54% on well-tuned H100/H200 clusters. The default is 40%.
          </p>
        </>
      ),
    },
    {
      id: 'crashes',
      q: 'Why do crashes matter?',
      popular: true,
      keywords: 'crash failure fail interrupt mtbf restart recovery rework lost',
      a: (
        <>
          <p>
            With many GPUs, something is always likely to fail. When it does, the job stops, restarts, and repeats the
            work done since its last saved checkpoint.
          </p>
          <p>
            For {gpus.toLocaleString()} GPUs the calculator expects about <b>{crashText}</b> crashes, one every{' '}
            <b>{formatDuration(run.mtbfHours)}</b>. Crashes, checkpoints and setup add{' '}
            <b>{formatDuration(lost)}</b> on top of pure training. More GPUs means more frequent crashes, so the
            penalty grows with cluster size.
          </p>
        </>
      ),
    },
    {
      id: 'total',
      q: 'How is the total calculated?',
      popular: true,
      keywords: 'total cost calculate formula price bill gpu hours contingency storage egress people',
      a: (
        <>
          <p>
            GPU cost = number of GPUs × price per GPU-hour × billed hours. Then storage, data transfer (egress), people
            time and contingency are added. Extras are zero unless you enter them under Optional extras.
          </p>
          <p>
            Right now: <b>{usd(cost.totalCost)}</b> in total, of which GPUs are <b>{usd(cost.gpuCost)}</b>.
            {state.cost.billing === 'reserved'
              ? ' You are on reserved billing, so you pay for every reserved hour, used or not.'
              : ' You are on pay-as-used billing, so you pay only for hours the job runs, including hours lost to crashes.'}
          </p>
        </>
      ),
    },
    {
      id: 'useful',
      q: 'What is a "useful" GPU-hour?',
      keywords: 'useful gpu hour price effective wasted waste',
      a: (
        <p>
          You pay <b>${cost.effectivePricePerGpuHour.toFixed(2)}</b> per GPU-hour, but time spent on crashes, recovery,
          checkpoints and setup produces no training progress. Dividing the bill by the hours that truly train gives{' '}
          <b>${cost.effectivePricePerUsefulGpuHour.toFixed(2)}</b> per useful GPU-hour. That is the number to compare
          between providers.
        </p>
      ),
    },
    {
      id: 'node',
      q: 'What is a node, and what does "per 1,000 node-days" mean?',
      keywords: 'node node-days 1000 rate crash rate per gpus per node server',
      a: (
        <p>
          A node is one server, usually holding 8 GPUs (you have {state.job.gpusPerNode} per node, so{' '}
          {Math.round(gpus / Math.max(1, state.job.gpusPerNode)).toLocaleString()} nodes). "Crashes per 1,000 node-days" counts how many
          interruptions you would see if 1,000 nodes ran for one day. Published values: Meta Llama 3 about 3.8, Meta RSC-2
          2.34, RSC-1 6.5, and an early B200 cluster 7.1.
        </p>
      ),
    },
    {
      id: 'checkpoint',
      q: 'What is a checkpoint, and what does Auto do?',
      keywords: 'checkpoint auto young daly interval save stall',
      a: (
        <p>
          A checkpoint saves training progress so a crash only loses the work since the last save. Saving costs time, so
          too many checkpoints slow the run and too few lose more work per crash. Auto uses the Young–Daly rule to pick
          the interval that balances the two. Untick it to enter your own interval.
        </p>
      ),
    },
    {
      id: 'sources',
      q: 'Where do the numbers come from?',
      popular: true,
      keywords: 'source sources data evidence meta nebius lablup sivathanu daly paper reference prices',
      a: (
        <>
          <p>Crash rates and recovery times come from published reports:</p>
          <ul className="ml-4 list-disc space-y-0.5">
            <li>Meta, Llama 3 training report (2024): 419 unexpected interruptions in 54 days on 16,384 GPUs.</li>
            <li>Sivathanu et al., 2024 (arXiv 2410.21680): Meta RSC-1 and RSC-2 clusters.</li>
            <li>Lablup, 2026 (arXiv 2605.09370): early B200 cluster, including recovery times.</li>
            <li>Nebius, October 2025: a crash about every 33 hours on its own 3,000-GPU cluster (provider reported).</li>
            <li>Daly, 2006: the model used to turn crash rates into total run time.</li>
          </ul>
          <p>GPU prices are list prices from the provider's public price page and may have changed.</p>
        </>
      ),
    },
    {
      id: 'daly',
      q: 'How is the run time worked out?',
      keywords: 'daly model method wall time simulation formula calculation',
      a: (
        <p>
          Training time is the ideal hours divided by MFU. The calculator then uses Daly's wall-time model, which allows a
          crash to strike at any moment, including during a checkpoint or a restart, and adds the time for checkpoints, lost
          work, recovery and setup. The model has been checked against its author's own simulation, not against a
          live cluster, so treat results as estimates.
        </p>
      ),
    },
    {
      id: 'quote',
      q: 'Is this a quote or advice?',
      keywords: 'quote advice accurate guarantee financial procurement disclaimer',
      a: (
        <p>
          No. It is an estimate for planning conversations. Real prices, discounts, crash rates and efficiency vary by
          provider, hardware and workload. Confirm figures with the provider before you commit money.
        </p>
      ),
    },
  ];
}

function score(item: Faq, terms: string[]): number {
  const hay = `${item.q} ${item.keywords}`.toLowerCase();
  return terms.reduce((s, t) => (hay.includes(t) ? s + (item.q.toLowerCase().includes(t) ? 2 : 1) : s), 0);
}

export default function HelpBox({ state, result }: { state: CalculatorState; result: CalculatorResult }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const faq = useMemo(() => buildFaq(state, result), [state, result]);
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
  const matches = terms.length
    ? faq.map((f) => ({ f, s: score(f, terms) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).map((x) => x.f)
    : [];
  const shown = terms.length ? matches : faq.filter((f) => f.id === selected);
  const chips = faq.filter((f) => f.popular);

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800/50">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="help-panel"
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-slate-800 dark:text-slate-100"
      >
        <span>Questions? Ask the Help box</span>
        <span aria-hidden="true" className="text-slate-400">{open ? '–' : '+'}</span>
      </button>

      {open && (
        <div id="help-panel" className="space-y-3 border-t border-slate-200 px-4 py-3 dark:border-slate-700">
          <label className="block">
            <span className="sr-only">Search the help</span>
            <input
              type="search"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
              placeholder="Type a word, e.g. crash, MFU, checkpoint, cost"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            {chips.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { setQuery(''); setSelected(c.id); }}
                className={`rounded-full border px-3 py-1 text-xs ${
                  selected === c.id && !terms.length
                    ? 'border-sky-500 bg-sky-50 text-sky-800 dark:bg-sky-900/30 dark:text-sky-200'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {c.q}
              </button>
            ))}
          </div>

          <div aria-live="polite" className="space-y-3">
            {shown.map((f) => (
              <div key={f.id} className="space-y-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">{f.q}</h3>
                {f.a}
              </div>
            ))}
            {terms.length > 0 && shown.length === 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No match. Try one word, such as crash, MFU, checkpoint, cost, node or sources.
              </p>
            )}
            {!terms.length && !selected && (
              <>
                <p className="text-xs text-slate-500 dark:text-slate-400">Pick a question or search. Other topics:</p>
                <ul className="flex flex-wrap gap-2">
                  {faq.filter((f) => !f.popular).map((f) => (
                    <li key={f.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(f.id)}
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700"
                      >
                        {f.q}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            Written answers, not AI. Numbers quoted come from your current inputs.
          </p>
        </div>
      )}
    </section>
  );
}