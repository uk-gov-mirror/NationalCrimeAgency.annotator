/**
 * Crown Copyright 2025, National Crime Agency
 *
 * Package for the annotator UI components.
 *
 * @author d221155 (NCA)
 */

import type {DocViewRenderProps} from '@kbn/unified-doc-viewer/types'
import React, {Fragment, ReactElement, useCallback, useEffect, useState} from 'react'
import {
  EuiButton,
  EuiComboBox,
  EuiComboBoxOptionOption,
  EuiDescriptionList,
  EuiForm,
  EuiFormRow,
  EuiIcon,
  EuiMarkdownEditor,
  EuiRadioGroup,
  EuiRadioGroupOption,
  EuiSpacer,
  EuiSwitch
} from '@elastic/eui'
import {CoreSetup} from '@kbn/core/public'
import {
  ANNOTATIONS_ROUTE_PATH,
  AnnotationType,
  FieldValue,
  PLUGIN_ID,
  TagConfig,
  UpdateAnnotationType
} from '../../../common'
import {AnnotatorPluginStart} from "../../types";
import {useKibana} from '@kbn/kibana-react-plugin/public'

/**
 * Props for the DocViewerAnnotations component.
 */
export interface DocViewerAnnotationsProps extends DocViewRenderProps {
  core: CoreSetup
  field: string
  debug: boolean
  tagConfigs: TagConfig[]
}

/**
 * Flattened annotations configuration.
 */
export interface AnnotationConfigFlat extends Omit<TagConfig, "children" | "name"> {
  categoryName: string
  featureName: string | undefined
}

/**
 * If the value is an array of strings, it will be flattened into a single string,
 * otherwise, the value is just returned.
 * @param value
 * @return
 */
export function flattenValue<T>(value: T): string | T {
  if (Array.isArray(value) && (value.length > 0) && typeof value[0] === 'string') {
    return value.join(', ')
  } else {
    return value
  }
}

/**
 * Flattens the annotation configuration for ease of use.
 * @param annotationConfigs
 */
export function flattenAnnotationConfigs(annotationConfigs: TagConfig[]): AnnotationConfigFlat[] {
  return annotationConfigs.flatMap(
    ({children, name: t_name, ...t}) => (
      (children || []).map(({name: c_name, ...c}) => {
        return {categoryName: t_name, featureName: c_name, ...t, ...c}
      })))
}

/**
 * React component for managing an annotation field on document via the unified-doc-viewer plugin used within Discover.
 * Controls are rendered within a tab (`DocView`) of the document flyout corresponding to the same field.
 *
 * @param hit Document which may contain existing annotations, and the target of any new annotations
 * @param core Kibana Core
 * @param field Name of the specific annotation field in scope
 * @param debug If true debug messages will be logged in the JavaScript console of the user's browser
 * @param tagConfigs Annotator configuration corresponding to the `field` param
 * @constructor
 */
export const DocViewerAnnotations: React.FC<DocViewerAnnotationsProps> = (
  {
    hit,
    core,
    field,
    debug,
    tagConfigs
  }) => {
  const cn = '[DocViewerAnnotations] '

  console.debug(cn + `field="${field}", tagConfigs="${JSON.stringify(tagConfigs)}"`)

  const fieldIdPrefix = `annotations-${field}-${hit.raw._id}`

  // Flattened annotation configurations for "tags"
  const configTags = flattenAnnotationConfigs(tagConfigs)

  // Replaces `.` with `_` within the annotation field name
  const escapedField = field.replace('.', '_')

  // Fetch the user's effective feature privileges
  const capabilities = useKibana<AnnotatorPluginStart>().services.application!.capabilities[PLUGIN_ID] ?? {}

  // True if the user has write privileges
  const writeAccess = (capabilities[`${escapedField}:create`] || capabilities[`${escapedField}:edit`])

  /**
   * Returns a list of `EuiComboBoxOptionOption`s for the given list of annotation configurations.
   * @param annotationConfigs List of annotation configurations
   * @param category (Optional) override for the parent category
   * @param color (Optional) override for the colour
   * @param iconType (Optional) override for the icon
   */
  function formatAnnotationConfigsToComboBoxOptions(
    annotationConfigs: TagConfig[], category?: string, color?: string, iconType?: string): EuiComboBoxOptionOption[] {
    // TODO: Ungroup when there is only a single group
    // TODO: Add support for mutually-exclusive tags, e.g. "Relevant" or "Not Relevant" (can't have both).  Perhaps use a switch control for these options
    const res = annotationConfigs.map((annotationConfig): EuiComboBoxOptionOption => {
      const _color = annotationConfig.color || color || 'default'
      const _iconType = annotationConfig.iconType || iconType || 'tag'
      return {
        label: annotationConfig.name,
        value: category || '',
        prepend: <EuiIcon size="s" type={_iconType}/>,
        color: _color,
        isGroupLabelOption: (annotationConfig.children && annotationConfig.children.length > 0),
        options: (annotationConfig.children && annotationConfig.children.length > 0) ?
          formatAnnotationConfigsToComboBoxOptions(
            // @ts-ignore
            annotationConfig.children, annotationConfig.name, color = _color, iconType = _iconType) : []
      }
    })
    if (debug)
      console.debug(`formatAnnotationConfigsToComboBoxOptions: ` +
        `category="${category}", color="${color}, iconType="${iconType}", res="${res.map(
          (v) => `${v.label}`).join(', ')}"`)
    return res
  }

  /**
   * Returns a list of `<EuiRadioGroupOption>`s for the given list of annotation configurations.
   * @param annotationConfigs List of annotation configurations
   */
  function formatAnnotationConfigsToRadioGroupOptions(annotationConfigs: TagConfig[]): EuiRadioGroupOption[] {
    const res = annotationConfigs.flatMap((annotationConfig): EuiRadioGroupOption[] =>
      annotationConfig?.children?.map((c): EuiRadioGroupOption => ({id: c.name, label: c.name})) ?? []
    ) ?? []
    if (debug)
      console.debug(`formatAnnotationConfigsToRadioGroupOptions: res="${JSON.stringify(res)}"`)
    return res
  }

  /**
   * Returns the comment applied to the annotation (if provided).
   * @param annotations One or more annotations matching a name
   */
  function formatAnnotationsToText(annotations: AnnotationType[]): FieldValue {
    console.debug(`formatAnnotationsToText`)
    return flattenValue(annotations[0]?.feature_comment)
  }

  /**
   * Returns the boolean value of the given annotation (if provided).
   * @param annotations One or more annotations matching a name
   */
  function formatAnnotationsToBoolean(annotations: AnnotationType[]): FieldValue {
    console.debug(`formatAnnotationsToBoolean`)
    const fieldValue = flattenValue(annotations[0]?.feature_category)
    return fieldValue !== undefined
  }

  /**
   * Returns a radio group options ID for the given annotation (if provided).
   * @param annotations One or more annotations matching a name
   */
  function formatAnnotationsToRadioGroupOptionId(annotations: AnnotationType[]): FieldValue {
    console.debug(`formatAnnotationsToRadioGroupOptionId`)
    return flattenValue(annotations[0]?.feature_name)
  }

  /**
   * Returns the first matching (flattened) AnnotationConfig.
   * @param feature_category
   * @param feature_name
   * @returns If matched, returns a flattened AnnotationConfig
   */
  function findAnnotationConfig(feature_category: string, feature_name?: string | undefined) {
    console.debug(cn + `findAnnotationConfig: feature_category="${feature_category}", feature_name="${feature_name}"`)
    return configTags.find((t) => (
      (t.categoryName == feature_category)) && (t.featureName == feature_name ? (t.featureName == feature_name != undefined) : true)
    )
  }

  /**
   * Returns a list of `EuiComboBoxOptionOption`s for the given list of annotations (if provided).
   * @param annotations One or more annotations matching a name
   */
  function formatAnnotationsToComboBoxOptions(annotations: AnnotationType[]): EuiComboBoxOptionOption[] {
    console.debug(cn + `formatAnnotationsToComboBoxOptions"`)
    return annotations.map((annotation): EuiComboBoxOptionOption => {
      const annotationConfig = findAnnotationConfig(annotation.feature_category, annotation.feature_name)
      return {
        label: flattenValue(annotation.feature_name) || '',
        value: flattenValue(annotation.feature_category),
        color: annotationConfig?.color || 'default',
        prepend: <EuiIcon size="s" type={annotationConfig?.iconType || 'tag'}/>
      }
    })
  }

  /**
   * Formats annotations into a map of tag name -> value based on the plugin configuration.
   * @param annotations
   * @returns List of formatted annotation values
   */
  function formatAnnotationsToFieldValues(annotations: AnnotationType[]): Map<string, FieldValue | FieldValue[]> {
    if (debug)
      console.debug(`formatAnnotationsToFieldValues: annotations="${JSON.stringify(annotations)}"`)
    return new Map(tagConfigs.map(annotationConfig => {
      const filteredAnnotations = (annotations || []).filter(
        (t) => t.feature_category == annotationConfig.name
      )

      if (debug)
        console.debug(cn + `formatAnnotationsToFieldValues/tagConfigs.map: ` +
          `annotationConfig.name="${annotationConfig.name}", ` +
          `filteredAnnotations="[${filteredAnnotations.map(
            ({feature_category, feature_name}) =>
              `{${feature_category}: ${feature_name}}`).join(', ')}]"`)

      let fieldValue

      // Extract the annotation field value based on it's defined control type
      if (annotationConfig.controlType === 'text') {
        fieldValue = formatAnnotationsToText(filteredAnnotations)
      } else if (annotationConfig.controlType === 'switch') {
        fieldValue = formatAnnotationsToBoolean(filteredAnnotations)
      } else if (annotationConfig.controlType == 'radio') {
        fieldValue = formatAnnotationsToRadioGroupOptionId(filteredAnnotations)
      } else {
        fieldValue = formatAnnotationsToComboBoxOptions(filteredAnnotations)
      }

      if (debug)
        console.debug(cn + `formatAnnotationsToFieldValues/tagConfigs.map: ` +
          `annotationConfig.name="${annotationConfig.name}", ` +
          `fieldValue="${fieldValue instanceof String ? fieldValue : JSON.stringify(fieldValue)}"`)

      return [annotationConfig.name, fieldValue]
    }))
  }

  /**
   * Formats a field value back into annotations based its matching configuration.
   * @param key
   * @param value
   * @returns List of annotations
   */
  function formatFieldToAnnotations(key: string, value: FieldValue): UpdateAnnotationType[] {
    const annotationConfig = tagConfigs.find(t => t.name === key)
    if (debug)
      console.debug(cn + `formatFieldToAnnotations: key="${key}", value="${value}", ` +
        `annotationConfig="${JSON.stringify(annotationConfig)}"`)
    let res: UpdateAnnotationType[]

    if (value === undefined) {
      res = []
    } else if (annotationConfig?.controlType === 'text') {
      res = (value as string).length > 1 ? [{feature_category: key, feature_comment: (value as string)}] : []
    } else if (annotationConfig?.controlType === 'switch') {
      res = (value as boolean) ? [{feature_category: key}] : []
    } else if (annotationConfig?.controlType === 'radio') {
      res = [{feature_category: key, feature_name: (value as string)}]
    } else {
      res = (value as EuiComboBoxOptionOption[]).map(option => ({
        feature_category: option.value?.toString() || '', feature_name: option.label
      }))
    }

    if (debug)
      console.debug(cn + `formatFieldToAnnotations: res="${JSON.stringify(res)}"`)
    return res
  }

  // Reactive states for each control (representing a tag value) defined in the plugin configuration
  const [fieldValues, setFieldValues] =
    useState<Map<string, FieldValue>>(new Map<string, FieldValue>())

  // Initialise controls for the tags based their current values (if any) within the current document in scope
  useEffect(() => (
    // @ts-ignore
    setFieldValues(formatAnnotationsToFieldValues(hit?.raw?.fields?.[field]))
  ), [hit])

  // Reactive hook to update controls states on change
  const onFieldChange = useCallback((category: string, value: FieldValue) => (
    setFieldValues(new Map([...fieldValues, [category, value]]))
  ), [fieldValues])

  // Call the server component of this plugin to persist any annotation changes on the document
  // @ts-ignore
  const saveChanges = useCallback((e) => {
    e.preventDefault()

    // Pass a fully qualified location to the particular field being updated on the document
    const path = `${ANNOTATIONS_ROUTE_PATH}/${hit.raw._index}/${hit.raw._id}/${field}/tag`

    // Extract the control states back into the expected format to be stored back on the document
    const annotations = Array.from(fieldValues.entries()).flatMap(
      ([k, v]) => formatFieldToAnnotations(k, v))

    if (debug)
      console.debug(cn + `saveChanges: annotations="${JSON.stringify(annotations)}", path=${path}`)

    // Call the server component
    core.http.post(path, {
      body: JSON.stringify({partial: {annotations: annotations}})
    }).then((response) => {
      if (debug)
        console.debug(cn + `saveChanges/post.then: Success, response="${JSON.stringify(response)}"`)
      core.notifications.toasts.addSuccess({title: 'Success', text: 'Changes saved'})

      // "Click" the refresh button to update the data in the underlying Kibana `DataViewerTable` component
      const submitButton: (HTMLButtonElement | null) = document.querySelector('[data-test-subj="querySubmitButton"]')
      if (!submitButton) {
        core.notifications.toasts.addWarning(
          {title: 'Save Changes: Unable to refresh view', text: 'Unable to find "querySubmitButton" button'})
      } else {
        // "Fake click" the refresh button to force the data table to re-render
        submitButton.click()
      }
    }).catch((e: Error) => {
      console.error(cn + `saveChanges/post.catch: e="${JSON.stringify(e)}"`)
      core.notifications.toasts.addError(e, {title: 'Save Changes: Server Error'})
    })
  }, [hit, fieldValues])

  /**
   * Generates input controls for manipulating an annotation based on the given configuration.
   *
   *  * `text`    -> `<EuiMarkdownEditor>`
   *  * `switch`  -> `<EuiSwitch>`
   *  * `radio`   -> `<EuiRadioGroup>`
   *  * default   -> `<EuiComboBox>`
   *
   * @param tagConfig
   */
  function generateAnnotationControl(tagConfig: TagConfig): ReactElement {
    console.debug(cn + `generateAnnotationControl: annotationConfig.name="${tagConfig.name}", ` +
      `annotationConfig.controlType="${tagConfig.controlType}"`)
    if (tagConfig.controlType === 'text') {
      return <EuiMarkdownEditor
        key={`${fieldIdPrefix}_form_${tagConfig.name}_text`}
        placeholder="Add any comments here..."
        aria-label={`${tagConfig.name} editor`}
        value={(fieldValues.get(tagConfig.name) as string)}
        onChange={(v) => onFieldChange(tagConfig.name, v)}
        initialViewMode="viewing"
        markdownFormatProps={{textSize: 's'}}
      />
    } else if (tagConfig.controlType === 'switch') {
      // TODO: Allow resetting to a "no selection" state, effectively deleting the annotation
      return <EuiSwitch
        key={`${fieldIdPrefix}_form_${tagConfig.name}_switch`}
        aria-label={tagConfig.name}
        label={tagConfig.name}
        showLabel={false}
        checked={(fieldValues.get(tagConfig.name) as boolean) ?? false}
        onChange={(e) => onFieldChange(tagConfig.name, e.target.checked)}
      />
    } else if (tagConfig.controlType === 'radio') {
      // TODO: Allow resetting to a "no selection" state, effectively deleting the annotation
      return <EuiRadioGroup
        key={`${fieldIdPrefix}_form_${tagConfig.name}_radio`}
        aria-label={tagConfig.name}
        options={formatAnnotationConfigsToRadioGroupOptions([tagConfig])}
        idSelected={(fieldValues.get(tagConfig.name) as string)}
        onChange={(optionId) => onFieldChange(tagConfig.name, optionId)}
        data-test-subj="tagsRadioGroup"
      />
    } else {
      return <EuiComboBox
        key={`${fieldIdPrefix}_form_${tagConfig.name}_combobox`}
        aria-label={tagConfig.name}
        options={formatAnnotationConfigsToComboBoxOptions([tagConfig])}
        selectedOptions={(fieldValues.get(tagConfig.name) as EuiComboBoxOptionOption[])}
        onChange={(v) => onFieldChange(tagConfig.name, v)}
        isClearable={true}
        data-test-subj="tagsComboBox"
        placeholder="Select one or more tags"
      />
    }
  }

  /**
   * Generates input controls for interacting with all annotations defined within the plugin configuration.
   */
  function generateAnnotationControls() {
    return (
      <Fragment>
        {tagConfigs.map((annotationConfig) => (
            <EuiFormRow key={`${fieldIdPrefix}_form_${annotationConfig.name}`} label={annotationConfig.name}>
              {generateAnnotationControl(annotationConfig)}
            </EuiFormRow>
          )
        )}
      </Fragment>
    )
  }

  return (
    <Fragment>
      <EuiSpacer size="m"/>

      <EuiForm key={`${fieldIdPrefix}_form`} component="form">
        <EuiDescriptionList key={`${fieldIdPrefix}_form_controls`}>
          {generateAnnotationControls()}
        </EuiDescriptionList>

        <EuiSpacer size="m"/>
        {writeAccess && (
          <EuiButton key={`${fieldIdPrefix}_form_save_button`} type="submit" fill onClick={saveChanges}>
            Save Changes
          </EuiButton>
        )}
      </EuiForm>
    </Fragment>
  )
}
