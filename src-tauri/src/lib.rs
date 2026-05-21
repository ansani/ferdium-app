use std::sync::Mutex;
use tauri::{Emitter, Manager};
use tauri_plugin_deep_link::DeepLinkExt;

mod commands;
mod server;
mod settings;

pub use settings::Settings;

pub struct AppState {
    pub settings: Mutex<Settings>,
    pub local_server_port: Mutex<Option<u16>>,
    pub local_server_token: Mutex<Option<String>>,
}

pub fn run() {
    let settings = Settings::new("app").unwrap_or_default();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
            if let Some(url) = argv.get(1) {
                let _ = app.emit("navigateFromDeepLink", serde_json::json!({ "url": url }));
            }
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            settings: Mutex::new(settings),
            local_server_port: Mutex::new(None),
            local_server_token: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_app_settings,
            commands::update_app_settings,
            commands::initial_app_settings,
            commands::start_local_server,
            commands::get_dnd,
            commands::detect_language,
            commands::download_file,
            commands::download_folder_select,
            commands::clear_storage_data,
            commands::clear_cache,
            commands::update_app_indicator,
            commands::open_process_manager,
            commands::basic_auth_credentials,
            commands::basic_auth_cancel,
            commands::open_browser_window,
            commands::toggle_window_maximized,
            commands::get_version,
            commands::get_locale,
            commands::relaunch_app,
            commands::get_translation_cache,
            commands::set_auto_launch,
            commands::update_dbus_unread,
        ])
        .setup(|app| {
            let app_handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                for url in event.urls() {
                    let _ = app_handle
                        .emit("navigateFromDeepLink", serde_json::json!({ "url": url.to_string() }));
                }
            });

            if let Some(window) = app.get_webview_window("main") {
                let app_handle2 = app.handle().clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::Focused(focused) = event {
                        let _ = app_handle2.emit("isWindowFocused", focused);
                    }
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
