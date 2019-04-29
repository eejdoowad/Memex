import 'babel-polyfill'
import 'core-js/es7/symbol'
import { registerModuleMapCollections } from '@worldbrain/storex-pattern-modules'

import { browser } from 'webextension-polyfill-ts'
import initStorex from './search/memex-storex'
import getDb, { setStorex } from './search/get-db'
import internalAnalytics from './analytics/internal'
import initSentry from './util/raven'

// Features that require manual instantiation to setup
import DirectLinkingBackground from './direct-linking/background'
import EventLogBackground from './analytics/internal/background'
import CustomListBackground from './custom-lists/background'
import NotificationBackground from './notifications/background'
import SearchBackground from './search/background'
import * as backup from './backup/background'
import * as backupStorage from './backup/background/storage'
import BackgroundScript from './background-script'
import alarms from './background-script/alarms'
import TagsBackground from './tags/background'

// Features that auto-setup
import { tabManager } from './activity-logger/background'
import './analytics/background'
import './imports/background'
import './omnibar'
import analytics from './analytics'

initSentry()

const storageManager = initStorex()

const notifications = new NotificationBackground({ storageManager })
notifications.setupRemoteFunctions()

export const directLinking = new DirectLinkingBackground({
    storageManager,
})
directLinking.setupRemoteFunctions()
directLinking.setupRequestInterceptor()

const search = new SearchBackground({
    storageManager,
    tabMan: tabManager,
})
search.setupRemoteFunctions()

const eventLog = new EventLogBackground({ storageManager })
eventLog.setupRemoteFunctions()

export const customList = new CustomListBackground({
    storageManager,
    tabMan: tabManager,
    windows: browser.windows,
})
customList.setupRemoteFunctions()

export const tags = new TagsBackground({
    storageManager,
    tabMan: tabManager,
    windows: browser.windows,
})
tags.setupRemoteFunctions()

const backupModule = new backup.BackupBackgroundModule({
    storageManager,
    lastBackupStorage: new backupStorage.LocalLastBackupStorage({
        key: 'lastBackup',
    }),
    notifications,
})

backupModule.setBackendFromStorage()
backupModule.setupRemoteFunctions()
backupModule.startRecordingChangesIfNeeded()

registerModuleMapCollections(storageManager.registry, {
    annotations: directLinking.annotationStorage,
    notifications: notifications.storage,
    customList: customList.storage,
    backup: backupModule.storage,
    eventLog: eventLog.storage,
    search: search.storage,
    tags: tags.storage,
})

let bgScript: BackgroundScript

storageManager.finishInitialization().then(() => {
    setStorex(storageManager)
    internalAnalytics.registerOperations(eventLog)
    backupModule.storage.setupChangeTracking()

    bgScript = new BackgroundScript({
        storageManager,
        notifsBackground: notifications,
    })
    bgScript.setupRemoteFunctions()
    bgScript.setupWebExtAPIHandlers()
    bgScript.setupAlarms(alarms)
})

// Attach interesting features onto global window scope for interested users
window['backup'] = backupModule
window['getDb'] = getDb
window['storageMan'] = storageManager
window['bgScript'] = bgScript
window['eventLog'] = eventLog
window['directLinking'] = directLinking
window['search'] = search
window['customList'] = customList
window['notifications'] = notifications
window['analytics'] = analytics
