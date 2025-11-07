/**
 * Firebase Billing Protection
 * 
 * This module provides utilities to monitor Firebase usage and prevent
 * charges beyond the $1 limit by:
 * 1. Monitoring usage metrics
 * 2. Disabling features when approaching limits
 * 3. Providing alerts and warnings
 */

import { config } from '@/lib/utils/config';

export interface BillingLimits {
  maxSpend: number; // Maximum spend in USD
  firestoreReadsPerDay: number;
  firestoreWritesPerDay: number;
  storageGB: number;
  bandwidthGB: number;
}

export interface UsageMetrics {
  firestoreReads: number;
  firestoreWrites: number;
  storageUsed: number; // in GB
  bandwidthUsed: number; // in GB
  estimatedCost: number; // in USD
}

// Default limits based on Firebase FREE tier
const DEFAULT_LIMITS: BillingLimits = {
  maxSpend: 1.0, // $1 limit
  firestoreReadsPerDay: 40000, // Conservative limit (FREE tier: 50K/day)
  firestoreWritesPerDay: 15000, // Conservative limit (FREE tier: 20K/day)
  storageGB: 4.0, // Conservative limit (FREE tier: 5GB)
  bandwidthGB: 0.8, // Conservative limit (FREE tier: 1GB/day)
};

// In-memory usage tracking (in production, use Firestore or external service)
let usageMetrics: UsageMetrics = {
  firestoreReads: 0,
  firestoreWrites: 0,
  storageUsed: 0,
  bandwidthUsed: 0,
  estimatedCost: 0,
};

/**
 * Get current billing limits
 */
export function getBillingLimits(): BillingLimits {
  return {
    ...DEFAULT_LIMITS,
    maxSpend: parseFloat(process.env.FIREBASE_MAX_SPEND || '1.0'),
    firestoreReadsPerDay: parseInt(process.env.FIREBASE_MAX_READS_PER_DAY || '40000', 10),
    firestoreWritesPerDay: parseInt(process.env.FIREBASE_MAX_WRITES_PER_DAY || '15000', 10),
    storageGB: parseFloat(process.env.FIREBASE_MAX_STORAGE_GB || '4.0'),
    bandwidthGB: parseFloat(process.env.FIREBASE_MAX_BANDWIDTH_GB || '0.8'),
  };
}

/**
 * Calculate estimated cost based on usage
 */
export function calculateEstimatedCost(usage: UsageMetrics): number {
  // Firebase pricing (as of 2024)
  const FIRESTORE_READ_COST = 0.06 / 100000; // $0.06 per 100K reads
  const FIRESTORE_WRITE_COST = 0.18 / 100000; // $0.18 per 100K writes
  const STORAGE_COST = 0.026; // $0.026 per GB/month
  const BANDWIDTH_COST = 0.12; // $0.12 per GB

  const readCost = usage.firestoreReads * FIRESTORE_READ_COST;
  const writeCost = usage.firestoreWrites * FIRESTORE_WRITE_COST;
  const storageCost = usage.storageUsed * STORAGE_COST / 30; // Daily cost
  const bandwidthCost = usage.bandwidthUsed * BANDWIDTH_COST;

  return readCost + writeCost + storageCost + bandwidthCost;
}

/**
 * Check if usage is approaching limits
 */
export function checkUsageLimits(): {
  withinLimits: boolean;
  warnings: string[];
  shouldDisable: boolean;
} {
  const limits = getBillingLimits();
  const warnings: string[] = [];
  let shouldDisable = false;

  // Check Firestore reads
  const readPercentage = (usageMetrics.firestoreReads / limits.firestoreReadsPerDay) * 100;
  if (readPercentage > 90) {
    shouldDisable = true;
    warnings.push(`Firestore reads at ${readPercentage.toFixed(1)}% of daily limit`);
  } else if (readPercentage > 75) {
    warnings.push(`Firestore reads at ${readPercentage.toFixed(1)}% of daily limit`);
  }

  // Check Firestore writes
  const writePercentage = (usageMetrics.firestoreWrites / limits.firestoreWritesPerDay) * 100;
  if (writePercentage > 90) {
    shouldDisable = true;
    warnings.push(`Firestore writes at ${writePercentage.toFixed(1)}% of daily limit`);
  } else if (writePercentage > 75) {
    warnings.push(`Firestore writes at ${writePercentage.toFixed(1)}% of daily limit`);
  }

  // Check storage
  const storagePercentage = (usageMetrics.storageUsed / limits.storageGB) * 100;
  if (storagePercentage > 90) {
    shouldDisable = true;
    warnings.push(`Storage at ${storagePercentage.toFixed(1)}% of limit`);
  } else if (storagePercentage > 75) {
    warnings.push(`Storage at ${storagePercentage.toFixed(1)}% of limit`);
  }

  // Check estimated cost
  usageMetrics.estimatedCost = calculateEstimatedCost(usageMetrics);
  const costPercentage = (usageMetrics.estimatedCost / limits.maxSpend) * 100;
  if (costPercentage > 90) {
    shouldDisable = true;
    warnings.push(`Estimated cost at $${usageMetrics.estimatedCost.toFixed(2)} (${costPercentage.toFixed(1)}% of $${limits.maxSpend} limit)`);
  } else if (costPercentage > 75) {
    warnings.push(`Estimated cost at $${usageMetrics.estimatedCost.toFixed(2)} (${costPercentage.toFixed(1)}% of $${limits.maxSpend} limit)`);
  }

  return {
    withinLimits: !shouldDisable && warnings.length === 0,
    warnings,
    shouldDisable,
  };
}

/**
 * Track Firestore read operation
 */
export function trackFirestoreRead(): void {
  usageMetrics.firestoreReads++;
}

/**
 * Track Firestore write operation
 */
export function trackFirestoreWrite(): void {
  usageMetrics.firestoreWrites++;
}

/**
 * Track storage usage
 */
export function trackStorageUsage(bytes: number): void {
  usageMetrics.storageUsed += bytes / (1024 * 1024 * 1024); // Convert to GB
}

/**
 * Track bandwidth usage
 */
export function trackBandwidthUsage(bytes: number): void {
  usageMetrics.bandwidthUsed += bytes / (1024 * 1024 * 1024); // Convert to GB
}

/**
 * Get current usage metrics
 */
export function getUsageMetrics(): UsageMetrics {
  return { ...usageMetrics };
}

/**
 * Reset daily usage (call this daily via cron or scheduled function)
 */
export function resetDailyUsage(): void {
  usageMetrics = {
    firestoreReads: 0,
    firestoreWrites: 0,
    storageUsed: usageMetrics.storageUsed, // Keep storage (monthly)
    bandwidthUsed: 0, // Reset bandwidth (daily)
    estimatedCost: 0,
  };
}

/**
 * Check if Firebase should be disabled based on usage
 * Note: Firebase Auth is FREE on Spark plan (50K MAU/month), so we only disable paid services
 */
export function shouldDisableFirebase(): boolean {
  const limits = getBillingLimits();
  
  // Check if billing protection is enabled
  if (process.env.FIREBASE_BILLING_PROTECTION === 'false') {
    return false;
  }

  const check = checkUsageLimits();
  return check.shouldDisable;
}

/**
 * Check if Firebase Auth should be disabled (it's FREE, so usually no)
 * Only disable if explicitly configured to do so
 */
export function shouldDisableFirebaseAuth(): boolean {
  // Firebase Auth is FREE on Spark plan (50K MAU/month)
  // Only disable if explicitly set to disable auth
  if (process.env.FIREBASE_DISABLE_AUTH === 'true') {
    return true;
  }
  
  // Auth is free, so don't disable it due to billing
  return false;
}

/**
 * Get billing protection status
 */
export function getBillingStatus(): {
  enabled: boolean;
  limits: BillingLimits;
  usage: UsageMetrics;
  warnings: string[];
  shouldDisable: boolean;
} {
  const limits = getBillingLimits();
  const check = checkUsageLimits();
  const enabled = process.env.FIREBASE_BILLING_PROTECTION !== 'false';

  return {
    enabled,
    limits,
    usage: getUsageMetrics(),
    warnings: check.warnings,
    shouldDisable: check.shouldDisable && enabled,
  };
}

