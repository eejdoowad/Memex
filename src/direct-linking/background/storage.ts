import { browser, Tabs, Storage } from 'webextension-polyfill-ts'
import {
    withHistory,
    StorageModule,
    StorageModuleConfig,
} from '@worldbrain/storex-pattern-modules'

import history from './storage.history'

import { createPageFromTab, Tag, StorageManager, DBGet } from 'src/search'
import { STORAGE_KEYS as IDXING_PREF_KEYS } from '../../options/settings/constants'
import { AnnotationsListPlugin } from 'src/search/background/annots-list'
import { AnnotSearchParams } from 'src/search/background/types'
import { Annotation, AnnotListEntry } from '../types'

export interface AnnotationStorageProps {
    storageManager: StorageManager
    browserStorageArea?: Storage.StorageArea
    annotationsColl?: string
    pagesColl?: string
    tagsColl?: string
    bookmarksColl?: string
    listsColl?: string
    listEntriesColl?: string
}

// TODO: Move to src/annotations in the future
export default class AnnotationStorage extends StorageModule {
    static PAGES_COLL = 'pages'
    static ANNOTS_COLL = 'annotations'
    static TAGS_COLL = 'tags'
    static BMS_COLL = 'annotBookmarks'
    static LISTS_COLL = 'customLists'
    static LIST_ENTRIES_COLL = 'annotListEntries'

    private _browserStorageArea: Storage.StorageArea
    private _getDb: DBGet
    private _annotationsColl: string
    private _bookmarksColl: string
    private _tagsColl: string
    private _listsColl: string
    private _listEntriesColl: string

    constructor({
        storageManager,
        browserStorageArea = browser.storage.local,
        annotationsColl = AnnotationStorage.ANNOTS_COLL,
        bookmarksColl = AnnotationStorage.BMS_COLL,
        tagsColl = AnnotationStorage.TAGS_COLL,
        listsColl = AnnotationStorage.LISTS_COLL,
        listEntriesColl = AnnotationStorage.LIST_ENTRIES_COLL,
    }: AnnotationStorageProps) {
        super({ storageManager })

        this._annotationsColl = annotationsColl
        this._tagsColl = tagsColl
        this._bookmarksColl = bookmarksColl
        this._listsColl = listsColl
        this._listEntriesColl = listEntriesColl

        this._browserStorageArea = browserStorageArea

        this._getDb = async () => storageManager
    }

    getConfig = (): StorageModuleConfig =>
        withHistory({
            history,
            collections: {
                [this._annotationsColl]: {
                    version: new Date('2019-02-19'),
                    fields: {
                        pageTitle: { type: 'text' },
                        pageUrl: { type: 'url' },
                        body: { type: 'text' },
                        comment: { type: 'text' },
                        selector: { type: 'json' },
                        createdWhen: { type: 'datetime' },
                        lastEdited: { type: 'datetime' },
                        url: { type: 'string' },
                    },
                    indices: [
                        { field: 'url', pk: true },
                        { field: 'pageUrl' },
                        { field: 'pageTitle' },
                        { field: 'body' },
                        { field: 'createdWhen' },
                        { field: 'lastEdited' },
                        { field: 'comment' },
                    ],
                },
                [this._listEntriesColl]: {
                    version: new Date(2019, 0, 4),
                    fields: {
                        listId: { type: 'int' },
                        url: { type: 'string' },
                        createdAt: { type: 'datetime' },
                    },
                    indices: [
                        { field: ['listId', 'url'], pk: true },
                        { field: 'listId' },
                        { field: 'url' },
                    ],
                },
                [this._bookmarksColl]: {
                    version: new Date(2019, 0, 5),
                    fields: {
                        url: { type: 'string' },
                        createdAt: { type: 'datetime' },
                    },
                    indices: [
                        { field: 'url', pk: true },
                        { field: 'createdAt' },
                    ],
                },
                // NOTE: This is no longer used; keeping to maintain DB schema sanity
                directLinks: {
                    version: new Date(2018, 7, 3),
                    fields: {
                        pageTitle: { type: 'text' },
                        pageUrl: { type: 'url' },
                        body: { type: 'text' },
                        comment: { type: 'text' },
                        selector: { type: 'json' },
                        createdWhen: { type: 'datetime' },
                        lastEdited: { type: 'datetime' },
                        url: { type: 'string' },
                    },
                    indices: [
                        { field: 'url', pk: true },
                        { field: 'pageTitle' },
                        { field: 'pageUrl' },
                        { field: 'body' },
                        { field: 'createdWhen' },
                        { field: 'comment' },
                    ],
                },
            },
            operations: {
                findListById: {
                    collection: this._listsColl,
                    operation: 'findOneObject',
                    args: { id: '$id:pk' },
                },
                findBookmarkByUrl: {
                    collection: this._bookmarksColl,
                    operation: 'findOneObject',
                    args: { url: '$url:pk' },
                },
                findAnnotationByUrl: {
                    collection: this._annotationsColl,
                    operation: 'findOneObject',
                    args: { url: '$url:pk' },
                },
                findTagsByAnnotation: {
                    collection: this._tagsColl,
                    operation: 'findOneObject',
                    args: { url: '$url:string' },
                },
                createAnnotationForList: {
                    collection: this._listEntriesColl,
                    operation: 'createObject',
                },
                createBookmark: {
                    collection: this._bookmarksColl,
                    operation: 'createObject',
                },
                createAnnotation: {
                    collection: this._annotationsColl,
                    operation: 'createObject',
                },
                createTag: {
                    collection: this._tagsColl,
                    operation: 'createObject',
                },
                editAnnotation: {
                    collection: this._annotationsColl,
                    operation: 'updateOneObject',
                    args: [
                        { url: '$url:pk' },
                        {
                            $set: {
                                comment: '$comment:string',
                                lastEdited: new Date(),
                            },
                        },
                    ],
                },
                deleteAnnotation: {
                    collection: this._annotationsColl,
                    operation: 'deleteOneObject',
                    args: { url: '$url:pk' },
                },
                deleteAnnotationFromList: {
                    collection: this._listEntriesColl,
                    operation: 'deleteObjects',
                    args: { listId: '$listId:int', url: '$url:string' },
                },
                deleteBookmarkByUrl: {
                    collection: this._bookmarksColl,
                    operation: 'deleteOneObject',
                    args: { url: '$url:pk' },
                },
                deleteTags: {
                    collection: this._tagsColl,
                    operation: 'deleteObjects',
                    args: { name: '$name:string', url: '$url:string' },
                },
                listAnnotsByPage: {
                    operation: AnnotationsListPlugin.LIST_BY_PAGE_OP_ID,
                    args: [],
                },
            },
        })

    private async getListById({ listId }: { listId: number }) {
        const list = await this.operation('findListById', { id: listId })

        if (list == null) {
            throw new Error(`No list exists for ID: ${listId}`)
        }

        return list.id
    }

    async insertAnnotToList({ listId, url }: AnnotListEntry) {
        await this.getListById({ listId })

        const { object } = await this.operation('createAnnotationForList', {
            listId,
            url,
            createdAt: new Date(),
        })

        return [object.listId, object.url]
    }

    async removeAnnotFromList({ listId, url }: AnnotListEntry) {
        await this.getListById({ listId })

        await this.operation('deleteAnnotationFromList', { listId, url })
    }

    /**
     * @returns Promise resolving to a boolean denoting whether or not a bookmark was created.
     */
    async toggleAnnotBookmark({ url }: { url: string }) {
        const bookmark = await this.operation('findBookmarkByUrl', { url })

        if (bookmark == null) {
            await this.operation('createBookmark', {
                url,
                createdAt: new Date(),
            })
            return true
        }

        await this.operation('deleteBookmarkByUrl', { url })
        return false
    }

    async annotHasBookmark({ url }: { url: string }) {
        const bookmark = await this.operation('findBookmarkByUrl', { url })
        return bookmark != null
    }

    private async fetchIndexingPrefs(): Promise<{ shouldIndexLinks: boolean }> {
        const storage = await this._browserStorageArea.get(
            IDXING_PREF_KEYS.LINKS,
        )

        return {
            shouldIndexLinks: !!storage[IDXING_PREF_KEYS.LINKS],
        }
    }

    async indexPageFromTab({ id, url }: Tabs.Tab) {
        const indexingPrefs = await this.fetchIndexingPrefs()

        const page = await createPageFromTab(this._getDb)({
            tabId: id,
            url,
            stubOnly: !indexingPrefs.shouldIndexLinks,
        })

        await page.loadRels()

        // Add new visit if none, else page won't appear in results
        // TODO: remove once search changes to incorporate assoc. page data apart from bookmarks/visits
        if (!page.visits.length) {
            page.addVisit()
        }

        await page.save()
    }

    async getAnnotationByPk(url: string): Promise<Annotation> {
        return this.operation('findAnnotationByUrl', { url })
    }

    async getAllAnnotationsByUrl(params: AnnotSearchParams) {
        const results: Annotation[] = await this.operation(
            'listAnnotsByPage',
            params,
        )

        return results
    }

    async createAnnotation({
        pageTitle,
        pageUrl,
        body,
        url,
        comment,
        selector,
        createdWhen = new Date(),
    }: Annotation) {
        return this.operation('createAnnotation', {
            pageTitle,
            pageUrl,
            comment,
            body,
            selector,
            createdWhen,
            lastEdited: createdWhen,
            url,
        })
    }

    async editAnnotation(url: string, comment: string) {
        return this.operation('editAnnotation', { url, comment })
    }

    async deleteAnnotation(url: string) {
        return this.operation('deleteAnnotation', { url })
    }

    async getTagsByAnnotationUrl(url: string): Promise<Tag[]> {
        return this.operation('findTagsByAnnotation', { url })
    }

    editAnnotationTags = async (
        tagsToBeAdded: string[],
        tagsToBeDeleted: string[],
        url: string,
    ) => {
        // Remove the tags that are to be deleted.
        await Promise.all(
            tagsToBeDeleted.map(async tag =>
                this.operation('deleteTags', { name: tag, url }),
            ),
        )

        // Add the tags that are to be added.
        return Promise.all(
            tagsToBeAdded.map(async tag =>
                this.operation('createTag', { name: tag, url }),
            ),
        )
    }

    modifyTags = (shouldAdd: boolean) => async (name: string, url: string) => {
        if (shouldAdd) {
            this.operation('createTag', { name, url })
        } else {
            this.operation('deleteTags', { name, url })
        }
    }
}
