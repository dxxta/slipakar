import type { StorageInterface } from '../../domain/storage/interface.js';
import type { DataVaultInterface } from '../../services/data-vault.js';

const projectKey = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\//i;

/**
 * Encrypts project files (`<projectId>/...`) with the owner's data key before they reach object storage
 * and decrypts them on read. Other keys, such as avatars and error logs, pass through unchanged.
 */
export function buildEncryptedStorage({ storage, dataVault }: { storage: StorageInterface; dataVault: DataVaultInterface }): StorageInterface {
  return {
    ensureBucket: () => storage.ensureBucket(),
    deleteObject: (key) => storage.deleteObject(key),
    objectExists: (key) => storage.objectExists(key),
    async putObject(input) {
      const projectId = projectKey.exec(input.key)?.[1];
      if (!projectId) return storage.putObject(input);
      const vault = await dataVault.forProject(projectId);
      return storage.putObject({ ...input, body: vault.encryptBytes(input.body) });
    },
    async getObject(key) {
      const body = await storage.getObject(key);
      const projectId = projectKey.exec(key)?.[1];
      if (!projectId) return body;
      return (await dataVault.forProject(projectId)).decryptBytes(body);
    },
  };
}
