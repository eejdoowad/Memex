import Dexie from 'dexie'
import { DexieStorageBackend } from '@worldbrain/storex-backend-dexie'

import { Dexie as DexieExtended } from './types'

export default ({ backend }: { backend: DexieStorageBackend }) => {
    const dexie = backend.dexieInstance

    /**
     * Overrides `Dexie._createTransaction` to ensure to add `backupChanges` table to any readwrite transaction.
     * This allows us to avoid specifying this table on every single transaction to allow table hooks to write to
     * our change tracking table.
     *
     * TODO: Add clause to condition to check if backups is enabled
     *  (no reason to add this table to all transactions if backups is off)
     */
    dexie['_createTransaction'] =
        process.env.NODE_ENV === 'test'
            ? dexie['_createTransaction']
            : Dexie.override(
                  dexie['_createTransaction'],
                  origFn => (mode: string, tables: string[], ...args) => {
                      if (
                          mode === 'readwrite' &&
                          !tables.includes('backupChanges')
                      ) {
                          tables = [...tables, 'backupChanges']
                      }
                      return origFn.call(dexie, mode, tables, ...args)
                  },
              )

    return dexie as DexieExtended
}
