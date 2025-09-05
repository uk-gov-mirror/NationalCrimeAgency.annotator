/**
 * Crown Copyright 2025, National Crime Agency
 *
 * Package for initialising this plugin.
 *
 * @author d221155 (NCA)
 */

import {CoreSetup, CoreStart, Plugin, PluginInitializerContext} from '@kbn/core/public'
import {
  AnnotatorPluginSetup,
  AnnotatorPluginStart
} from './types'
import {AnnotationsFormat, ConfigType, DocViewConfig, PLUGIN_ID} from '../common'
import {DocViewRenderProps} from '@kbn/unified-doc-viewer/types'
import React from 'react'
import {EuiDelayRender, EuiSkeletonText} from '@elastic/eui'
import {FieldFormatsSetup} from '@kbn/field-formats-plugin/public'

// Lazily initialises the plugin components
const AnnotationsDocViewer =
  React.lazy(() => import('./components/doc_viewer_annotations'))

// Registers a custom Field Formatter for use within Data Views
export function registerAnnotationsFormatter(fieldFormats: FieldFormatsSetup) {
  fieldFormats.register([AnnotationsFormat]);
}

/**
 * Annotator plugin.
 */
// noinspection TypeScriptValidateJSTypes
export class AnnotatorPlugin
  implements Plugin<unknown, unknown, AnnotatorPluginSetup, AnnotatorPluginStart> {
  private readonly cn = '[AnnotatorPlugin] '
  private readonly config: ConfigType

  constructor(initializerContext: PluginInitializerContext) {
    // Get the plugin config (as defined the standard Kibana config)
    this.config = initializerContext.config.get<ConfigType>()

    if (this.config.debug)
      console.debug(this.cn + `constructor: config="${JSON.stringify(this.config)}"`)
  }

  /**
   * Returns true if at least one annotation field has been configured and is accessible to the current user.
   * @param docViewConfig
   * @param capabilities
   * @private
   */
  private shouldShowFlyout(docViewConfig: DocViewConfig, capabilities: Record<string, boolean | Record<string, boolean>>): boolean {
    return docViewConfig.fields.map((f) => f.replace('.', '_')).filter(
      (f) => capabilities[`${f}:view`]
    ).length > 0
  }

  /**
   * Lifecycle hook, invoked by Kibana during startup.
   *
   * Registers the custom Field Formatter and tabs into the Discover flyout.
   * @param core
   * @param deps
   */
  public async setup(
    core: CoreSetup<AnnotatorPluginStart>, deps: AnnotatorPluginSetup) {
    const config = this.config

    // Register a custom field formatter
    console.debug(this.cn + `setup: Adding custom field formatter`)
    registerAnnotationsFormatter(deps.fieldFormats)

    // Fetch the user's effective feature privileges
    const [coreStart] = await core.getStartServices()
    const capabilities: Record<string, boolean | Record<string, boolean>> = coreStart.application.capabilities[PLUGIN_ID] ?? {}

    // Pre-filter the `DocViewConfig`s to only those which the user has access
    config.docViews.filter(
      docViewConfig => this.shouldShowFlyout(docViewConfig, capabilities)
    ).map((docView) => {
      // Add the `DocView` to the `UnifiedDocViewer` (this will appear as another tab within the Discover view flyout)
      console.debug(this.cn + `setup/config.docViews.map: Adding DocView, title="${docView.title}"`)
      deps.unifiedDocViewer.registry.add({
        // Use the defined ID (if provided) or generate one based on the title
        id: docView.id || docView.title.toLowerCase().replace(' ', '_'),
        title: docView.title,
        order: docView.order,
        component: (props: DocViewRenderProps) => {
          return (
            <React.Suspense
              fallback={
                <EuiDelayRender delay={300}>
                  <EuiSkeletonText/>
                </EuiDelayRender>
              }
            >
              {docView.fields.map((f) =>
                <AnnotationsDocViewer
                  {...props}
                  core={core}
                  field={f}
                  debug={this.config.debug}
                  tagConfigs={config.annotations.find(ac => ac.field == f)?.tags ?? []}
                />
              )}
            </React.Suspense>
          )
        }
      })
    })
  }

  /**
   * Lifecycle hook, invoked by Kibana during page load.
   *
   * @param core
   * @param deps
   */
  public start(core: CoreStart, deps: AnnotatorPluginStart) {
    return {}
  }

  /**
   * Lifecycle hook, invoked by Kibana during shutdown.
   */
  public stop() {
  }
}
