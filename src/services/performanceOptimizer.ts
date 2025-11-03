/**
 * Performance Optimizer Service
 * Manages memory usage, cache optimization, and performance monitoring
 * for the image preloading system
 */

import { AppState, AppStateStatus } from 'react-native';
import { imagePreloader } from './imagePreloaderService';

export interface PerformanceMetrics {
  memoryUsage: {
    total: number;
    used: number;
    free: number;
  };
  cacheStats: {
    total: number;
    loaded: number;
    errors: number;
    hitRate: number;
  };
  preloadStats: {
    totalPreloaded: number;
    successfulPreloads: number;
    failedPreloads: number;
    averagePreloadTime: number;
  };
}

export interface OptimizationConfig {
  maxMemoryUsage: number; // MB
  cacheCleanupThreshold: number; // percentage
  preloadBatchSize: number;
  memoryCheckInterval: number; // ms
  enableMemoryOptimization: boolean;
  enableCacheOptimization: boolean;
}

class PerformanceOptimizer {
  private config: OptimizationConfig = {
    maxMemoryUsage: 100, // 100MB
    cacheCleanupThreshold: 80, // 80%
    preloadBatchSize: 5,
    memoryCheckInterval: 30000, // 30 seconds
    enableMemoryOptimization: true,
    enableCacheOptimization: true,
  };

  private memoryCheckInterval: NodeJS.Timeout | null = null;
  private appStateSubscription: any = null;
  private performanceMetrics: PerformanceMetrics = {
    memoryUsage: { total: 0, used: 0, free: 0 },
    cacheStats: { total: 0, loaded: 0, errors: 0, hitRate: 0 },
    preloadStats: { totalPreloaded: 0, successfulPreloads: 0, failedPreloads: 0, averagePreloadTime: 0 },
  };

  private preloadTimes: number[] = [];
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor() {
    this.initializeOptimization();
  }

  /**
   * Initialize performance optimization
   */
  private initializeOptimization(): void {
    if (this.config.enableMemoryOptimization) {
      this.startMemoryMonitoring();
    }

    this.setupAppStateListener();
  }

  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring(): void {
    this.memoryCheckInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, this.config.memoryCheckInterval);
  }

  /**
   * Setup app state listener for memory management
   */
  private setupAppStateListener(): void {
    this.appStateSubscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background') {
        this.handleAppBackground();
      } else if (nextAppState === 'active') {
        this.handleAppForeground();
      }
    });
  }

  /**
   * Handle app going to background
   */
  private handleAppBackground(): void {
    console.log('App going to background - optimizing memory');
    
    // Clear image cache to free memory
    if (this.config.enableCacheOptimization) {
      imagePreloader.clearCache();
    }
    
    // Stop memory monitoring to save battery
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }
  }

  /**
   * Handle app coming to foreground
   */
  private handleAppForeground(): void {
    console.log('App coming to foreground - resuming optimization');
    
    // Resume memory monitoring
    if (this.config.enableMemoryOptimization && !this.memoryCheckInterval) {
      this.startMemoryMonitoring();
    }
  }

  /**
   * Check memory usage and optimize if needed
   */
  private checkMemoryUsage(): void {
    try {
      // Get memory info (React Native doesn't provide direct memory access)
      // This is a simplified approach - in a real app you might use native modules
      const cacheStats = imagePreloader.getCacheStats();
      
      // Estimate memory usage based on cache size
      const estimatedMemoryUsage = this.estimateMemoryUsage(cacheStats);
      
      this.performanceMetrics.memoryUsage = {
        total: 0, // Not available in React Native
        used: estimatedMemoryUsage,
        free: 0, // Not available in React Native
      };

      // If memory usage is high, clean up cache
      if (estimatedMemoryUsage > this.config.maxMemoryUsage) {
        console.log(`High memory usage detected: ${estimatedMemoryUsage}MB - cleaning cache`);
        this.optimizeCache();
      }

      // Update cache stats
      this.updateCacheStats(cacheStats);

    } catch (error) {
      console.error('Error checking memory usage:', error);
    }
  }

  /**
   * Estimate memory usage based on cache size
   */
  private estimateMemoryUsage(cacheStats: { total: number; loaded: number; errors: number }): number {
    // Rough estimate: 500KB per image on average
    const averageImageSize = 0.5; // MB
    return cacheStats.loaded * averageImageSize;
  }

  /**
   * Optimize cache by removing least recently used items
   */
  private optimizeCache(): void {
    try {
      // Clear cache when memory usage is high
      imagePreloader.clearCache();
      console.log('Cache cleared due to high memory usage');
    } catch (error) {
      console.error('Error optimizing cache:', error);
    }
  }

  /**
   * Update cache statistics
   */
  private updateCacheStats(cacheStats: { total: number; loaded: number; errors: number }): void {
    this.performanceMetrics.cacheStats = {
      ...cacheStats,
      hitRate: this.cacheHits / (this.cacheHits + this.cacheMisses) || 0,
    };
  }

  /**
   * Record cache hit
   */
  recordCacheHit(): void {
    this.cacheHits++;
  }

  /**
   * Record cache miss
   */
  recordCacheMiss(): void {
    this.cacheMisses++;
  }

  /**
   * Record preload time
   */
  recordPreloadTime(timeMs: number): void {
    this.preloadTimes.push(timeMs);
    
    // Keep only last 100 preload times
    if (this.preloadTimes.length > 100) {
      this.preloadTimes = this.preloadTimes.slice(-100);
    }
    
    // Update average preload time
    this.performanceMetrics.preloadStats.averagePreloadTime = 
      this.preloadTimes.reduce((sum, time) => sum + time, 0) / this.preloadTimes.length;
  }

  /**
   * Record successful preload
   */
  recordSuccessfulPreload(): void {
    this.performanceMetrics.preloadStats.successfulPreloads++;
    this.performanceMetrics.preloadStats.totalPreloaded++;
  }

  /**
   * Record failed preload
   */
  recordFailedPreload(): void {
    this.performanceMetrics.preloadStats.failedPreloads++;
    this.performanceMetrics.preloadStats.totalPreloaded++;
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Update optimization configuration
   */
  updateConfig(newConfig: Partial<OptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart memory monitoring if interval changed
    if (newConfig.memoryCheckInterval) {
      if (this.memoryCheckInterval) {
        clearInterval(this.memoryCheckInterval);
      }
      if (this.config.enableMemoryOptimization) {
        this.startMemoryMonitoring();
      }
    }
  }

  /**
   * Get optimization recommendations
   */
  getOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];
    const metrics = this.performanceMetrics;

    // Memory recommendations
    if (metrics.memoryUsage.used > this.config.maxMemoryUsage * 0.8) {
      recommendations.push('Consider reducing cache size or increasing memory limit');
    }

    // Cache recommendations
    if (metrics.cacheStats.hitRate < 0.5) {
      recommendations.push('Cache hit rate is low - consider improving preload prediction');
    }

    if (metrics.cacheStats.errors > metrics.cacheStats.loaded * 0.2) {
      recommendations.push('High error rate in cache - check image URLs and network connectivity');
    }

    // Preload recommendations
    if (metrics.preloadStats.averagePreloadTime > 5000) {
      recommendations.push('Preload times are slow - consider reducing batch size or image quality');
    }

    if (metrics.preloadStats.failedPreloads > metrics.preloadStats.successfulPreloads * 0.3) {
      recommendations.push('High preload failure rate - check network connectivity and image URLs');
    }

    return recommendations;
  }

  /**
   * Reset performance metrics
   */
  resetMetrics(): void {
    this.performanceMetrics = {
      memoryUsage: { total: 0, used: 0, free: 0 },
      cacheStats: { total: 0, loaded: 0, errors: 0, hitRate: 0 },
      preloadStats: { totalPreloaded: 0, successfulPreloads: 0, failedPreloads: 0, averagePreloadTime: 0 },
    };
    this.preloadTimes = [];
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }

    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }
}

// Export singleton instance
export const performanceOptimizer = new PerformanceOptimizer();

// Export types
export type { PerformanceMetrics, OptimizationConfig };
