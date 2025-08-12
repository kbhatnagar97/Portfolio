import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler,
  ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import annotationPlugin from 'chartjs-plugin-annotation';
import * as vega from 'vega-statistics';
import Tooltip from '../../common/components/Tooltip';
import SimpleHeader from '../../common/components/SimpleHeader/SimpleHeader';

import {
  INITIAL_MEAN,
  INITIAL_STDEV,
  INITIAL_LSL,
  INITIAL_USL,
  CHART_POINTS,
  CHART_BOUND_MULTIPLIER,
  TEXT_CONTENT,
} from './constants';

import './index.scss';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend,
  Filler,
  annotationPlugin
);

const GaussianVisualizerPage: React.FC = () => {
  const [initialMean, setInitialMean] = useState(INITIAL_MEAN);
  const [initialStdev, setInitialStdev] = useState(INITIAL_STDEV);
  const [initialLsl, setInitialLsl] = useState(INITIAL_LSL);
  const [initialUsl, setInitialUsl] = useState(INITIAL_USL);

  const [initialMeanInput, setInitialMeanInput] = useState(
    String(INITIAL_MEAN)
  );
  const [initialStdevInput, setInitialStdevInput] = useState(
    String(INITIAL_STDEV)
  );
  const [initialLslInput, setInitialLslInput] = useState(String(INITIAL_LSL));
  const [initialUslInput, setInitialUslInput] = useState(String(INITIAL_USL));

  const [mean, setMean] = useState<number>(initialMean);
  const [stdev, setStdev] = useState<number>(initialStdev);
  const [lsl, setLsl] = useState<number>(initialLsl);
  const [usl, setUsl] = useState<number>(initialUsl);

  const [axisMin, setAxisMin] = useState<number>(
    mean - CHART_BOUND_MULTIPLIER * stdev
  );
  const [axisMax, setAxisMax] = useState<number>(
    mean + CHART_BOUND_MULTIPLIER * stdev
  );
  const [lslInput, setLslInput] = useState<string>(lsl.toFixed(2));
  const [uslInput, setUslInput] = useState<string>(usl.toFixed(2));
  const chartRef = useRef<ChartJS<'line'>>(null);

  useEffect(() => {
    const chart = chartRef.current;
    if (chart) {
      // FIX: Increase timeout to ensure it runs *after* the 300ms CSS transition.
      const timeoutId = setTimeout(() => {
        chart.resize();
      }, 310);
      return () => clearTimeout(timeoutId);
    }
  }, []);

  useEffect(() => {
    setLslInput(lsl.toFixed(2));
  }, [lsl]);
  useEffect(() => {
    setUslInput(usl.toFixed(2));
  }, [usl]);

  // Scroll to top when component mounts, especially important for mobile
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Also ensure the document element is scrolled to top (for different browsers)
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  const recalculateBounds = (currentMean = mean, currentStdev = stdev) => {
    const newMin = currentMean - CHART_BOUND_MULTIPLIER * currentStdev;
    const newMax = currentMean + CHART_BOUND_MULTIPLIER * currentStdev;
    setAxisMin(newMin);
    setAxisMax(newMax);
  };

  const chartData = useMemo(() => {
    const dataPoints: { x: number; y: number }[] = [];
    const step = (axisMax - axisMin) / CHART_POINTS;
    if (step <= 0) return { datasets: [] };
    for (let i = axisMin; i <= axisMax; i += step) {
      dataPoints.push({ x: i, y: vega.densityNormal(i, mean, stdev) });
    }
    return { datasets: [{ data: dataPoints }] };
  }, [mean, stdev, axisMin, axisMax]);

  const metrics = useMemo(() => {
    if (stdev <= 0) return { pp: 'N/A', ppk: 'N/A', ppm: 'N/A' };
    const pp = (usl - lsl) / (6 * stdev);
    const ppk = Math.min(
      (usl - mean) / (3 * stdev),
      (mean - lsl) / (3 * stdev)
    );
    const areaBelowLSL = vega.cumulativeNormal(lsl, mean, stdev);
    const areaAboveUSL = 1 - vega.cumulativeNormal(usl, mean, stdev);
    const ppm = (areaBelowLSL + areaAboveUSL) * 1000000;
    return {
      pp: pp.toFixed(2),
      ppk: ppk.toFixed(2),
      ppm: ppm.toLocaleString(undefined, { maximumFractionDigits: 0 }),
    };
  }, [mean, stdev, lsl, usl]);

  const chartOptions: ChartOptions<'line'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      scales: {
        y: { display: false },
        x: {
          type: 'linear',
          min: axisMin,
          max: axisMax,
          grid: { color: '#eae6e1' },
          ticks: { color: '#a39189', maxTicksLimit: 10 },
        },
      },
      plugins: {
        legend: { display: false },
        title: { display: false },
        annotation: {
          animations: false,
          annotations: {
            meanLine: {
              type: 'line',
              xMin: mean,
              xMax: mean,
              borderColor: '#442b22',
              borderWidth: 2,
            },
            lslLine: {
              type: 'line',
              xMin: lsl,
              xMax: lsl,
              borderColor: '#a39189',
              borderWidth: 2,
              borderDash: [6, 6],
            },
            uslLine: {
              type: 'line',
              xMin: usl,
              xMax: usl,
              borderColor: '#a39189',
              borderWidth: 2,
              borderDash: [6, 6],
            },
          },
        },
      },
      elements: {
        point: { radius: 0 },
        line: {
          borderColor: '#442b22',
          borderWidth: 2,
          fill: { target: 'origin', above: 'rgba(68, 43, 34, 0.2)' },
          tension: 0.4,
        },
      },
    }) as ChartOptions<'line'>,
    [mean, lsl, usl, axisMin, axisMax]
  );

  const handleInputChange = (setter: (val: number) => void, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) setter(numValue);
  };
  const handleLslBlur = () => {
    const numValue = parseFloat(lslInput);
    if (!isNaN(numValue) && numValue < usl) {
      setLsl(numValue);
    } else {
      setLslInput(lsl.toFixed(2));
    }
  };
  const handleUslBlur = () => {
    const numValue = parseFloat(uslInput);
    if (!isNaN(numValue) && numValue > lsl) {
      setUsl(numValue);
    } else {
      setUslInput(usl.toFixed(2));
    }
  };

  const handleLslChange = (value: number) => {
    if (value < usl) {
      setLsl(value);
    }
  };

  const handleUslChange = (value: number) => {
    if (value > lsl) {
      setUsl(value);
    }
  };

  const handleInitialLslBlur = () => {
    const numValue = parseFloat(initialLslInput);
    const currentUsl = parseFloat(initialUslInput) || initialUsl;
    if (!isNaN(numValue) && numValue < currentUsl) {
      // Valid LSL
    } else {
      // Invalid LSL, reset to current valid value
      setInitialLslInput(String(initialLsl));
    }
  };

  const handleInitialUslBlur = () => {
    const numValue = parseFloat(initialUslInput);
    const currentLsl = parseFloat(initialLslInput) || initialLsl;
    if (!isNaN(numValue) && numValue > currentLsl) {
      // Valid USL
    } else {
      // Invalid USL, reset to current valid value
      setInitialUslInput(String(initialUsl));
    }
  };

  const handleApplyInitialSettings = () => {
    const newInitialMean = parseFloat(initialMeanInput) || INITIAL_MEAN;
    const newInitialStdev = Math.max(
      0.1,
      parseFloat(initialStdevInput) || INITIAL_STDEV
    );
    let newInitialLsl = parseFloat(initialLslInput) || INITIAL_LSL;
    let newInitialUsl = parseFloat(initialUslInput) || INITIAL_USL;

    // Validate that LSL < USL
    if (newInitialLsl >= newInitialUsl) {
      // If LSL >= USL, reset to current valid values
      newInitialLsl = lsl;
      newInitialUsl = usl;
      setInitialLslInput(String(lsl));
      setInitialUslInput(String(usl));
      alert(
        'Error: LSL must be less than USL. Values have been reset to current valid settings.'
      );
      return;
    }

    // Validate standard deviation is positive
    if (newInitialStdev <= 0) {
      setInitialStdevInput(String(INITIAL_STDEV));
      alert('Error: Standard deviation must be greater than 0.');
      return;
    }

    setInitialMean(newInitialMean);
    setInitialStdev(newInitialStdev);
    setInitialLsl(newInitialLsl);
    setInitialUsl(newInitialUsl);

    // Apply the new initial settings as current values
    setMean(newInitialMean);
    setStdev(newInitialStdev);
    setLsl(newInitialLsl);
    setUsl(newInitialUsl);
    recalculateBounds(newInitialMean, newInitialStdev);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fbfaf8' }}>
      <SimpleHeader title='Gaussian Visualizer' />
      <div className='gaussian-page-padding'>
        <div className='gaussian-visualizer-feature'>
          <div className='gv-chart-container'>
            <Line
              ref={chartRef}
              options={chartOptions}
              data={chartData}
            />
          </div>
          <div className='gv-panels-container'>
            <div className='gv-panel gv-panel--bordered gv-panel--initial-settings'>
              <h3 className='panel-title label-with-tooltip'>
                {TEXT_CONTENT.PANEL_TITLES.INITIAL_SETTINGS}
                <Tooltip content={TEXT_CONTENT.TOOLTIPS.INITIAL_SETTINGS} />
              </h3>
              <div className='control-group'>
                <div className='dual-inputs four-up'>
                  <div className='input-with-label'>
                    <label htmlFor='init-mean-input'>
                      {TEXT_CONTENT.CONTROL_LABELS.MEAN}
                    </label>
                    <input
                      type='number'
                      id='init-mean-input'
                      className='native-input'
                      value={initialMeanInput}
                      onChange={(e) => setInitialMeanInput(e.target.value)}
                    />
                  </div>
                  <div className='input-with-label'>
                    <label htmlFor='init-stdev-input'>
                      {TEXT_CONTENT.CONTROL_LABELS.STDEV}
                    </label>
                    <input
                      type='number'
                      id='init-stdev-input'
                      className='native-input'
                      value={initialStdevInput}
                      onChange={(e) => setInitialStdevInput(e.target.value)}
                      min='0.1'
                    />
                  </div>
                  <div className='input-with-label'>
                    <label htmlFor='init-lsl-input'>
                      {TEXT_CONTENT.CONTROL_LABELS.LSL}
                    </label>
                    <input
                      type='number'
                      id='init-lsl-input'
                      className='native-input'
                      value={initialLslInput}
                      onChange={(e) => setInitialLslInput(e.target.value)}
                      onBlur={handleInitialLslBlur}
                      onKeyDown={(e) =>
                        e.key === 'Enter' &&
                        (e.target as HTMLInputElement).blur()
                      }
                    />
                  </div>
                  <div className='input-with-label'>
                    <label htmlFor='init-usl-input'>
                      {TEXT_CONTENT.CONTROL_LABELS.USL}
                    </label>
                    <input
                      type='number'
                      id='init-usl-input'
                      className='native-input'
                      value={initialUslInput}
                      onChange={(e) => setInitialUslInput(e.target.value)}
                      onBlur={handleInitialUslBlur}
                      onKeyDown={(e) =>
                        e.key === 'Enter' &&
                        (e.target as HTMLInputElement).blur()
                      }
                    />
                  </div>
                </div>
              </div>
              <div className='gv-button-container'>
                <button
                  className='gv-button'
                  onClick={handleApplyInitialSettings}
                >
                  {TEXT_CONTENT.BUTTONS.APPLY_DEFAULTS}
                </button>
              </div>
            </div>
            <div className='gv-panel gv-panel--bordered gv-panel--controls'>
              <h3 className='panel-title'>
                {TEXT_CONTENT.PANEL_TITLES.CONTROLS}
              </h3>
              <div className='control-group'>
                <label
                  htmlFor='mean-slider'
                  className='control-label label-with-tooltip'
                >
                  {TEXT_CONTENT.CONTROL_LABELS.MEAN}
                  <Tooltip content={TEXT_CONTENT.TOOLTIPS.MEAN} />
                </label>
                <div className='slider-group'>
                  <input
                    type='range'
                    id='mean-slider'
                    className='native-slider'
                    min={axisMin}
                    max={axisMax}
                    step={0.1}
                    value={mean}
                    onChange={(e) => setMean(parseFloat(e.target.value))}
                  />
                  <input
                    type='number'
                    className='native-input'
                    value={mean.toFixed(2)}
                    onChange={(e) => handleInputChange(setMean, e.target.value)}
                  />
                </div>
              </div>
              <div className='control-group'>
                <label
                  htmlFor='stdev-slider'
                  className='control-label label-with-tooltip'
                >
                  {TEXT_CONTENT.CONTROL_LABELS.STDEV}
                  <Tooltip content={TEXT_CONTENT.TOOLTIPS.STDEV} />
                </label>
                <div className='slider-group'>
                  <input
                    type='range'
                    id='stdev-slider'
                    className='native-slider'
                    min={0.1}
                    max={50}
                    step={0.1}
                    value={stdev}
                    onChange={(e) => setStdev(parseFloat(e.target.value))}
                  />
                  <input
                    type='number'
                    className='native-input'
                    value={stdev.toFixed(2)}
                    onChange={(e) =>
                      handleInputChange(setStdev, e.target.value)
                    }
                  />
                </div>
              </div>
              <div className='control-group'>
                <label
                  htmlFor='lsl-slider'
                  className='control-label label-with-tooltip'
                >
                  {TEXT_CONTENT.CONTROL_LABELS.LSL}
                  <Tooltip content={TEXT_CONTENT.TOOLTIPS.LSL} />
                </label>
                <div className='slider-group'>
                  <input
                    type='range'
                    id='lsl-slider'
                    className='native-slider'
                    min={axisMin}
                    max={usl - 0.1}
                    step={0.1}
                    value={lsl}
                    onChange={(e) =>
                      handleLslChange(parseFloat(e.target.value))
                    }
                  />
                  <input
                    type='number'
                    className='native-input'
                    value={lslInput}
                    onChange={(e) => setLslInput(e.target.value)}
                    onBlur={handleLslBlur}
                    onKeyDown={(e) =>
                      e.key === 'Enter' && (e.target as HTMLInputElement).blur()
                    }
                  />
                </div>
              </div>
              <div className='control-group'>
                <label
                  htmlFor='usl-slider'
                  className='control-label label-with-tooltip'
                >
                  {TEXT_CONTENT.CONTROL_LABELS.USL}
                  <Tooltip content={TEXT_CONTENT.TOOLTIPS.USL} />
                </label>
                <div className='slider-group'>
                  <input
                    type='range'
                    id='usl-slider'
                    className='native-slider'
                    min={lsl + 0.1}
                    max={axisMax}
                    step={0.1}
                    value={usl}
                    onChange={(e) =>
                      handleUslChange(parseFloat(e.target.value))
                    }
                  />
                  <input
                    type='number'
                    className='native-input'
                    value={uslInput}
                    onChange={(e) => setUslInput(e.target.value)}
                    onBlur={handleUslBlur}
                    onKeyDown={(e) =>
                      e.key === 'Enter' && (e.target as HTMLInputElement).blur()
                    }
                  />
                </div>
              </div>
            </div>
            <div className='gv-panel gv-panel--metrics'>
              <h3 className='panel-title'>
                {TEXT_CONTENT.PANEL_TITLES.METRICS}
              </h3>
              <div className='metric-item'>
                <span className='metric-label label-with-tooltip'>
                  {TEXT_CONTENT.METRIC_LABELS.PP}
                  <Tooltip content={TEXT_CONTENT.TOOLTIPS.PP} />
                </span>
                <span className='metric-value'>{metrics.pp}</span>
              </div>
              <div className='metric-item'>
                <span className='metric-label label-with-tooltip'>
                  {TEXT_CONTENT.METRIC_LABELS.PPK}
                  <Tooltip content={TEXT_CONTENT.TOOLTIPS.PPK} />
                </span>
                <span className='metric-value'>{metrics.ppk}</span>
              </div>
              <div className='metric-item'>
                <span className='metric-label label-with-tooltip'>
                  {TEXT_CONTENT.METRIC_LABELS.PPM}
                  <Tooltip content={TEXT_CONTENT.TOOLTIPS.PPM} />
                </span>
                <span className='metric-value'>{metrics.ppm}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GaussianVisualizerPage;
