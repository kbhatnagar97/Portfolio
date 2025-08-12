// Default initial state values for the visualizer
export const INITIAL_MEAN = 100;
export const INITIAL_STDEV = 5;
export const INITIAL_LSL = 85;
export const INITIAL_USL = 115;

// Chart configuration
export const CHART_POINTS = 50;
export const CHART_BOUND_MULTIPLIER = 6;

// === TEXT & CONTENT CONSTANTS ===

export const TEXT_CONTENT = {
  PANEL_TITLES: {
    CONTROLS: 'Distribution Controls',
    INITIAL_SETTINGS: 'Initial Settings',
    METRICS: 'Performance Metrics',
  },

  CONTROL_LABELS: {
    MEAN: 'Mean',
    STDEV: 'Standard Deviation',
    SPEC_LIMITS: 'Specification Limits',
    LSL: 'LSL',
    USL: 'USL',
  },

  BUTTONS: {
    APPLY_DEFAULTS: 'Apply and Set as Default',
  },

  METRIC_LABELS: {
    PP: 'Pp:',
    PPK: 'Ppk:',
    PPM: 'PPM (Total):',
  },

  TOOLTIPS: {
    MEAN: (
      <span>
        <strong>Mean (Average)</strong><br/>
        The center point of your data distribution. 
        This represents the typical value you can expect from your process.
      </span>
    ),
    STDEV: (
      <span>
        <strong>Standard Deviation</strong><br/>
        Measures how much your data varies from the mean. 
        Smaller values indicate more consistent, predictable results.
      </span>
    ),
    LSL: (
      <>
        <strong>LSL: Lower Specification Limit</strong>
        <p>
          The minimum acceptable measurement value.
          Any result below this limit is considered a defect.
        </p>
        <p className='significance'>
          <strong>Example:</strong> For nut-bolt assemblies with 20mm bolts, LSL might be 19.9mm - 
          anything smaller won't fit properly in the nut.
        </p>
      </>
    ),
    USL: (
      <>
        <strong>USL: Upper Specification Limit</strong>
        <p>
          The maximum acceptable measurement value.
          Any result above this limit is considered a defect.
        </p>
        <p className='significance'>
          <strong>Example:</strong> For nut-bolt assemblies with 20mm bolts, USL might be 20.1mm - 
          anything larger won't thread into the nut.
        </p>
      </>
    ),
    PP: (
      <>
        <strong>Pp: Process Potential</strong>
        <p>
          Shows how capable your process would be if perfectly centered between limits.
          Indicates the best-case scenario for your process capability.
        </p>
        <p><strong>Formula:</strong> <code>(USL - LSL) ÷ (6 × Standard Deviation)</code></p>
        <p className='significance'>
          <strong>Interpretation:</strong><br/>
          • &lt; 1.0: Process spread exceeds specification limits<br/>
          • 1.33: Industry standard for acceptable processes<br/>
          • &gt; 1.67: Excellent process with good margins
        </p>
      </>
    ),
    PPK: (
      <>
        <strong>Ppk: Actual Process Performance</strong>
        <p>
          Shows your real-world process capability considering actual centering.
          This is the most important capability metric.
        </p>
        <p><strong>Formula:</strong> <code>min[(USL - Mean) ÷ (3 × StDev), (Mean - LSL) ÷ (3 × StDev)]</code></p>
        <p className='significance'>
          <strong>Interpretation:</strong><br/>
          • &lt; 1.0: Process is producing defects<br/>
          • 1.33: Good process - industry standard<br/>
          • &gt; 1.67: Excellent process performance
        </p>
      </>
    ),
    PPM: (
      <>
        <strong>PPM: Parts Per Million Defects</strong>
        <p>
          Expected number of defective parts out of one million produced.
          Lower numbers indicate better quality.
        </p>
        <p><strong>Formula:</strong> <code>(Total Area Outside Limits) × 1,000,000</code></p>
        <p className='significance'>
          <strong>Quality Levels:</strong><br/>
          • 0-100 PPM: Excellent quality<br/>
          • 100-1,000 PPM: Good quality<br/>
          • 1,000-10,000 PPM: Acceptable for some industries<br/>
          • &gt;10,000 PPM: Poor quality
        </p>
      </>
    ),
    SPEC_LIMITS: (
      <>
        <strong>LSL & USL: Specification Limits</strong>
        <p>
          The Lower (LSL) and Upper (USL) Specification Limits are the
          engineering requirements. They represent the "voice of the customer."
        </p>
        <p className='significance'>
          Significance: Any part measured outside these limits is considered a
          defect, regardless of the process distribution.
        </p>
      </>
    ),
    INITIAL_SETTINGS: (
      <>
        <strong>Initial Settings Panel</strong>
        <p>
          Define your custom default values for the visualizer.
          These will be used as starting points for new sessions.
        </p>
        <p className='significance'>
          Click 'Apply' to save these values as your new defaults.
        </p>
      </>
    ),
  },
};
