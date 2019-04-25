import AbstractModel from './abstract-model'

export default class Tag extends AbstractModel {
    constructor(db, { name, url }) {
        super(db)
        this.name = name
        this.url = url
    }

    async save() {
        return this.db.collection('tags').createObject(this)
    }

    async delete() {
        return this.db
            .collection('tags')
            .deleteOneObject({ name: this.name, url: this.rul })
    }
}
