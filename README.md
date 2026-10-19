# GPU Training Calculator (community edition)

Estimate how long a large GPU training run will take and what it will cost, including crashes, checkpoints, recovery and setup.

- Live plain-English summary that rewrites itself as you change inputs
- Run-time model: Daly (2006), with Young–Daly automatic checkpoint intervals
- Every default carries a source and a confidence label (vendor-reported, measured, or assumption)
- Range of outcomes from a simulation, sensitivity chart, and cost breakdown
- Built-in Help box with written answers (no AI, no server)

This edition ships one starting scenario (a neo cloud, mostly measured figures). Every crash-rate and recovery source in the dropdowns is public; pick one to explore other cases.

## Run it

```bash
npm install
npm run dev
npm test
```

## Sources

Crash rates and recovery times come from published reports, including the Meta Llama 3 report (2024), Sivathanu et al. 2024 (arXiv 2410.21680), Lablup 2026 (arXiv 2605.09370) and figures Nebius published in October 2025. GPU prices are list prices from the provider's public price page and may change. See the Assumptions panel in the app for each value's source.

## Disclosure

Built with Bolt.new. The code was written with help from Claude (Anthropic), which coached the design and calculation logic and wrote files that the author reviewed and pasted in.

## Not advice

This is an estimate, not a quote, and not financial or procurement advice.

## Licence

MIT. See `LICENSE`. Three.js, React, Tailwind CSS and lucide-react keep their own licences.

## Contact

info@naadimage.com
