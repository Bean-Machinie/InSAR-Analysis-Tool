# Reliability metrics

This viewer exposes four per-pixel quality indicators. Together they help you
decide how much to trust the displacement value at any given pixel.

## The four metrics

### 1. Median coherence
The middle value of coherence across all interferogram pairs at this pixel.
Higher = more reliable. Range: 0 to 1.
- \< 0.2: usually noise (vegetation, water, decorrelated)
- 0.2-0.4: borderline, treat with caution
- \> 0.4: typically reliable (bare ground, buildings, rock)

### 2. Stability (std of coherence across pairs)
How consistent the coherence is across the stack at this pixel.
Lower = more consistent. Range: 0 to ~0.5.

A pixel can have a "good" median coherence but unstable behaviour — e.g.
coherence 0.7 in summer, 0.1 in winter due to seasonal vegetation. Median
hides that; stability surfaces it.
- \< 0.15: consistent quality across the stack
- \> 0.20: erratic, likely seasonal or event-driven coherence loss

### 3. Good pairs (count)
How many interferogram pairs at this pixel cleared a coherence threshold
of 0.3. Format: "N / total_pairs". Higher = more reliable observations
supporting the time series at this pixel.

A pixel with 9 / 12 good pairs has 3 weak observations contributing to its
LSQ fit. The weak ones are automatically down-weighted by the math, but
fewer good pairs means more uncertainty.

### 4. RMSE (root-mean-square error)
The leftover error after the least-squares fit at this pixel, in mm.
This is what the LSQ couldn't explain — pairs that disagreed with each
other even after weighting.
- \< 2 mm: pairs agreed well, trust the result
- 2-5 mm: moderate disagreement, treat with caution
- \> 5 mm: significant disagreement, likely unwrap errors or atmospheric
  noise; don't trust this pixel without further investigation

## How to interpret combinations

| Median | Stability | Good pairs | RMSE  | Verdict                       |
|--------|-----------|------------|-------|-------------------------------|
| High   | Low       | High       | Low   | Bulletproof — trust it        |
| High   | High      | High       | Low   | Erratic — investigate season  |
| High   | Low       | Low        | Low   | Few but consistent — okay     |
| High   | Low       | High       | High  | Pairs disagree — unwrap error?|
| Low    | any       | any        | any   | Don't trust the displacement  |

A pixel is genuinely reliable when at least three of the four metrics are
"green". One red flag in four is usually tolerable; two or more red flags
means treat the result with significant caution.

## Quality filter

The "Quality" slider applies three coherence filters together:
median coherence, stability, and good-pair count. It does NOT use RMSE because
RMSE units are different (mm vs unitless) and is shown separately in the popup
for per-pixel interpretation.

At the lenient end, the filter keeps pixels with median coherence around 0.2,
stability below about 0.20, and at least one-third of pairs above coherence 0.3.
At the strict end, it keeps pixels with median coherence around 0.4, stability
below about 0.15, and at least two-thirds of pairs above coherence 0.3.

The Advanced section exposes these three thresholds as individual sliders.
Changing any advanced threshold creates a custom quality setting until the
master Quality slider is moved again.

## What these metrics do NOT capture

- Whether the deformation signal is real or atmospheric residual
- Unwrap errors that affected ALL pairs equally (rare but possible)
- Coherence at specific dates (use coherence_per_date for that)
- Surface type (would need an external land-cover raster)

For per-date quality (e.g. "was 2024-06-15 a noisy acquisition at this
pixel?"), use the segmented time-series view — segments are split at
coherence dropouts, which makes per-date issues visible directly.
