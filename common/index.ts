export const PLUGIN_ID = 'annotator';
export const PLUGIN_NAME = 'Document Annotator';
export const ANNOTATIONS_ROUTE_PATH = '/api/annotations';

export * from './types';

export function getFormattedCurrentTimestamp() {
    return new Intl.DateTimeFormat('en', {dateStyle: 'full', timeStyle: 'long'}).format(new Date())
}

export { AnnotationsFormat } from './annotations_format';
