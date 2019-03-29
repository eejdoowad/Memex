import {
    StorageModule,
    StorageModuleConfig,
} from '@worldbrain/storex-pattern-modules'

import * as notifications from '../notifications'
import createNotif from '../../util/notifications'
import { browser } from 'webextension-polyfill-ts'

export default class NotificationStorage extends StorageModule {
    static NOTIFS_COLL = 'notifications'

    getConfig = (): StorageModuleConfig => ({
        collections: {
            [NotificationStorage.NOTIFS_COLL]: {
                version: new Date(2018, 7, 4),
                fields: {
                    id: { type: 'string' },
                    title: { type: 'string' },
                    message: { type: 'string' },
                    buttonText: { type: 'string' },
                    link: { type: 'string' },
                    sentTime: { type: 'datetime' },
                    deliveredTime: { type: 'datetime' },
                    readTime: { type: 'datetime' },
                },
                indices: [{ field: 'id', pk: true }],
            },
        },
        operations: {
            createNotification: {
                collection: NotificationStorage.NOTIFS_COLL,
                operation: 'createObject',
            },
            findNotificationsByRead: {
                collection: NotificationStorage.NOTIFS_COLL,
                operation: 'findObjects',
                args: [
                    { readTime: { $exists: '$isRead:boolean' } },
                    {
                        reverse: '$reverse:boolean',
                        limit: '$limit:int',
                        skip: '$skip:int',
                    },
                ],
            },
            findNotificationById: {
                collection: NotificationStorage.NOTIFS_COLL,
                operation: 'findOneObject',
                args: { id: '$id:pk' },
            },
            countNotifications: {
                collection: NotificationStorage.NOTIFS_COLL,
                operation: 'countObjects',
                args: { readTime: { $exists: '$isRead:boolean' } },
            },
            readNotification: {
                collection: NotificationStorage.NOTIFS_COLL,
                operation: 'countObjects',
                args: { id: '$id:pk', readTime: '$readTime:any' },
            },
        },
    })

    async storeNotification(notification) {
        return this.operation('createNotification', notification)
    }

    async fetchUnreadNotifications() {
        return this.operation('findNotificationsByRead', {
            isRead: false,
            reverse: true,
        })
    }

    async fetchReadNotifications({ limit, skip }) {
        const results = await this.operation('findNotificationsByRead', {
            isRead: true,
            reverse: true,
            limit,
            skip,
        })

        return {
            notifications: results,
            resultExhausted: results.length < limit,
        }
    }

    async fetchUnreadCount() {
        return this.operation('countNotifications', {
            isRead: false,
        })
    }

    async readNotification(id) {
        return this.operation('readNotification', { id, readTime: Date.now() })
    }

    async fetchNotifById(id) {
        return this.operation('findNotificationForId', { id })
    }

    async dispatchNotification(notification) {
        if (notification.overview) {
            const newNotification = {
                ...notification.overview,
                id: notification.id,
                deliveredTime: Date.now(),
                sentTime: notifications.releaseTime,
            }
            // Store the notification so that it displays in the inbox
            await this.storeNotification(newNotification)
        }
        if (notification.system) {
            // Check if the system has to be notified or not
            const url = notification.system.buttons[0].action.url
            // console.log(notification.system.title, 'hello')
            await createNotif(
                {
                    title: notification.system.title,
                    message: notification.system.message,
                },
                () => {
                    return browser.tabs.create({
                        url,
                    })
                },
            )
        }
    }
}
