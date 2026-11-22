/**
 * 标准正态分布累计分布函数 (CDF)，基于 Abramowitz & Stegun 7.1.26 高精度误差函数逼近
 * 绝对误差 |ε| < 1.5 × 10^-7，确保极端 Z 值下绝不返回 NaN 或 Infinity。
 */
export function erfApprox(x: number): number {
  if (!Number.isFinite(x)) {
    return x > 0 ? 1 : -1;
  }
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const t = 1 / (1 + p * absX);
  const poly = ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t;
  const y = 1 - poly * Math.exp(-absX * absX);

  return sign * y;
}

/**
 * 将 Z-score 转换为百分位数（0 ~ 100）。
 * 对非有限值返回 null；极端 Z 值安全钳位至 [0, 100]。
 */
export function zScoreToPercentile(zScore: number): number | null {
  if (!Number.isFinite(zScore)) {
    return null;
  }
  const clampedZ = Math.max(-10, Math.min(10, zScore));
  const cdf = 0.5 * (1 + erfApprox(clampedZ / Math.SQRT2));
  const pct = Math.max(0, Math.min(100, cdf * 100));
  return Number(pct.toFixed(1));
}

export function formatPercentileLabel(percentile: number | null): string {
  if (percentile === null || !Number.isFinite(percentile)) {
    return '待计算';
  }
  if (percentile < 0.1) {
    return '< P0.1';
  }
  if (percentile > 99.9) {
    return '> P99.9';
  }
  return `P${percentile.toFixed(1)}`;
}
