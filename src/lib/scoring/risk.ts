// ============================================================
// Customer Risk Scoring Engine
// Converts raw customer data into risk levels
// Source: خط_سير sheet analysis + business rules
// ============================================================

import type { RiskLevel } from '@/types/domain';
import { daysSincePayment } from '@/lib/utils/helpers';

export interface RiskInput {
  currentBalance: number;
  totalWithdrawn: number;
  totalPaid: number;
  lastPaymentDate: string | null;
  brokenPromises?: number;
  overdueInvoiceDays?: number;
}

export interface RiskResult {
  level: RiskLevel;
  score: number;  // 0–100, lower = riskier
  reasons: string[];
}

/**
 * Compute customer risk level.
 *
 * Factors (matching Excel خط_سير logic):
 * 1. Payment ratio      = totalPaid / totalWithdrawn   (35%)
 * 2. Days since payment = daysSinceLastPayment         (30%)
 * 3. Balance level      = currentBalance size          (15%)
 * 4. Broken promises    = count of broken promises     (20%)
 *
 * Score 80-100 → GREEN (ممتاز)
 * Score 60-79  → YELLOW (متوسط)
 * Score 40-59  → ORANGE (مرتفع)
 * Score 0-39   → RED (عالي جداً)
 */
export function computeRiskLevel(input: RiskInput): RiskResult {
  const reasons: string[] = [];
  let score = 100;

  // 1. Payment ratio (35 points)
  const paymentRatio = input.totalWithdrawn > 0
    ? input.totalPaid / input.totalWithdrawn
    : 0;

  if (paymentRatio >= 0.85) {
    // Full marks
  } else if (paymentRatio >= 0.70) {
    score -= 10;
    reasons.push('نسبة سداد متوسطة');
  } else if (paymentRatio >= 0.50) {
    score -= 20;
    reasons.push('نسبة سداد منخفضة');
  } else {
    score -= 35;
    reasons.push('نسبة سداد ضعيفة جداً');
  }

  // 2. Days since last payment (30 points)
  const daysSince = daysSincePayment(input.lastPaymentDate);

  if (daysSince <= 7) {
    // Full marks
  } else if (daysSince <= 30) {
    score -= 10;
    reasons.push(`آخر دفعة منذ ${daysSince} يوم`);
  } else if (daysSince <= 90) {
    score -= 20;
    reasons.push(`تأخر في السداد (${daysSince} يوم)`);
  } else {
    score -= 30;
    reasons.push(`تأخر شديد في السداد (${daysSince} يوم)`);
  }

  // 3. Balance level (15 points)
  if (input.currentBalance > 500_000) {
    score -= 15;
    reasons.push('رصيد مرتفع جداً');
  } else if (input.currentBalance > 200_000) {
    score -= 8;
    reasons.push('رصيد مرتفع');
  } else if (input.currentBalance > 50_000) {
    score -= 3;
  }

  // 4. Broken promises (20 points)
  const broken = input.brokenPromises ?? 0;
  if (broken >= 3) {
    score -= 20;
    reasons.push(`${broken} وعود مكسورة`);
  } else if (broken === 2) {
    score -= 12;
    reasons.push('وعدان مكسوران');
  } else if (broken === 1) {
    score -= 6;
    reasons.push('وعد مكسور');
  }

  // Clamp score to 0–100
  score = Math.max(0, Math.min(100, score));

  let level: RiskLevel;
  if (score >= 80) level = 'GREEN';
  else if (score >= 60) level = 'YELLOW';
  else if (score >= 40) level = 'ORANGE';
  else level = 'RED';

  return { level, score, reasons };
}

/**
 * Batch compute risk for multiple customers.
 * Called during import and daily refresh.
 */
export function batchComputeRisk(customers: RiskInput[]): RiskResult[] {
  return customers.map(computeRiskLevel);
}

// ============================================================
// Collector Performance Scoring
// ============================================================

export interface CollectorInput {
  targetAmount: number;
  collectedAmount: number;
  plannedVisits: number;
  completedVisits: number;
  activePromises: number;
  followedUpPromises: number;
  dataCompleteness: number;  // 0–1
  routeCompliance: number;   // 0–1
  goodDebtRatio: number;     // ratio of customers with good status
}

export interface CollectorScoreResult {
  total: number;
  breakdown: {
    collectionRate: number;    // max 35
    visitCompletion: number;   // max 20
    promiseFollowUp: number;   // max 15
    dataQuality: number;       // max 10
    routeCompliance: number;   // max 10
    debtQuality: number;       // max 10
  };
}

/**
 * Compute collector performance score 0–100.
 *
 * Weights from requirements:
 * - Collection rate       35%
 * - Visit completion      20%
 * - Promise follow-up     15%
 * - Data update quality   10%
 * - Route compliance      10%
 * - Debt quality          10%
 *
 * Note: Does NOT penalize for large total balances — only for behavior.
 */
export function computeCollectorScore(input: CollectorInput): CollectorScoreResult {
  const collectionRate = input.targetAmount > 0
    ? Math.min(1, input.collectedAmount / input.targetAmount)
    : 0;

  const visitCompletion = input.plannedVisits > 0
    ? Math.min(1, input.completedVisits / input.plannedVisits)
    : 1;

  const promiseFollowUp = input.activePromises > 0
    ? Math.min(1, input.followedUpPromises / input.activePromises)
    : 1;

  const breakdown = {
    collectionRate: Math.round(collectionRate * 35),
    visitCompletion: Math.round(visitCompletion * 20),
    promiseFollowUp: Math.round(promiseFollowUp * 15),
    dataQuality: Math.round(input.dataCompleteness * 10),
    routeCompliance: Math.round(input.routeCompliance * 10),
    debtQuality: Math.round(input.goodDebtRatio * 10),
  };

  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);

  return { total: Math.min(100, total), breakdown };
}
