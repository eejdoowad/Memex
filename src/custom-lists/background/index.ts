import { makeRemotelyCallable } from 'src/util/webextensionRPC'
import normalizeUrl from 'src/util/encode-url-for-id'
import CustomListStorage from './storage'
import internalAnalytics from '../../analytics/internal'
import { EVENT_NAMES } from '../../analytics/internal/constants'
import { TabManager } from 'src/activity-logger/background/tab-manager'
import { Windows } from 'webextension-polyfill-ts'
import { Dexie, StorageManager } from 'src/search/types'
import { getPage } from 'src/search/util'
import { createPageFromTab } from 'src/search'
import { Tab } from './types'

export default class CustomListBackground {
    private storage: CustomListStorage
    private getDb: () => Promise<Dexie>
    private tabMan: TabManager
    private windows: Windows.Static

    constructor({
        storageManager,
        tabMan,
        windows,
    }: {
        storageManager: StorageManager
        tabMan?: TabManager
        windows?: Windows.Static
    }) {
        // Makes the custom list Table in indexed DB.
        this.storage = new CustomListStorage({
            storageManager,
        })
        this.getDb = () => storageManager.backend['dexieInstance']
        this.tabMan = tabMan
        this.windows = windows
    }

    setupRemoteFunctions() {
        makeRemotelyCallable({
            createCustomList: this.createCustomList.bind(this),
            insertPageToList: this.insertPageToList.bind(this),
            updateListName: this.updateList.bind(this),
            removeList: this.removeList.bind(this),
            removePageFromList: this.removePageFromList.bind(this),
            fetchAllLists: this.fetchAllLists.bind(this),
            fetchListById: this.fetchListById.bind(this),
            fetchListPagesByUrl: this.fetchListPagesByUrl.bind(this),
            fetchListNameSuggestions: this.fetchListNameSuggestions.bind(this),
            fetchListPagesById: this.fetchListPagesById.bind(this),
            fetchListIgnoreCase: this.fetchListIgnoreCase.bind(this),
            addOpenTabsToList: this.addOpenTabsToList.bind(this),
            removeOpenTabsFromList: this.removeOpenTabsFromList.bind(this),
        })
    }

    generateListId() {
        return Date.now()
    }

    async fetchAllLists({ excludeIds = [], skip = 0, limit = 20 }) {
        return this.storage.fetchAllLists({
            excludedIds: excludeIds,
            limit,
            skip,
        })
    }

    async fetchListById({ id }: { id: number }) {
        return this.storage.fetchListById(id)
    }

    async fetchListByName({ name }: { name: string }) {
        return this.storage.fetchListIgnoreCase({ name })
    }

    async insertMissingLists({ names }: { names: string[] }) {
        const existingLists = new Map<string, number>()

        for (const { name, id } of await this.storage.fetchListByNames(names)) {
            existingLists.set(name, id)
        }

        const missing = names.filter(name => !existingLists.has(name))

        const missingEntries = await Promise.all(
            missing.map(async name => {
                let id: number
                try {
                    id = await this.createCustomList({ name })
                } catch (err) {
                    const list = await this.fetchListByName({ name })
                    id = list.id
                }
                return [name, id] as [string, number]
            }),
        )

        const listIds = new Map([...existingLists, ...missingEntries])

        return names.map(name => listIds.get(name))
    }

    async fetchListPagesById({ id }: { id: number }) {
        return this.storage.fetchListPagesById({
            listId: id,
        })
    }

    async fetchListPagesByUrl({ url }: { url: string }) {
        return this.storage.fetchListPagesByUrl({
            url: normalizeUrl(url),
        })
    }

    async createCustomList({ name }: { name: string }): Promise<number> {
        internalAnalytics.processEvent({
            type: EVENT_NAMES.CREATE_COLLECTION,
        })

        return this.storage.insertCustomList({
            id: this.generateListId(),
            name,
        })
    }

    async updateList({ id, name }: { id: number; name: string }) {
        return this.storage.updateListName({
            id,
            name,
        })
    }

    async insertPageToList({ id, url }: { id: number; url: string }) {
        internalAnalytics.processEvent({
            type: EVENT_NAMES.INSERT_PAGE_COLLECTION,
        })

        return this.storage.insertPageToList({
            listId: id,
            pageUrl: normalizeUrl(url),
            fullUrl: url,
        })
    }

    async removeList({ id }: { id: number }) {
        internalAnalytics.processEvent({
            type: EVENT_NAMES.REMOVE_COLLECTION,
        })

        return this.storage.removeList({
            id,
        })
    }

    async removePageFromList({ id, url }: { id: number; url: string }) {
        internalAnalytics.processEvent({
            type: EVENT_NAMES.REMOVE_PAGE_COLLECTION,
        })

        return this.storage.removePageFromList({
            listId: id,
            pageUrl: normalizeUrl(url),
        })
    }

    async fetchListNameSuggestions({
        name,
        url,
    }: {
        name: string
        url: string
    }) {
        return this.storage.fetchListNameSuggestions({
            name,
            url: normalizeUrl(url),
        })
    }

    async fetchListIgnoreCase({ name }: { name: string }) {
        return this.storage.fetchListIgnoreCase({
            name,
        })
    }

    async addOpenTabsToList({
        listId,
        tabs,
    }: {
        listId: number
        tabs?: Array<Tab>
    }) {
        if (!tabs) {
            const currentWindow = await this.windows.getCurrent()
            tabs = this.tabMan.getTabUrls(currentWindow.id)
        }

        const time = Date.now()

        tabs.forEach(async tab => {
            let page = await getPage(this.getDb)(tab.url)

            if (page == null || page.isStub) {
                page = await createPageFromTab(this.getDb)({
                    tabId: tab.tabId,
                    url: tab.url,
                    allowScreenshot: false,
                })
            }

            // Add new visit if none, else page won't appear in results
            if (!page.visits.length) {
                page.addVisit(time)
            }

            await page.save(this.getDb)
        })

        await Promise.all(
            tabs.map(tab => {
                this.storage.insertPageToList({
                    listId,
                    fullUrl: tab.url,
                    pageUrl: normalizeUrl(tab.url),
                })
            }),
        )
    }

    async removeOpenTabsFromList({
        listId,
        tabs,
    }: {
        listId: number
        tabs?: Array<Tab>
    }) {
        if (!tabs) {
            const currentWindow = await this.windows.getCurrent()
            tabs = this.tabMan.getTabUrls(currentWindow.id)
        }

        await Promise.all(
            tabs.map(tab =>
                this.storage.removePageFromList({
                    listId,
                    pageUrl: normalizeUrl(tab.url),
                }),
            ),
        )
    }
}
