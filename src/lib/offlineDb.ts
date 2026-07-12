import type { SyncOperation } from '../types/finance.ts';

const DB_NAME = 'MeuPlanoFinanceiroLocal';
const DB_VERSION = 1;

export interface LocalSyncQueueItem {
  clientOperationId: string;
  tipo: 'criar' | 'atualizar' | 'excluir';
  entidade: 'receita' | 'despesa' | 'categoria' | 'meta';
  entidadeId: string;
  conteudo: any;
  criadoEm: string;
}

export class OfflineDb {
  private static db: IDBDatabase | null = null;

  static async getDb(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        
        // Create store for cached data collections
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache', { keyPath: 'key' });
        }
        
        // Create store for unsynced client changes (sync queue)
        if (!db.objectStoreNames.contains('sync_queue')) {
          db.createObjectStore('sync_queue', { keyPath: 'clientOperationId' });
        }
      };

      request.onsuccess = (event: any) => {
        this.db = event.target.result;
        resolve(this.db!);
      };

      request.onerror = (event: any) => {
        console.error("IndexedDB opening failed:", event.target.error);
        reject(event.target.error);
      };
    });
  }

  // Save full tables cache locally (e.g. key: "incomes", val: [...])
  static async setCache(key: string, value: any): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cache', 'readwrite');
      const store = tx.objectStore('cache');
      const req = store.put({ key, value, timestamp: Date.now() });

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // Get table cache locally
  static async getCache<T>(key: string): Promise<T | null> {
    const db = await this.getDb();
    return new Promise((resolve) => {
      const tx = db.transaction('cache', 'readonly');
      const store = tx.objectStore('cache');
      const req = store.get(key);

      req.onsuccess = () => {
        resolve(req.result ? req.result.value as T : null);
      };
      req.onerror = () => {
        resolve(null);
      };
    });
  }

  // Clear cache on logout
  static async clearAll(): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['cache', 'sync_queue'], 'readwrite');
      tx.objectStore('cache').clear();
      tx.objectStore('sync_queue').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // Sync Queue management
  static async addToSyncQueue(
    tipo: 'criar' | 'atualizar' | 'excluir',
    entidade: 'receita' | 'despesa' | 'categoria' | 'meta',
    entidadeId: string,
    conteudo: any
  ): Promise<string> {
    const db = await this.getDb();
    const clientOperationId = `op_${Math.random().toString(36).substring(2, 11)}_${Date.now()}`;
    const item: LocalSyncQueueItem = {
      clientOperationId,
      tipo,
      entidade,
      entidadeId,
      conteudo,
      criadoEm: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readwrite');
      const store = tx.objectStore('sync_queue');
      const req = store.put(item);

      req.onsuccess = () => resolve(clientOperationId);
      req.onerror = () => reject(req.error);
    });
  }

  static async getSyncQueue(): Promise<LocalSyncQueueItem[]> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readonly');
      const store = tx.objectStore('sync_queue');
      const req = store.getAll();

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  static async removeFromSyncQueue(clientOperationId: string): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readwrite');
      const store = tx.objectStore('sync_queue');
      const req = store.delete(clientOperationId);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}
