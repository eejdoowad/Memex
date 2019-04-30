import {
    StorageModule,
    StorageModuleConfig,
} from '@worldbrain/storex-pattern-modules'
import { SuggestPlugin, SuggestType } from 'src/search/search/suggest'

import { PageList, PageListEntry } from './types'

export default class CustomListStorage extends StorageModule {
    static CUSTOM_LISTS_COLL = 'customLists'
    static LIST_ENTRIES_COLL = 'pageListEntries'

    getConfig = (): StorageModuleConfig => ({
        collections: {
            [CustomListStorage.CUSTOM_LISTS_COLL]: {
                version: new Date(2018, 6, 12),
                fields: {
                    id: { type: 'string', pk: true },
                    name: { type: 'string' },
                    isDeletable: { type: 'boolean' },
                    isNestable: { type: 'boolean' },
                    createdAt: { type: 'datetime' },
                },
                indices: [
                    { field: 'id', pk: true },
                    { field: 'name', unique: true },
                    { field: 'isDeletable' },
                    { field: 'isNestable' },
                    { field: 'createdAt' },
                ],
            },
            [CustomListStorage.LIST_ENTRIES_COLL]: {
                version: new Date(2018, 6, 12),
                fields: {
                    listId: { type: 'string' },
                    pageUrl: { type: 'string' },
                    fullUrl: { type: 'string' },
                    createdAt: { type: 'datetime' },
                },
                indices: [
                    { field: ['listId', 'pageUrl'], pk: true },
                    { field: 'listId' },
                    { field: 'pageUrl' },
                ],
            },
        },
        operations: {
            createList: {
                collection: CustomListStorage.CUSTOM_LISTS_COLL,
                operation: 'createObject',
            },
            createListEntry: {
                collection: CustomListStorage.LIST_ENTRIES_COLL,
                operation: 'createObject',
            },
            findListsIncluding: {
                collection: CustomListStorage.CUSTOM_LISTS_COLL,
                operation: 'findObjects',
                args: [
                    {
                        id: { $in: '$includedIds:array' },
                    },
                    {
                        limit: '$limit:int',
                        skip: '$skip:int',
                    },
                ],
            },
            findListsExcluding: {
                collection: CustomListStorage.CUSTOM_LISTS_COLL,
                operation: 'findObjects',
                args: [
                    {
                        id: { $nin: '$excludedIds:array' },
                    },
                    {
                        limit: '$limit:int',
                        skip: '$skip:int',
                    },
                ],
            },
            findListById: {
                collection: CustomListStorage.CUSTOM_LISTS_COLL,
                operation: 'findOneObject',
                args: { id: '$id:pk' },
            },
            findListEntries: {
                collection: CustomListStorage.LIST_ENTRIES_COLL,
                operation: 'findObjects',
                args: { listId: '$listId:int', pageUrl: '$url:string' },
            },
            findListEntriesByLists: {
                collection: CustomListStorage.LIST_ENTRIES_COLL,
                operation: 'findObjects',
                args: {
                    listId: { $in: '$listIds:array' },
                    pageUrl: '$url:string',
                },
            },
            findListByName: {
                collection: CustomListStorage.CUSTOM_LISTS_COLL,
                operation: 'findOneObject',
                args: [{ name: '$name:string' }, { ignoreCase: ['name'] }],
            },
            findListByNames: {
                collection: CustomListStorage.CUSTOM_LISTS_COLL,
                operation: 'findObjects',
                args: [
                    { name: { $in: '$names:string' } },
                    { ignoreCase: ['name'] },
                ],
            },
            updateListName: {
                collection: CustomListStorage.CUSTOM_LISTS_COLL,
                operation: 'updateOneObject',
                args: [
                    {
                        id: '$id:pk',
                    },
                    {
                        $set: {
                            name: '$name:string',
                            createdAt: new Date(),
                        },
                    },
                ],
            },
            deleteList: {
                collection: CustomListStorage.CUSTOM_LISTS_COLL,
                operation: 'deleteOneObject',
                args: { id: '$id:pk' },
            },
            deleteListEntries: {
                collection: CustomListStorage.LIST_ENTRIES_COLL,
                operation: 'deleteObjects',
                args: { listId: '$listId:pk', pageUrl: '$url:string' },
            },
            suggestLists: {
                operation: SuggestPlugin.SUGGEST_OBJS_OP_ID,
                args: {
                    collection: '$collection:string',
                    query: '$query:string',
                    options: '$options:any',
                },
            },
        },
    })

    private prepareList(
        list: PageList,
        pages: string[] = [],
        active: boolean = false,
    ): PageList {
        delete list['_name_terms']

        return {
            ...list,
            pages,
            active,
        }
    }

    async fetchAllLists({
        excludedIds = [],
        limit,
        skip,
    }: {
        excludedIds?: string[]
        limit: number
        skip: number
    }) {
        const lists = await this.operation('findListsExcluding', {
            excludedIds,
            limit,
            skip,
        })
        return lists.map(list => this.prepareList(list))
    }

    async fetchListById(id: number) {
        const list = await this.operation('findListById', { id })

        if (!list) {
            return null
        }

        const pages = await this.fetchListPagesById({ listId: list.id })

        return this.prepareList(
            list,
            pages.map(p => p.fullUrl),
            pages.length > 0,
        )
    }

    async fetchListByNames(names: string[]) {
        return this.operation('findListByNames', { names })
    }

    async fetchListPagesById({
        listId,
    }: {
        listId: number
    }): Promise<PageListEntry[]> {
        return this.operation('findListEntries', { listId })
    }

    async fetchListPagesByUrl({ url }: { url: string }) {
        const pages = await this.operation('findListEntries', { url })

        const entriesByListId = new Map<number, any[]>()
        const listIds = new Set<string>()

        pages.forEach(page => {
            listIds.add(page.listId)
            const current = entriesByListId.get(page.listId)
            entriesByListId.set(page.listId, [...current, page.fullUrl])
        })

        const lists = await this.operation('findListsIncluding', {
            includedIds: [...listIds],
        })

        return lists.map(list => {
            const entries = entriesByListId.get(list.id)
            return this.prepareList(list, entries, entries != null)
        })
    }

    async insertCustomList({
        id,
        name,
        isDeletable = true,
        isNestable = true,
    }: {
        id: number
        name: string
        isDeletable?: boolean
        isNestable?: boolean
    }) {
        const { object } = await this.operation('createList', {
            id,
            name,
            isDeletable,
            isNestable,
            createdAt: new Date(),
        })

        return object.id
    }

    async updateListName({ id, name }: { id: number; name: string }) {
        return this.operation('updateListName', { id, name })
    }

    async removeList({ id }: { id: number }) {
        const list = await this.operation('deleteList', { id })
        const pages = await this.operation('deleteListEntries', { listId: id })
        return { list, pages }
    }

    async insertPageToList({
        listId,
        pageUrl,
        fullUrl,
    }: {
        listId: number
        pageUrl: string
        fullUrl: string
    }) {
        const idExists = Boolean(await this.fetchListById(listId))

        if (idExists) {
            return this.operation('createListEntry', {
                listId,
                pageUrl,
                fullUrl,
                createdAt: new Date(),
            })
        }
    }

    async removePageFromList({
        listId,
        pageUrl,
    }: {
        listId: number
        pageUrl: string
    }) {
        return this.operation('deleteListEntries', { listId, pageUrl })
    }

    async fetchListNameSuggestions({
        name,
        url,
    }: {
        name: string
        url: string
    }) {
        const suggestions = await this.operation('suggestLists', {
            name,
            includePks: true,
            limit: 5,
        })
        const listIds = suggestions.map(({ pk }) => pk)

        const lists: PageList[] = suggestions.map(({ pk, suggestion }) => ({
            id: pk,
            name: suggestion,
        }))

        const pageEntries = await this.operation('findListEntriesByLists', {
            listIds,
            pageUrl: url,
        })

        const entriesByListId = new Map<number, any[]>()

        pageEntries.forEach(page => {
            const current = entriesByListId.get(page.listId) || []
            entriesByListId.set(page.listId, [...current, page.fullUrl])
        })

        return lists.map(list => {
            const entries = entriesByListId.get(list.id)
            return this.prepareList(list, entries, entries != null)
        })
    }

    async fetchListIgnoreCase({ name }: { name: string }) {
        return this.operation('findListByName', { name })
    }
}
