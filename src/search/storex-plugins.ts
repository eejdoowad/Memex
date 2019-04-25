import { AnnotationsListPlugin } from 'src/search/background/annots-list'
import { PageUrlMapperPlugin } from 'src/search/background/page-url-mapper'
import { SuggestPlugin } from 'src/search/search/suggest'
import { DexieUtilsPlugin } from 'src/search/plugins/dexie-utils'
import { SearchLookbacksPlugin } from 'src/search/plugins/search-lookbacks'

export const plugins = [
    new AnnotationsListPlugin(),
    new PageUrlMapperPlugin(),
    new SuggestPlugin(),
    new DexieUtilsPlugin(),
    new SearchLookbacksPlugin(),
]
