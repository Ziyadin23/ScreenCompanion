import * as fs from 'node:fs/promises';
import { once } from 'node:events';
import { dirname, join } from 'node:path';
import { app, BrowserWindow, nativeImage, screen, type NativeImage } from 'electron';
import type { CapturedFrame, PixelBounds, WindowsPlatform } from '../../src/contracts';
import { createWindowsPlatform } from '../../src/platform';
import { ALL_CASES, CAPTURE_CASES, LAYOUTS, visualCase, type Layout, type VisualCase } from './cases';
import { CampaignExecutionError, executeCampaign } from './execution';
import { CampaignLedger } from './ledger';
import { measureRun } from './measure';
import { liveOptions } from './options';
import { MetadataResults, privateDestinations } from './results';
import { bitmap, PresentationDeadline, PresentationError, questionPixels, sameBounds, waitForNativePresentation,
  type Bitmap, type PresentationGeometry } from './readiness';
import { readNormalDeepSeekKey } from './vault';
import { fixtureHtml } from './visual';
import { liveRegistry, phaseRuns } from './campaign';
import type { RequiredVisual } from './coverage';
import { requireCandidate, sourceIdentity } from './identity.mjs';
import { CampaignContinuity } from './transport';

if (process.platform !== 'win32') { console.error('Windows visual/native/live lab was NOT RUN: this host is not Windows.'); process.exit(1); }
const temporary = process.env.SC_LAB_TEMP;
if (!temporary || !process.env.SC_LAB_NATIVE_PATH || !process.env.SC_LAB_PROJECT_ROOT) { console.error('Use the lab/deepseek script runner to supply the Windows native ABI and bundled entry.'); process.exit(1); }
app.setPath('userData', temporary);
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disk-cache-size', '0');
app.commandLine.appendSwitch('disable-logging');
app.disableHardwareAcceleration();
const args = process.argv.slice(2);
let panel: BrowserWindow | undefined;
let platform: WindowsPlatform | undefined;
const abort = new AbortController();
process.on('SIGINT', () => abort.abort());
let generation = 0;
let shown: { fixture: VisualCase; layout: Layout; generation: number; deadline: PresentationDeadline } | undefined;
let accepted: { geometry: PresentationGeometry; captures: number } | undefined;

const nextPaint = (): Promise<void> => panel!.webContents.executeJavaScript('new Promise(resolve => { requestAnimationFrame(() => resolve()); })');

async function showFixture(fixture: VisualCase, layout: Layout): Promise<void> {
  shown = undefined; accepted = undefined;
  const deadline = new PresentationDeadline(abort.signal), currentGeneration = ++generation;
  if (!panel) {
    const display = screen.getPrimaryDisplay();
    panel = new BrowserWindow({ ...display.bounds, show: false, frame: false, fullscreen: true, backgroundColor: '#edf2f8',
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, partition: 'sc-synthetic-lab-memory', devTools: false } });
    panel.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    panel.webContents.session.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !details.url.startsWith('data:') && details.url !== 'about:blank' }));
    panel.on('closed', () => { panel = undefined; abort.abort(); });
  }
  const window = panel;
  await deadline.step(() => window.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(fixtureHtml(fixture, layout))));
  panel.show(); panel.focus(); panel.webContents.focus();
  await deadline.step(() => window.webContents.executeJavaScript(`document.documentElement.dataset.scLabGeneration = '${currentGeneration}'`));
  await deadline.step(() => window.webContents.executeJavaScript('new Promise(resolve => { requestAnimationFrame(() => { requestAnimationFrame(() => resolve(true)); }); })'));
  const fits: boolean = await deadline.step(() => window.webContents.executeJavaScript(`(() => {
    const elements = [...document.querySelectorAll('.question'), document.querySelector('footer')];
    return document.querySelectorAll('.question').length === ${fixture.questions.length} && elements.every(element => {
      if (!element) return false;
      const r = element.getBoundingClientRect(); return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
    });
  })()`));
  if (!fits) throw new PresentationError('Geometry');
  shown = { fixture, layout, generation: currentGeneration, deadline };
}

function nativeGeometry(): Omit<PresentationGeometry, 'generation' | 'current' | 'layoutFits' | 'viewport' | 'questions'> & { displayScale: number; zoom: number } {
  if (!panel || !platform || panel.isDestroyed() || panel.webContents.isDestroyed()) throw new PresentationError('Unavailable');
  if (!panel.isFocused() || !panel.isVisible() || panel.isMinimized()) throw new PresentationError('Focus');
  const display = screen.getDisplayMatching(panel.getBounds());
  return { focused: true, monitor: platform.activeMonitor(), windowMonitor: platform.monitorForWindow(panel.getNativeWindowHandle()),
    displayPixels: screen.dipToScreenRect(panel, display.bounds), displayDip: display.bounds, contentDip: panel.getContentBounds(),
    displayScale: display.scaleFactor, zoom: panel.webContents.getZoomFactor() };
}
async function presentationGeometry(): Promise<PresentationGeometry> {
  if (!shown || !panel) throw new PresentationError('Unavailable');
  const expected = shown;
  const before = nativeGeometry();
  const state: { generation: number; current: boolean; layoutFits: boolean; questions: PixelBounds[];
    viewport: Omit<PresentationGeometry['viewport'], 'displayScale' | 'zoom'> } = await panel.webContents.executeJavaScript(`(() => {
      const expected = ${JSON.stringify({ id: expected.fixture.id, layout: expected.layout, questions: expected.fixture.questions.map(item => ({
        id: item.id, text: item.text, code: item.code ?? '', options: item.options ?? [], diagram: !!item.diagram })) })};
      const questions = [...document.querySelectorAll('.question')];
      const rect = element => { const r = element.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; };
      const fits = element => { if (!element) return false; const r = rect(element); return r.x >= 0 && r.y >= 0 && r.x+r.width <= innerWidth && r.y+r.height <= innerHeight; };
      return { generation: Number(document.documentElement.dataset.scLabGeneration),
        current: document.readyState === 'complete' && document.fonts.status === 'loaded' &&
          document.body.classList.contains('case-' + expected.id) && document.body.classList.contains(expected.layout) &&
          questions.length === expected.questions.length && questions.every((element, i) => {
            const q = expected.questions[i], options = [...element.querySelectorAll('.option')];
            return element.dataset.question === q.id && element.querySelector('h2')?.textContent === q.text &&
              (element.querySelector('code')?.textContent ?? '') === q.code && !!element.querySelector('svg.diagram') === q.diagram &&
              options.length === q.options.length && options.every((option, j) => option.textContent.trim() === String.fromCharCode(65+j)+'. '+q.options[j]);
          }),
        layoutFits: [...questions, document.querySelector('footer')].every(fits), questions: questions.map(rect),
        viewport: {width:innerWidth,height:innerHeight,deviceScale:devicePixelRatio,visualScale:visualViewport?.scale ?? 0,
          scrollX:scrollX+(visualViewport?.offsetLeft ?? 0),scrollY:scrollY+(visualViewport?.offsetTop ?? 0)} };
    })()`);
  const after = nativeGeometry();
  if (shown !== expected || JSON.stringify(before) !== JSON.stringify(after)) throw new PresentationError('Geometry');
  return { ...after, ...state, viewport: { ...state.viewport, displayScale: after.displayScale, zoom: after.zoom } };
}

function imageBitmap(image: NativeImage, expected?: PixelBounds): Bitmap {
  if (image.isEmpty()) throw new PresentationError('Bitmap');
  // Choose an existing representation with the exact physical size; never resize a renderer reference.
  const factor = image.getScaleFactors().find(scale => {
    const size = image.getSize(scale); return !expected || size.width === expected.width && size.height === expected.height;
  });
  if (factor === undefined) throw new PresentationError('Geometry');
  const size = image.getSize(factor), bytes = image.toBitmap({ scaleFactor: factor });
  try { return bitmap(bytes, size.width, size.height); }
  catch (error) { bytes.fill(0); throw error; }
  // NativeImage has no explicit destroy API. Its wrapper stays local; owned bitmap copies are always zeroed by the gate.
}
async function capture(): Promise<CapturedFrame> {
  accepted = undefined;
  if (!shown || !panel || !platform) throw new PresentationError('Unavailable');
  const expected = shown, window = panel, native = platform;
  const ready = await waitForNativePresentation({ geometry: presentationGeometry,
    async reference() { return imageBitmap(await window.webContents.capturePage(), nativeGeometry().monitor); },
    capture: bounds => native.captureMonitor(bounds), decode: jpeg => imageBitmap(nativeImage.createFromBuffer(jpeg)), nextPaint
  }, { generation: expected.generation, questionCount: expected.fixture.questions.length, signal: abort.signal, deadline: expected.deadline });
  accepted = { geometry: ready.geometry, captures: ready.captures };
  return ready.frame;
}
async function validateAcceptedPresentation(): Promise<void> {
  try {
    if (!shown || !accepted) throw new PresentationError('Unavailable');
    const expected = accepted.geometry;
    const geometry = await new PresentationDeadline(abort.signal).step(presentationGeometry);
    questionPixels(geometry, shown.generation, shown.fixture.questions.length);
    if (JSON.stringify(expected) !== JSON.stringify(geometry)) throw new PresentationError('Geometry');
  } catch (error) {
    const failure = error instanceof PresentationError ? error : new PresentationError('Unavailable');
    abort.abort(failure); throw failure;
  }
}
function validateNativeSendTarget(): void {
  try {
    abort.signal.throwIfAborted();
    if (!accepted) throw new PresentationError('Unavailable');
    const current = nativeGeometry(), expected = accepted.geometry;
    if (!sameBounds(current.monitor, expected.monitor) || !sameBounds(current.windowMonitor, expected.windowMonitor) ||
        !sameBounds(current.displayPixels, expected.displayPixels) || !sameBounds(current.contentDip, expected.contentDip) ||
        !sameBounds(current.displayDip, expected.displayDip) || current.zoom !== expected.viewport.zoom || current.displayScale !== expected.viewport.displayScale)
      throw new PresentationError('Geometry');
  } catch (error) {
    const failure = error instanceof PresentationError ? error : new PresentationError('Unavailable');
    abort.abort(failure); throw failure;
  }
}
async function windowsVerification(): Promise<void> {
  let checks = 0;
  for (const fixture of CAPTURE_CASES) for (const layout of LAYOUTS) {
    await showFixture(fixture, layout);
    const frame = await capture();
    let crop: Buffer | undefined;
    try {
      // Question rect is measured from the actual renderer, converted to native normalized capture coordinates.
      const region = await panel!.webContents.executeJavaScript(`(() => { const r = document.querySelector('.question').getBoundingClientRect(); return {x:r.x/innerWidth,y:r.y/innerHeight,width:r.width/innerWidth,height:r.height/innerHeight}; })()`);
      crop = await platform!.crop(frame.jpeg, region);
      const image = imageBitmap(nativeImage.createFromBuffer(crop));
      try {
        if (crop[0] !== 0xff || crop[1] !== 0xd8 || image.width >= frame.bounds.width) throw new PresentationError('Bitmap');
      } finally { image.bytes.fill(0); }
      ++checks;
      console.log(JSON.stringify({ runId: `windows-${fixture.id}-${layout}`, status: 'passed', nativeCapture: true, nativeCrop: true,
        layoutFits: true, pixelReady: true, readinessCaptures: accepted!.captures, questionsChecked: fixture.questions.length, checks }));
    } finally { frame.jpeg.fill(0); crop?.fill(0); }
  }
  console.log(JSON.stringify({ status: 'passed', checks, actualSends: 0, recorderVerified: false }));
}
/** Renderer coordinates are used only in memory to grade actual production visual crops. */
async function requiredVisuals(): Promise<RequiredVisual[]> {
  if (!shown || !panel || !accepted) throw new PresentationError('Unavailable');
  const result: RequiredVisual[] = await panel.webContents.executeJavaScript(`(() => {
    const rect = element => { const r = element.getBoundingClientRect(); return {x:r.x/innerWidth,y:r.y/innerHeight,width:r.width/innerWidth,height:r.height/innerHeight}; };
    return [...document.querySelectorAll('svg.diagram')].map(svg => ({diagram:rect(svg.querySelector('[data-required-diagram]')),
      labels:[...svg.querySelectorAll('[data-required-label]')].map(rect)}));
  })()`);
  await validateAcceptedPresentation();
  return result;
}
async function liveCampaign(): Promise<boolean> {
  const options = liveOptions(args);
  requireCandidate(process.env.SC_LAB_CANDIDATE ?? '', options.candidate);
  const validateCandidateSources = async (): Promise<void> => {
    try { requireCandidate(await sourceIdentity(join(process.env.SC_LAB_PROJECT_ROOT!, 'desktop')), process.env.SC_LAB_SOURCE_IDENTITY); }
    catch { abort.abort(); throw new CampaignExecutionError('scope'); }
  };
  await validateCandidateSources();
  const registry = liveRegistry(process.env.LOCALAPPDATA);
  await privateDestinations(process.env.SC_LAB_PROJECT_ROOT!, registry, join(dirname(registry), 'ledger.jsonl'));
  await privateDestinations(process.env.SC_LAB_PROJECT_ROOT!, join(dirname(registry), 'ledger.jsonl'), join(dirname(registry), 'results.jsonl'));
  const ledger = await CampaignLedger.open(registry, { candidate: options.candidate, phase: options.phase });
  let results: MetadataResults | undefined;
  let frame: CapturedFrame | undefined;
  let frameId = '';
  const credentials: { apiKey?: string } = {};
  try {
    results = await MetadataResults.open(ledger.resultsPath);
    ledger.reconcile(results.records);
    const continuity = new CampaignContinuity(ledger, results);
    const selected = phaseRuns(options.phase).filter(run => !options.only || options.only.includes(run.id));
    await executeCampaign({ selected, fullCampaign: options.only === null, repeat: options.repeat, ledger, signal: abort.signal,
      async execute(run, attempt) {
        await continuity.verify();
        await validateCandidateSources();
        if (run.caseId && frameId !== `${run.caseId}-${run.layout}`) {
          frame?.jpeg.fill(0); frame = undefined;
          await showFixture(visualCase(run.caseId), run.layout);
          frame = await capture(); frameId = `${run.caseId}-${run.layout}`;
        }
        if (run.caseId) await validateAcceptedPresentation();
        const required = run.caseId ? await requiredVisuals() : undefined;
        if (!credentials.apiKey) credentials.apiKey = await readNormalDeepSeekKey(platform!);
        return measureRun({ run, attempt, requiredVisuals: required, ledger: { identity: ledger.identity, async reserve(...reservation) {
          // Validate before a paid reservation, and again after its asynchronous durable write.
          await validateCandidateSources();
          if (run.caseId) await validateAcceptedPresentation();
          abort.signal.throwIfAborted();
          const result = await continuity.reserve(...reservation);
          await validateCandidateSources();
          if (run.caseId) validateNativeSendTarget();
          await continuity.verify();
          abort.signal.throwIfAborted(); return result;
        } }, transport: { async send(request, signal) {
          await validateCandidateSources();
          if (run.caseId) validateNativeSendTarget();
          await continuity.verify();
          signal?.throwIfAborted(); return platform!.send(request, signal);
        } }, cropper: platform!,
          jpeg: frame?.jpeg ?? Buffer.alloc(0), apiKey: credentials.apiKey!, signal: abort.signal });
      }, async record(metadata) { await continuity.verify(); await results!.append(metadata); } });
    const passed = selected.every(run => ledger.latestStatus(run.id) === 'passed');
    console.log(JSON.stringify({ status: passed ? 'passed' : 'failed', cumulativeCalls: ledger.count, remainingCalls: ledger.remaining,
      selectedRuns: selected.length, candidate: ledger.identity.candidate, phase: ledger.identity.phase,
      scopeComplete: ledger.qualificationPassed() }));
    return passed;
  } finally { delete credentials.apiKey; frame?.jpeg.fill(0); try { await results?.close(); } finally { await ledger.close(); } }
}
async function main(): Promise<void> {
  let exitCode = 0;
  try {
    await fs.access(temporary!);
    await app.whenReady();
    if (args[0] === '--preview') {
      const id = args[1] ?? 'diagram', layout = args[2] ?? 'proctoring';
      if (args.length > 3 || !ALL_CASES.some(item => item.id === id) || !LAYOUTS.includes(layout as Layout)) throw new Error('Invalid preview selection.');
      await showFixture(visualCase(id), layout as Layout);
      console.log(JSON.stringify({ status: 'preview', actualSends: 0, recorderVerified: false }));
      await once(panel!, 'closed');
    } else {
      platform = createWindowsPlatform({ nativePath: process.env.SC_LAB_NATIVE_PATH });
      if (args.length === 1 && args[0] === '--windows') await windowsVerification();
      else if (args.includes('--live')) { if (!await liveCampaign()) exitCode = 1; }
      else throw new Error('Explicit Windows lab mode is required.');
    }
  } catch (error) {
    console.error(JSON.stringify({ status: 'failed', stage: error instanceof PresentationError ? 'Presentation' :
      error instanceof CampaignExecutionError && error.code === 'preflight-required' ? 'Preflight' : 'Harness',
      ...(error instanceof PresentationError ? { code: error.code } : {}), contentPersisted: false })); exitCode = 1;
  } finally { abort.abort(); panel?.destroy(); platform?.dispose(); app.exit(exitCode); }
}
void main();
