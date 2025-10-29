import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Logger } from './logger';

export interface CacheEntry {
  url: string;
  data: any;
  timestamp: number;
  ttl: number;
  etag?: string;
}

export interface HttpCacheOptions {
  cacheDir: string;
  ttlMs: number;
  enabled: boolean;
}

const DEFAULT_CACHE_OPTIONS: Omit<HttpCacheOptions, 'cacheDir'> = {
  ttlMs: 24 * 60 * 60 * 1000, // 24 hours
  enabled: true
};

export class HttpCache {
  private cacheDir: string;
  private ttlMs: number;
  private enabled: boolean;
  private logger: Logger;

  constructor(options: HttpCacheOptions, logger: Logger) {
    this.cacheDir = options.cacheDir;
    this.ttlMs = options.ttlMs;
    this.enabled = options.enabled;
    this.logger = logger;
  }

  private getCacheKey(url: string): string {
    const hash = crypto.createHash('sha256').update(url).digest('hex');
    return path.join(this.cacheDir, `${hash}.json`);
  }

  private async ensureCacheDir(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create cache directory', { 
        cacheDir: this.cacheDir, 
        error: (error as Error).message 
      });
    }
  }

  async get(url: string): Promise<CacheEntry | null> {
    if (!this.enabled) return null;

    try {
      await this.ensureCacheDir();
      const cacheKey = this.getCacheKey(url);
      const data = await fs.readFile(cacheKey, 'utf-8');
      const entry: CacheEntry = JSON.parse(data);
      
      const now = Date.now();
      const age = now - entry.timestamp;
      
      if (age > entry.ttl) {
        await this.delete(url);
        return null;
      }
      
      this.logger.debug('Cache hit', { url, age: age / 1000 / 60 / 60 });
      return entry;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Cache miss is normal
        return null;
      }
      
      this.logger.error('Cache get error', { 
        url, 
        error: (error as Error).message 
      });
      return null;
    }
  }

  async set(url: string, data: any, etag?: string): Promise<void> {
    if (!this.enabled) return;

    try {
      await this.ensureCacheDir();
      const cacheKey = this.getCacheKey(url);
      
      const entry: CacheEntry = {
        url,
        data,
        timestamp: Date.now(),
        ttl: this.ttlMs,
        etag
      };
      
      await fs.writeFile(cacheKey, JSON.stringify(entry, null, 2));
      this.logger.debug('Cache set', { url });
    } catch (error) {
      this.logger.error('Cache set error', { 
        url, 
        error: (error as Error).message 
      });
    }
  }

  async delete(url: string): Promise<void> {
    if (!this.enabled) return;

    try {
      const cacheKey = this.getCacheKey(url);
      await fs.unlink(cacheKey);
      this.logger.debug('Cache delete', { url });
    } catch (error) {
      // Ignore cache delete errors (file might not exist)
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.error('Cache delete error', { 
          url, 
          error: (error as Error).message 
        });
      }
    }
  }

  async clear(): Promise<void> {
    if (!this.enabled) return;

    try {
      const files = await fs.readdir(this.cacheDir);
      await Promise.all(
        files.map(file => fs.unlink(path.join(this.cacheDir, file)))
      );
      this.logger.info('Cache cleared');
    } catch (error) {
      this.logger.error('Cache clear error', { 
        error: (error as Error).message 
      });
    }
  }

  async getStats(): Promise<{ count: number; size: number; oldest?: Date; newest?: Date }> {
    if (!this.enabled) return { count: 0, size: 0 };

    try {
      const files = await fs.readdir(this.cacheDir);
      let totalSize = 0;
      let oldestTimestamp = Date.now();
      let newestTimestamp = 0;
      
      for (const file of files) {
        const fullPath = path.join(this.cacheDir, file);
        const stats = await fs.stat(fullPath);
        
        totalSize += stats.size;
        
        try {
          const data = await fs.readFile(fullPath, 'utf-8');
          const entry: CacheEntry = JSON.parse(data);
          oldestTimestamp = Math.min(oldestTimestamp, entry.timestamp);
          newestTimestamp = Math.max(newestTimestamp, entry.timestamp);
        } catch (error) {
          // Skip corrupted cache files
        }
      }
      
      return {
        count: files.length,
        size: totalSize,
        oldest: oldestTimestamp < Date.now() ? new Date(oldestTimestamp) : undefined,
        newest: newestTimestamp > 0 ? new Date(newestTimestamp) : undefined
      };
    } catch (error) {
      this.logger.error('Cache stats error', { 
        error: (error as Error).message 
      });
      return { count: 0, size: 0 };
    }
  }
}
