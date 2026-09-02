use std::collections::VecDeque;
use std::io::Write;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use tauri::{AppHandle, Emitter, Manager};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters, WhisperState};

const MODEL_URL: &str = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin";
const MODEL_FILE_NAME: &str = "ggml-base.bin";
const WHISPER_SAMPLE_RATE: u32 = 16000;

/// `cpal::Stream` is deliberately `!Send` (thread-affinity on some audio
/// backends), so it can never live in shared Tauri-managed state. Only the
/// stop flag — which is `Send + Sync` — is shared; the stream itself is
/// created, played, and dropped entirely within the thread spawned by
/// `start_voice_recording`.
pub struct VoiceState {
    context: Mutex<Option<Arc<WhisperContext>>>,
    stop_flag: Mutex<Option<Arc<AtomicBool>>>,
}

impl Default for VoiceState {
    fn default() -> Self {
        Self {
            context: Mutex::new(None),
            stop_flag: Mutex::new(None),
        }
    }
}

/// Release builds have no console (`windows_subsystem = "windows"`), so
/// `eprintln!` output is silently discarded. This is the only way voice
/// pipeline issues (wrong input device, stream errors, transcription
/// failures) are diagnosable after the fact.
fn log_voice(app: &AppHandle, message: &str) {
    let Ok(dir) = app.path().app_data_dir() else { return };
    if std::fs::create_dir_all(&dir).is_err() {
        return;
    }
    if let Ok(mut file) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(dir.join("voice-debug.log"))
    {
        let _ = writeln!(file, "[{}] {}", now_ms(), message);
    }
}

fn now_ms() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

fn model_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("models");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn model_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(model_dir(app)?.join(MODEL_FILE_NAME))
}

#[derive(serde::Serialize, Clone)]
pub struct VoiceModelStatus {
    pub ready: bool,
}

#[tauri::command]
pub fn get_voice_model_status(app: AppHandle) -> Result<VoiceModelStatus, String> {
    Ok(VoiceModelStatus {
        ready: model_path(&app)?.exists(),
    })
}

#[derive(serde::Serialize, Clone)]
struct ModelProgress {
    downloaded: u64,
    total: u64,
}

/// Removes model files left behind by a previous default (e.g. switching
/// from the "small" to the "base" model shouldn't leave a stale ~466 MB
/// blob sitting in the user's app data directory forever).
fn cleanup_stale_models(app: &AppHandle) {
    let Ok(dir) = model_dir(app) else { return };
    let Ok(entries) = std::fs::read_dir(&dir) else { return };
    for entry in entries.flatten() {
        let name = entry.file_name();
        let Some(name) = name.to_str() else { continue };
        if name != MODEL_FILE_NAME && name.starts_with("ggml-") && name.ends_with(".bin") {
            let _ = std::fs::remove_file(entry.path());
        }
    }
}

#[tauri::command]
pub async fn download_voice_model(app: AppHandle) -> Result<(), String> {
    cleanup_stale_models(&app);
    let final_path = model_path(&app)?;
    if final_path.exists() {
        return Ok(());
    }
    let part_path = final_path.with_extension("part");

    let mut response = reqwest::get(MODEL_URL).await.map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!("download failed: HTTP {}", response.status()));
    }
    let total = response.content_length().unwrap_or(0);

    let mut file = std::fs::File::create(&part_path).map_err(|e| e.to_string())?;
    let mut downloaded: u64 = 0;
    let mut last_emit = std::time::Instant::now();

    while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;
        if last_emit.elapsed().as_millis() > 150 {
            let _ = app.emit("voice-model-progress", ModelProgress { downloaded, total });
            last_emit = std::time::Instant::now();
        }
    }
    let _ = app.emit("voice-model-progress", ModelProgress { downloaded, total });
    drop(file);
    std::fs::rename(&part_path, &final_path).map_err(|e| e.to_string())?;
    Ok(())
}

fn ensure_context(app: &AppHandle, state: &VoiceState) -> Result<Arc<WhisperContext>, String> {
    let mut guard = state
        .context
        .lock()
        .map_err(|_| "voice state poisoned".to_string())?;
    if let Some(ctx) = guard.as_ref() {
        return Ok(ctx.clone());
    }
    let path = model_path(app)?;
    if !path.exists() {
        return Err("voice model not downloaded".to_string());
    }
    let ctx = WhisperContext::new_with_params(
        path.to_str().ok_or("invalid model path")?,
        WhisperContextParameters::default(),
    )
    .map_err(|e| e.to_string())?;
    let ctx = Arc::new(ctx);
    *guard = Some(ctx.clone());
    Ok(ctx)
}

#[tauri::command]
pub fn warm_up_voice_model(app: AppHandle, state: tauri::State<VoiceState>) -> Result<(), String> {
    ensure_context(&app, &state)?;
    Ok(())
}

fn resample_to_16k(input: &[f32], input_rate: u32) -> Vec<f32> {
    if input_rate == WHISPER_SAMPLE_RATE {
        return input.to_vec();
    }
    let ratio = WHISPER_SAMPLE_RATE as f64 / input_rate as f64;
    let out_len = (input.len() as f64 * ratio).round() as usize;
    let mut out = Vec::with_capacity(out_len);
    for i in 0..out_len {
        let src_pos = i as f64 / ratio;
        let idx = src_pos.floor() as usize;
        let frac = (src_pos - idx as f64) as f32;
        let a = *input.get(idx).unwrap_or(&0.0);
        let b = *input.get(idx + 1).unwrap_or(&a);
        out.push(a + (b - a) * frac);
    }
    out
}

fn to_mono(data: &[f32], channels: usize) -> Vec<f32> {
    if channels <= 1 {
        return data.to_vec();
    }
    data.chunks(channels)
        .map(|frame| frame.iter().sum::<f32>() / channels as f32)
        .collect()
}

fn rms_of(samples: &[f32]) -> f32 {
    if samples.is_empty() {
        return 0.0;
    }
    let sum_sq: f32 = samples.iter().map(|s| s * s).sum();
    (sum_sq / samples.len() as f32).sqrt()
}

fn transcribe_with_state(state: &mut WhisperState, samples: &[f32], language: &str) -> Result<String, String> {
    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    if language != "auto" {
        params.set_language(Some(language));
    }
    params.set_translate(false);
    params.set_print_progress(false);
    params.set_print_special(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);
    params.set_no_context(true);
    params.set_single_segment(true);
    params.set_n_threads(
        std::thread::available_parallelism()
            .map(|n| n.get() as i32)
            .unwrap_or(4)
            .clamp(1, 8),
    );

    state.full(params, samples).map_err(|e| e.to_string())?;

    let num_segments = state.full_n_segments();
    let mut text = String::new();
    for i in 0..num_segments {
        if let Some(segment) = state.get_segment(i) {
            if let Ok(segment_text) = segment.to_str_lossy() {
                text.push_str(segment_text.trim());
                text.push(' ');
            }
        }
    }
    Ok(text.trim().to_string())
}

#[derive(serde::Serialize, Clone)]
struct VoiceSegment {
    text: String,
}

/// Runs one Whisper inference over `window_raw` (native-rate mono audio,
/// resampled to 16kHz here) on the shared, reused `WhisperState`, and logs
/// audio duration / wall time / RTF (real-time factor: >1 means Whisper is
/// slower than real time on this machine) plus how many extra mpsc chunks
/// were drained alongside it, so a persistently slow model is diagnosable
/// from voice-debug.log instead of guessed at.
fn infer_window(
    state: &mut WhisperState,
    window_raw: &[f32],
    input_rate: u32,
    language: &str,
    app: &AppHandle,
    kind: &str,
    backlog_chunks: usize,
) -> String {
    if window_raw.is_empty() {
        return String::new();
    }
    let audio_ms = (window_raw.len() as u128 * 1000) / input_rate as u128;
    let resampled = resample_to_16k(window_raw, input_rate);
    let started = std::time::Instant::now();
    let result = transcribe_with_state(state, &resampled, language);
    let elapsed_ms = started.elapsed().as_millis();
    let rtf = if audio_ms > 0 { elapsed_ms as f32 / audio_ms as f32 } else { 0.0 };
    match result {
        Ok(text) => {
            log_voice(
                app,
                &format!(
                    "{kind}: window={audio_ms}ms infer={elapsed_ms}ms rtf={rtf:.2} backlog_chunks={backlog_chunks} -> \"{text}\""
                ),
            );
            text
        }
        Err(e) => {
            log_voice(app, &format!("{kind}: transcription error after {elapsed_ms}ms: {e}"));
            String::new()
        }
    }
}

/// Composes the display text for a still-open utterance: everything already
/// rolled into `confirmed`, followed by the latest (not-yet-rolled) window
/// transcript. This is what gets sent as `voice-partial` — the frontend
/// replaces its previous partial with this string wholesale, it never
/// concatenates partials itself.
fn compose(confirmed: &str, window_text: &str) -> String {
    let confirmed = confirmed.trim();
    let window_text = window_text.trim();
    if confirmed.is_empty() {
        window_text.to_string()
    } else if window_text.is_empty() {
        confirmed.to_string()
    } else {
        format!("{confirmed} {window_text}")
    }
}

fn push_confirmed(confirmed: &mut String, new_text: &str) {
    let new_text = new_text.trim();
    if new_text.is_empty() {
        return;
    }
    if !confirmed.is_empty() {
        confirmed.push(' ');
    }
    confirmed.push_str(new_text);
}

/// Runs the last inference for the current utterance (whatever's left in
/// `window`, on top of anything already rolled into `soft_confirmed`),
/// emits it as `voice-final`, and resets both — ready for the next
/// utterance with no leftover state.
fn finalize_utterance(
    window: &mut VecDeque<f32>,
    soft_confirmed: &mut String,
    state: &mut WhisperState,
    app: &AppHandle,
    input_rate: u32,
    language: &str,
    backlog_chunks: usize,
) {
    let audio_slice = window.make_contiguous();
    let text = infer_window(state, audio_slice, input_rate, language, app, "final", backlog_chunks);
    let final_text = compose(soft_confirmed, &text);
    window.clear();
    soft_confirmed.clear();
    if !final_text.is_empty() {
        let _ = app.emit("voice-final", VoiceSegment { text: final_text });
    }
    let _ = app.emit("voice-partial", VoiceSegment { text: String::new() });
}

/// Live-dictation pipeline: instead of waiting for a pause to transcribe a
/// whole utterance, Whisper runs periodically (every STEP_MS) over a
/// bounded rolling window of recent audio, so a `voice-partial` preview
/// updates while the user is still talking. When the rolling window fills
/// up (WINDOW_MS), its transcript is folded into `soft_confirmed` and the
/// window resets to a small overlap tail (KEEP_MS) — this keeps every
/// individual Whisper call bounded to a couple of seconds of audio no
/// matter how long the user keeps talking, while `soft_confirmed + latest
/// window` still reads as the full utterance so far. A real pause
/// (SILENCE_HOLD_MS) or a stop request finalizes the utterance as
/// `voice-final` and resets everything for the next one.
///
/// Window/silence/step duration are tracked by SAMPLE COUNT, not
/// wall-clock `Instant`s (see the death-spiral bug fixed in v0.1.6): if
/// transcription ever falls behind real time, sample-based bounds keep
/// every window capped regardless of how large the mpsc backlog gets. The
/// channel itself is drained opportunistically each iteration (see
/// `backlog_chunks`) so processing always works on the freshest audio
/// instead of a queue of stale chunks.
///
/// A single `WhisperState` is created once per recording session here and
/// reused for every inference — `ctx.create_state()` is NOT called per
/// window, matching whisper.cpp's own streaming example. It's dropped when
/// this function returns, so a new recording session always starts clean.
fn run_processing_loop(
    rx: std::sync::mpsc::Receiver<Vec<f32>>,
    stop_flag: Arc<AtomicBool>,
    ctx: Arc<WhisperContext>,
    app: AppHandle,
    input_rate: u32,
    language: String,
) {
    const SILENCE_RMS: f32 = 0.012;
    const SILENCE_HOLD_MS: u128 = 600;
    const WINDOW_MS: u128 = 2200;
    const STEP_MS: u128 = 600;
    const KEEP_MS: u128 = 300;
    const PREROLL_MS: u128 = 250;
    const NO_AUDIO_HINT_MS: u128 = 6000;

    let mut state = match ctx.create_state() {
        Ok(s) => s,
        Err(e) => {
            log_voice(&app, &format!("failed to create whisper state: {e}"));
            let _ = app.emit("voice-error", e.to_string());
            return;
        }
    };

    let ms_to_samples = |ms: u128| -> usize { ((ms * input_rate as u128) / 1000) as usize };

    let window_cap = ms_to_samples(WINDOW_MS).max(1);
    let keep_samples = ms_to_samples(KEEP_MS);
    let preroll_cap = ms_to_samples(PREROLL_MS).max(1);
    let step_samples = ms_to_samples(STEP_MS).max(1);
    let silence_hold_samples = ms_to_samples(SILENCE_HOLD_MS);

    let mut preroll: VecDeque<f32> = VecDeque::with_capacity(preroll_cap);
    let mut window: VecDeque<f32> = VecDeque::new();
    let mut soft_confirmed = String::new();
    let mut speaking = false;
    let mut silence_samples_run: usize = 0;
    let mut since_last_infer: usize = 0;
    let mut last_partial_sent = String::new();

    let recording_started = std::time::Instant::now();
    let mut ever_spoke = false;
    let mut hinted_no_audio = false;
    let mut peak_rms_seen: f32 = 0.0;

    loop {
        if stop_flag.load(Ordering::Relaxed) {
            break;
        }

        let mut batch = match rx.recv_timeout(std::time::Duration::from_millis(200)) {
            Ok(chunk) => chunk,
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => Vec::new(),
            Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => break,
        };

        if !batch.is_empty() {
            // Drain whatever else is already queued so we always act on the
            // freshest audio instead of processing one small chunk at a time
            // while a backlog piles up behind it.
            let mut backlog_chunks = 0usize;
            while let Ok(more) = rx.try_recv() {
                batch.extend(more);
                backlog_chunks += 1;
            }

            let rms = rms_of(&batch);
            if rms > peak_rms_seen {
                peak_rms_seen = rms;
            }

            if rms > SILENCE_RMS {
                if !speaking {
                    speaking = true;
                    ever_spoke = true;
                    window.clear();
                    window.extend(preroll.iter().copied());
                    soft_confirmed.clear();
                    since_last_infer = 0;
                    last_partial_sent.clear();
                }
                silence_samples_run = 0;
            } else if speaking {
                silence_samples_run += batch.len();
            }

            // Update the preroll ring AFTER using it above, so it never
            // double-counts the very batch that just triggered speech onset.
            for &s in &batch {
                if preroll.len() >= preroll_cap {
                    preroll.pop_front();
                }
                preroll.push_back(s);
            }

            if speaking {
                window.extend(batch.iter().copied());
                since_last_infer += batch.len();

                if window.len() > window_cap {
                    let audio_slice = window.make_contiguous();
                    let text = infer_window(&mut state, audio_slice, input_rate, &language, &app, "roll", backlog_chunks);
                    push_confirmed(&mut soft_confirmed, &text);
                    let tail_start = window.len().saturating_sub(keep_samples);
                    window.drain(..tail_start);
                    since_last_infer = 0;
                    if soft_confirmed != last_partial_sent {
                        let _ = app.emit("voice-partial", VoiceSegment { text: soft_confirmed.clone() });
                        last_partial_sent = soft_confirmed.clone();
                    }
                } else if since_last_infer >= step_samples {
                    let audio_slice = window.make_contiguous();
                    let text = infer_window(&mut state, audio_slice, input_rate, &language, &app, "partial", backlog_chunks);
                    since_last_infer = 0;
                    let partial_display = compose(&soft_confirmed, &text);
                    if partial_display != last_partial_sent {
                        let _ = app.emit("voice-partial", VoiceSegment { text: partial_display.clone() });
                        last_partial_sent = partial_display;
                    }
                }

                if silence_samples_run >= silence_hold_samples {
                    finalize_utterance(&mut window, &mut soft_confirmed, &mut state, &app, input_rate, &language, backlog_chunks);
                    speaking = false;
                    silence_samples_run = 0;
                    since_last_infer = 0;
                    last_partial_sent.clear();
                }
            }
        }

        if !hinted_no_audio && !ever_spoke && recording_started.elapsed().as_millis() > NO_AUDIO_HINT_MS {
            hinted_no_audio = true;
            log_voice(
                &app,
                &format!("no audio detected after {NO_AUDIO_HINT_MS}ms (peak RMS so far: {peak_rms_seen:.5})"),
            );
            let _ = app.emit(
                "voice-hint",
                "No audio detected. Check Windows' default microphone in Settings > Sound > Input — a virtual device (e.g. Voicemod) may be selected instead of your real mic.",
            );
        }
    }

    if speaking && (!window.is_empty() || !soft_confirmed.is_empty()) {
        finalize_utterance(&mut window, &mut soft_confirmed, &mut state, &app, input_rate, &language, 0);
    }
    log_voice(
        &app,
        &format!(
            "recording stopped after {}ms, ever_spoke={ever_spoke}, peak RMS={peak_rms_seen:.5}",
            recording_started.elapsed().as_millis()
        ),
    );
}

/// Builds the input stream, plays it, and blocks running the processing
/// loop until `stop_flag` is set — all on the calling (spawned) thread, so
/// the `!Send` `cpal::Stream` never has to cross a thread boundary.
fn record_and_process(
    app: AppHandle,
    ctx: Arc<WhisperContext>,
    stop_flag: Arc<AtomicBool>,
    language: String,
) -> Result<(), String> {
    let host = cpal::default_host();
    let device = host
        .default_input_device()
        .ok_or_else(|| "no microphone found".to_string())?;
    let device_name = device.name().unwrap_or_else(|_| "unknown device".to_string());
    let config = device.default_input_config().map_err(|e| e.to_string())?;
    let sample_rate = config.sample_rate().0;
    let channels = config.channels() as usize;
    let sample_format = config.sample_format();

    log_voice(
        &app,
        &format!(
            "starting recording: device=\"{device_name}\" sample_rate={sample_rate} channels={channels} format={sample_format:?} language={language}"
        ),
    );
    let _ = app.emit(
        "voice-device",
        serde_json::json!({ "name": device_name }),
    );

    let (tx, rx) = std::sync::mpsc::channel::<Vec<f32>>();
    let app_for_err = app.clone();
    let err_fn = move |err: cpal::StreamError| {
        log_voice(&app_for_err, &format!("audio stream error: {err}"));
    };

    let stream = match sample_format {
        cpal::SampleFormat::F32 => device.build_input_stream(
            &config.into(),
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                let _ = tx.send(to_mono(data, channels));
            },
            err_fn,
            None,
        ),
        cpal::SampleFormat::I16 => device.build_input_stream(
            &config.into(),
            move |data: &[i16], _: &cpal::InputCallbackInfo| {
                let floats: Vec<f32> = data.iter().map(|s| *s as f32 / i16::MAX as f32).collect();
                let _ = tx.send(to_mono(&floats, channels));
            },
            err_fn,
            None,
        ),
        cpal::SampleFormat::U16 => device.build_input_stream(
            &config.into(),
            move |data: &[u16], _: &cpal::InputCallbackInfo| {
                let floats: Vec<f32> = data
                    .iter()
                    .map(|s| (*s as f32 - u16::MAX as f32 / 2.0) / (u16::MAX as f32 / 2.0))
                    .collect();
                let _ = tx.send(to_mono(&floats, channels));
            },
            err_fn,
            None,
        ),
        other => return Err(format!("unsupported audio format: {other:?}")),
    }
    .map_err(|e| e.to_string())?;

    stream.play().map_err(|e| e.to_string())?;

    run_processing_loop(rx, stop_flag, ctx, app, sample_rate, language);
    // `stream` drops here, on the same thread that created it.
    Ok(())
}

#[tauri::command]
pub fn start_voice_recording(
    app: AppHandle,
    state: tauri::State<VoiceState>,
    language: String,
) -> Result<(), String> {
    {
        let active = state
            .stop_flag
            .lock()
            .map_err(|_| "voice state poisoned".to_string())?;
        if active.is_some() {
            return Err("already recording".to_string());
        }
    }

    let ctx = ensure_context(&app, &state)?;
    let stop_flag = Arc::new(AtomicBool::new(false));

    {
        let mut guard = state
            .stop_flag
            .lock()
            .map_err(|_| "voice state poisoned".to_string())?;
        *guard = Some(stop_flag.clone());
    }

    let app_for_thread = app.clone();
    std::thread::spawn(move || {
        if let Err(e) = record_and_process(app_for_thread.clone(), ctx, stop_flag, language) {
            log_voice(&app_for_thread, &format!("voice recording error: {e}"));
            let _ = app_for_thread.emit("voice-error", e);
        }
    });

    Ok(())
}

#[tauri::command]
pub fn stop_voice_recording(state: tauri::State<VoiceState>) -> Result<(), String> {
    let mut guard = state
        .stop_flag
        .lock()
        .map_err(|_| "voice state poisoned".to_string())?;
    if let Some(flag) = guard.take() {
        flag.store(true, Ordering::Relaxed);
    }
    Ok(())
}
