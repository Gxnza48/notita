mod commands;
mod db;
mod models;
mod voice;

use commands::AppState;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{Manager, WindowEvent};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

fn quick_capture_shortcut() -> Shortcut {
    Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::Space)
}

fn toggle_quick_capture(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("quick-capture") {
        let visible = win.is_visible().unwrap_or(false);
        if visible {
            let _ = win.hide();
        } else {
            let _ = win.center();
            let _ = win.show();
            let _ = win.set_focus();
        }
    }
}

fn close_to_tray_enabled(app: &tauri::AppHandle) -> bool {
    let Some(state) = app.try_state::<AppState>() else {
        return true;
    };
    let Ok(conn) = state.pool.get() else {
        return true;
    };
    let value: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'behavior.closeToTray'",
            [],
            |row| row.get(0),
        )
        .ok();
    value.map(|v| v != "false").unwrap_or(true)
}

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // A second launch attempt (e.g. double-clicking the shortcut again)
            // just focuses the existing window instead of spawning a new
            // process/tray icon.
            show_main_window(app);
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state() == ShortcutState::Pressed && shortcut == &quick_capture_shortcut() {
                        toggle_quick_capture(app);
                    }
                })
                .build(),
        );

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir().expect("no app data dir");
            let pool = db::init_pool(&app_data_dir);
            app.manage(AppState { pool });
            app.manage(voice::VoiceState::default());

            let global_shortcut = app.global_shortcut();
            if let Err(e) = global_shortcut.register(quick_capture_shortcut()) {
                eprintln!("failed to register quick capture shortcut: {e}");
            }

            let open_item = MenuItem::with_id(app, "open", "Open notita", true, None::<&str>)?;
            let capture_item =
                MenuItem::with_id(app, "capture", "Quick Capture", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let tray_menu = Menu::with_items(
                app,
                &[&open_item, &capture_item, &separator, &quit_item],
            )?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => show_main_window(app),
                    "capture" => toggle_quick_capture(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        button_state: tauri::tray::MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                })
                .build(app)?;

            if let Some(main) = app.get_webview_window("main") {
                let handle = app.handle().clone();
                main.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        if close_to_tray_enabled(&handle) {
                            if let Some(win) = handle.get_webview_window("main") {
                                let _ = win.hide();
                            }
                            api.prevent_close();
                        }
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_subjects,
            commands::create_subject,
            commands::rename_subject,
            commands::delete_subject,
            commands::get_subject_overview,
            commands::list_recent_notes,
            commands::list_notes_by_subject,
            commands::get_note,
            commands::create_note,
            commands::rename_note,
            commands::duplicate_note,
            commands::save_note,
            commands::delete_note,
            commands::toggle_pinned,
            commands::search_notes,
            commands::get_setting,
            commands::set_setting,
            commands::record_wpm_sample,
            commands::get_best_wpm,
            commands::get_session_stats,
            commands::export_text_file,
            commands::set_window_theme,
            commands::log_client_error,
            voice::get_voice_model_status,
            voice::download_voice_model,
            voice::warm_up_voice_model,
            voice::start_voice_recording,
            voice::stop_voice_recording,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
