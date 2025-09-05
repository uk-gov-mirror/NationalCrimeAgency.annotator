import {KBN_FIELD_TYPES} from '@kbn/field-types'
import {FieldFormat} from '@kbn/field-formats-plugin/common'
import {
  HtmlContextTypeConvert,
  HtmlContextTypeOptions,
  TextContextTypeConvert
} from "@kbn/field-formats-plugin/common/types"
import {EuiBadge} from '@elastic/eui'
import React, {Fragment} from 'react'
import ReactDOM from 'react-dom/server'
import {AnnotationType} from './types'

function formatAnnotationsToBadges(annotations: AnnotationType[]): string {
  // TODO: Needs rendering within an EUI root element to use styles correctly
  return ReactDOM.renderToString(
    <Fragment>{annotations.map((annotation) => (
      'feature_name' in annotation ? (
        <EuiBadge key={`annotation_badge_${annotation.feature_name ?? annotation.feature_category}`}
                  color="default" iconType="tag">
          {annotation.feature_name ?? annotation.feature_category}
        </EuiBadge>
      ) : annotation.feature_category
    ))}</Fragment>
  )
}

export class AnnotationsFormat extends FieldFormat {
  static id = 'annotations'
  static title = 'Annotations'
  static fieldType = [
    KBN_FIELD_TYPES.STRING,
    KBN_FIELD_TYPES.UNKNOWN
  ]

  getParamDefaults() {
    return {
      // TODO: Populate with common config from plugin
    }
  }

  textConvert: TextContextTypeConvert =
    (value: string | AnnotationType) => {
      console.debug(`[AnnotationsFormat] textConvert: value="${value}"`)
      const annotation = (typeof value === 'string') ? JSON.parse(value) : value
      return JSON.stringify(annotation)
    }

  htmlConvert: HtmlContextTypeConvert =
    (value: string | AnnotationType, options: HtmlContextTypeOptions | undefined = {}) => {
      console.debug(`[AnnotationsFormat] htmlConvert: value="${value}", options="${options}"`)

      try {
        if (typeof value === 'string') {
          console.debug(`[AnnotationsFormat] value is a string`)
          return formatAnnotationsToBadges(!['[]', ']'].includes(value) ? JSON.parse(value) : [])
        } else {
          console.debug(`[AnnotationsFormat] value is an object`)
          return formatAnnotationsToBadges([value])
        }
      } catch (e) {
        console.error(`[AnnotationsFormat] error parsing "${value}" error: ${e}`)
        return ReactDOM.renderToStaticMarkup(
          <Fragment/>
        )
      }
    }
}
