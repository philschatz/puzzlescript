declare module 'lighthouse' {

    type NotYetTyped = any; // Anything that has not been defined yet.
  
    type AuditMap = {
      'is-on-https': AuditResult
      'redirects-http': AuditResult
      'service-worker': AuditResult
      'works-offline': AuditResult
      'viewport': AuditResult
      'without-javascript': AuditResult
      'first-contentful-paint': AuditResult
      'first-meaningful-paint': AuditResult
      'load-fast-enough-for-pwa': AuditResult
      'speed-index': AuditResult
      'screenshot-thumbnails': AuditResult
      'final-screenshot': AuditResult
      'estimated-input-latency': AuditResult
      'errors-in-console': AuditResult
      'time-to-first-byte': AuditResult
      'first-cpu-idle': AuditResult
      'interactive': AuditResult
      'user-timings': AuditResult
      'critical-request-chains': AuditResult
      'redirects': AuditResult
      'webapp-install-banner': AuditResult
      'splash-screen': AuditResult
      'themed-omnibox': AuditResult
      'manifest-short-name-length': AuditResult
      'content-width': AuditResult
      'image-aspect-ratio': AuditResult
      'deprecations': AuditResult
      'mainthread-work-breakdown': AuditResult
      'bootup-time': AuditResult
      'uses-rel-preload': AuditResult
      'uses-rel-preconnect': AuditResult
      'font-display': AuditResult
      'network-requests': AuditResult
      'metrics': AuditResult
      'pwa-cross-browser': AuditResult
      'pwa-page-transitions': AuditResult
      'pwa-each-page-has-url': AuditResult
      'accesskeys': AuditResult
      'aria-allowed-attr': AuditResult
      'aria-required-attr': AuditResult
      'aria-required-children': AuditResult
      'aria-required-parent': AuditResult
      'aria-roles': AuditResult
      'aria-valid-attr-value': AuditResult
      'aria-valid-attr': AuditResult
      'audio-caption': AuditResult
      'button-name': AuditResult
      'bypass': AuditResult
      'color-contrast': AuditResult
      'definition-list': AuditResult
      'dlitem': AuditResult
      'document-title': AuditResult
      'duplicate-id': AuditResult
      'frame-title': AuditResult
      'html-has-lang': AuditResult
      'html-lang-valid': AuditResult
      'image-alt': AuditResult
      'input-image-alt': AuditResult
      'label': AuditResult
      'layout-table': AuditResult
      'link-name': AuditResult
      'list': AuditResult
      'listitem': AuditResult
      'meta-refresh': AuditResult
      'meta-viewport': AuditResult
      'object-alt': AuditResult
      'tabindex': AuditResult
      'td-headers-attr': AuditResult
      'th-has-data-cells': AuditResult
      'valid-lang': AuditResult
      'video-caption': AuditResult
      'video-description': AuditResult
      'custom-controls-labels': AuditResult
      'custom-controls-roles': AuditResult
      'focus-traps': AuditResult
      'focusable-controls': AuditResult
      'heading-levels': AuditResult
      'interactive-element-affordance': AuditResult
      'logical-tab-order': AuditResult
      'managed-focus': AuditResult
      'offscreen-content-hidden': AuditResult
      'use-landmarks': AuditResult
      'visual-order-follows-dom': AuditResult
      'uses-long-cache-ttl': AuditResult
      'total-byte-weight': AuditResult
      'offscreen-images': AuditResult
      'render-blocking-resources': AuditResult
      'unminified-css': AuditResult
      'unminified-javascript': AuditResult
      'unused-css-rules': AuditResult
      'uses-webp-images': AuditResult
      'uses-optimized-images': AuditResult
      'uses-text-compression': AuditResult
      'uses-responsive-images': AuditResult
      'efficient-animated-content': AuditResult
      'appcache-manifest': AuditResult
      'doctype': AuditResult
      'dom-size': AuditResult
      'external-anchors-use-rel-noopener': AuditResult
      'geolocation-on-start': AuditResult
      'no-document-write': AuditResult
      'no-vulnerable-libraries': AuditResult
      'js-libraries': AuditResult
      'no-websql': AuditResult
      'notification-on-start': AuditResult
      'password-inputs-can-be-pasted-into': AuditResult
      'uses-http2': AuditResult
      'uses-passive-event-listeners': AuditResult
      'meta-description': AuditResult
      'http-status-code': AuditResult
      'font-size': AuditResult
      'link-text': AuditResult
      'is-crawlable': AuditResult
      'robots-txt': AuditResult
      'hreflang': AuditResult
      'plugins': AuditResult
      'canonical': AuditResult
      'mobile-friendly': AuditResult
      'structured-data': AuditResult
    }
  
    type ScoreDisplayMode =
        'binary'
      | 'numeric'
      | 'informative'
      | 'manual'
      | 'not-applicable';
  
    interface AuditResult {
      id: keyof AuditMap;
      title: string;
      description: string;
      score: number;
      scoreDisplayMode: ScoreDisplayMode;
      rawValue: boolean;
      displayValue?: string;
      explanation?: NotYetTyped;
      errorMessage?: NotYetTyped;
      warnings?: NotYetTyped[];
      details?: { [k: string]: NotYetTyped };
    }
  
    interface TitleIdScore {
      title: string;
      id: string;
      score: number;
      auditRefs: NotYetTyped[];
      manualDescription?: string;
    }
  
    interface LighthouseReport {
      userAgent: string;
      environment: {
        networkUserAgent: string
        hostUserAgent: string
        benchmarkIndex: number
      };
      lighthouseVersion: string;
      fetchTime: string;
      requestedUrl: string;
      finalUrl: string;
      runWarnings: NotYetTyped[];
      runtimeError: {
        code: string
        message: string
      };
  
      audits: AuditMap;
  
      timing: { total: number };
  
      categories: {
        performance: TitleIdScore
        pwa: TitleIdScore
        accessibility: TitleIdScore
        'best-practices': TitleIdScore
        seo: TitleIdScore
        // Our custom categories
        customAccessibility: TitleIdScore
      };
  
      // Other misc fields that are not used yet
      configSettings: NotYetTyped;
      categoryGroups: NotYetTyped;
      i18n: {
        rendererFormattedStrings: NotYetTyped
        icuMessagePaths: NotYetTyped
      };
    }
  
    interface LighthouseResult {
      report: string;
      lhr: LighthouseReport;
      artifacts: NotYetTyped;
    }
  
    const lighthouse: {
  
      // Signature for the main function
      (url: string,
       flags?: {
          output?: 'html';
          port?: number | string;
          disableCpuThrottling?: boolean;
          disableDeviceEmulation?: boolean;
          disableNetworkThrottling?: boolean;
       },
       perfConfig?: NotYetTyped): Promise<LighthouseResult>;
  
      // Additional fields on the lighthouse function (unused)
      getAuditList: NotYetTyped;
      traceCategories: NotYetTyped;
      Audit: NotYetTyped;
      Gatherer: NotYetTyped;
    };
  
    export = lighthouse;
  }
  
  declare module 'lighthouse/lighthouse-core/report/report-generator' {
    type ReportGenerator = {
      generateReportHtml(lhr: any): string
      generateReportCSV(lhr: any): string
      generateReport(lhr: any, outputModes: Array<'html' | 'csv' | 'json'>): string[]
    }
    var reportGenerator: ReportGenerator
    export default reportGenerator
  }