import stemmer from '@worldbrain/memex-stemmer'

import UrlField from './storage/url-field'
import schemaPatcher from './storage/dexie-schema'
import collections from './old-schema'
import initStorex from './storex'
import inMemoryDb from '@worldbrain/storex-backend-dexie/lib/in-memory'
import { StorageManager } from './types'
import { plugins } from './storex-plugins'

export default () => {
    const idbImplementation = inMemoryDb()
    return initStorex<StorageManager>({
        stemmer,
        collections,
        schemaPatcher,
        dbName: 'test',
        customFields: [{ key: 'url', field: UrlField }],
        backendPlugins: plugins,
        idbImplementation,
    })
}
