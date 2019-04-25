import EventModel from './event-model'

export default class Bookmark extends EventModel {
    async save() {
        return this.db.collection('bookmarks').createObject(this)
    }
}
