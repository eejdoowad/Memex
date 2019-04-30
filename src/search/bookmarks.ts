import { Bookmarks } from 'webextension-polyfill-ts'

import tabManager from '../activity-logger/background/tab-manager'
import { createPageViaBmTagActs } from './on-demand-indexing'
import { getPage } from './util'
import { DBGet } from './types'

export const addBookmark = (getDb: DBGet) => async ({
    url,
    timestamp = Date.now(),
    tabId,
    fromOverview = false,
}: {
    url: string
    timestamp?: number
    tabId?: number
    fromOverview?: boolean
}) => {
    let page = await getPage(getDb)(url)

    if (!fromOverview && (page == null || page.isStub)) {
        page = await createPageViaBmTagActs(getDb)({ url, tabId })
    }

    page.setBookmark(timestamp)
    await page.save()
    tabManager.setBookmarkState(url, true)
}

export const delBookmark = (getDb: DBGet) => async ({
    url,
}: Partial<Bookmarks.BookmarkTreeNode>) => {
    const page = await getPage(getDb)(url)

    if (page != null) {
        page.delBookmark()

        // Delete if Page left orphaned, else just save current state
        if (page.shouldDelete) {
            await page.delete()
        } else {
            await page.save()
        }
        tabManager.setBookmarkState(url, false)
    }
}

export const pageHasBookmark = (getDb: DBGet) => async (url: string) => {
    const page = await getPage(getDb)(url)

    return page != null ? page.hasBookmark : false
}
