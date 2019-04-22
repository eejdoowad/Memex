import { AnnotationsListPlugin } from 'src/search/background/annots-list'
import { PageUrlMapperPlugin } from 'src/search/background/page-url-mapper'
import { SuggestPlugin } from 'src/search/search/suggest'

export const plugins = [
    new AnnotationsListPlugin(),
    new PageUrlMapperPlugin(),
    new SuggestPlugin(),
]
