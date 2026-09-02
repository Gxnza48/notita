use std::io::Write;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use tauri::{AppHandle, Emitter, Manager};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

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

fn transcribe(ctx: &WhisperContext, samples: &[f32], language: &str) -> Result<String, String> {
    let mut state = ctx.create_state().map_err(|e| e.to_string())?;
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

fn flush_segment(segment: &mut Vec<f32>, ctx: &WhisperContext, app: &AppHandle, input_rate: u32, language: &str) {
    if segment.is_empty() {
        return;
    }
    let sample_count = segment.len();
    let resampled = resample_to_16k(segment, input_rate);
    segment.clear();
    match transcribe(ctx, &resampled, language) {
        Ok(text) if !text.is_empty() => {
            log_voice(app, &format!("segment ({sample_count} samples) -> \"{text}\""));
            let _ = app.emit("voice-segment", VoiceSegment { text });
        }
        Ok(_) => {
            log_voice(app, &format!("segment ({sample_count} samples) -> empty transcription"));
        }
        Err(e) => {
            log_voice(app, &format!("transcription error: {e}"));
        }
    }
}

/// Buffers incoming audio, treats a pause after speech as a sentence
/// boundary, and transcribes each completed segment — this reads as
/// "real-time" for dictation without needing true streaming inference,
/// which whisper.cpp isn't built for.
fn run_processing_loop(
    rx: std::sync::mpsc::Receiver<Vec<f32>>,
    stop_flag: Arc<AtomicBool>,
    ctx: Arc<WhisperContext>,
    app: AppHandle,
    input_rate: u32,
    language: String,
) {
    const SILENCE_RMS: f32 = 0.012;
    const SILENCE_HOLD_MS: u128 = 350;
    const MIN_SEGMENT_MS: u128 = 300;
    const MAX_SEGMENT_MS: u128 = 3500;
    const NO_AUDIO_HINT_MS: u128 = 6000;

    let mut segment: Vec<f32> = Vec::new();
    let mut speaking = false;
    let mut silence_since: Option<std::time::Instant> = None;
    let mut segment_started: Option<std::time::Instant> = None;
    let recording_started = std::time::Instant::now();
    let mut ever_spoke = false;
    let mut hinted_no_audio = false;
    let mut peak_rms_seen: f32 = 0.0;

    loop {
        if stop_flag.load(Ordering::Relaxed) {
            break;
        }
        match rx.recv_timeout(std::time::Duration::from_millis(200)) {
            Ok(chunk) => {
                let rms = rms_of(&chunk);
                if rms > peak_rms_seen {
                    peak_rms_seen = rms;
                }
                segment.extend_from_slice(&chunk);
                if segment_started.is_none() {
                    segment_started = Some(std::time::Instant::now());
                }

                if rms > SILENCE_RMS {
                    speaking = true;
                    ever_spoke = true;
                    silence_since = None;
                } else if speaking && silence_since.is_none() {
                    silence_since = Some(std::time::Instant::now());
                }

                let segment_ms = segment_started.map(|s| s.elapsed().as_millis()).unwrap_or(0);
                let silence_ms = silence_since.map(|s| s.elapsed().as_millis()).unwrap_or(0);

                let should_flush = speaking
                    && segment_ms > MIN_SEGMENT_MS
                    && (silence_ms > SILENCE_HOLD_MS || segment_ms > MAX_SEGMENT_MS);

                if should_flush {
                    flush_segment(&mut segment, &ctx, &app, input_rate, &language);
                    speaking = false;
                    silence_since = None;
                    segment_started = None;
                }
            }
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {}
            Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => break,
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

    if speaking {
        flush_segment(&mut segment, &ctx, &app, input_rate, &language);
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
