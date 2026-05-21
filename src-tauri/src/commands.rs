use crate::AppState;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Debug, Serialize, Deserialize)]
pub struct AppSettingsResponse {
    pub r#type: String,
    pub data: Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LocalServerInfo {
    pub port: u16,
    pub token: String,
}

#[tauri::command]
pub fn get_app_settings(
    settings_type: String,
    state: State<AppState>,
) -> AppSettingsResponse {
    let settings = state.settings.lock().unwrap();
    AppSettingsResponse {
        r#type: settings_type.clone(),
        data: settings.all_serialized(),
    }
}

#[tauri::command]
pub fn update_app_settings(
    settings_type: String,
    data: Value,
    state: State<AppState>,
) {
    let mut settings = state.settings.lock().unwrap();
    if let Some(obj) = data.as_object() {
        settings.set(obj.clone());
    }
    let _ = settings_type;
}

#[tauri::command]
pub fn initial_app_settings(
    settings_type: String,
    data: Value,
    state: State<AppState>,
) {
    let mut settings = state.settings.lock().unwrap();
    if let Some(obj) = data.as_object() {
        settings.set(obj.clone());
    }
    let _ = settings_type;
}

#[tauri::command]
pub async fn start_local_server(
    state: State<'_, AppState>,
    _app: AppHandle,
) -> Result<LocalServerInfo, String> {
    {
        let port_guard = state.local_server_port.lock().unwrap();
        let token_guard = state.local_server_token.lock().unwrap();
        if let (Some(port), Some(token)) = (*port_guard, token_guard.clone()) {
            return Ok(LocalServerInfo { port, token });
        }
    }

    let port = crate::server::find_free_port(45569)?;
    let token = generate_token();

    {
        let mut port_guard = state.local_server_port.lock().unwrap();
        let mut token_guard = state.local_server_token.lock().unwrap();
        *port_guard = Some(port);
        *token_guard = Some(token.clone());
    }

    Ok(LocalServerInfo { port, token })
}

#[tauri::command]
pub async fn get_dnd() -> bool {
    false
}

#[tauri::command]
pub async fn detect_language(sample: String) -> Option<String> {
    use whatlang::detect;
    detect(&sample).map(|info| info.lang().code().to_string())
}

#[tauri::command]
pub async fn download_file(
    _url: Option<String>,
    _content: Option<String>,
    _file_options: Option<Value>,
    _app: AppHandle,
) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub async fn download_folder_select(app: AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let result = app.dialog().file().blocking_pick_folder();
    Ok(result.map(|p| p.to_string()))
}

#[tauri::command]
pub fn clear_storage_data(
    _service_id: Option<String>,
    _targets_to_clear: Option<Value>,
) {
    // No-op: Tauri manages cache at the OS WebView level
}

#[tauri::command]
pub fn clear_cache(_service_id: Option<String>) {
    // No-op: Tauri manages cache at the OS WebView level
}

#[tauri::command]
pub fn update_app_indicator(_indicator: Value, _app: AppHandle) {
    // Update badge count / tray indicator
}

#[tauri::command]
pub fn open_process_manager() {
    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("sh")
            .arg("-c")
            .arg("gnome-system-monitor || xterm -e top &")
            .spawn();
    }
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open")
            .arg("-a")
            .arg("Activity Monitor")
            .spawn();
    }
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("taskmgr").spawn();
    }
}

#[tauri::command]
pub fn basic_auth_credentials(user: String, password: String, app: AppHandle) {
    let _ = app.emit(
        "basic-auth-response",
        serde_json::json!({ "user": user, "password": password }),
    );
}

#[tauri::command]
pub fn basic_auth_cancel(app: AppHandle) {
    let _ = app.emit("basic-auth-response", serde_json::json!(null));
}

#[tauri::command]
pub fn open_browser_window(
    url: String,
    _service_id: Option<String>,
    app: AppHandle,
) -> Result<(), String> {
    use tauri_plugin_shell::ShellExt;
    app.shell().open(&url, None).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn toggle_window_maximized(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_maximized().unwrap_or(false) {
            let _ = window.unmaximize();
        } else {
            let _ = window.maximize();
        }
    }
}

#[tauri::command]
pub fn get_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

#[tauri::command]
pub fn get_locale() -> String {
    std::env::var("LANG")
        .unwrap_or_else(|_| "en-US".to_string())
        .replace('_', "-")
        .split('.')
        .next()
        .unwrap_or("en-US")
        .to_string()
}

#[tauri::command]
pub async fn relaunch_app(app: AppHandle) -> Result<(), String> {
    app.restart();
}

#[tauri::command]
pub fn get_translation_cache() -> Value {
    serde_json::json!({})
}

#[tauri::command]
pub fn set_auto_launch(enabled: bool, app: AppHandle) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;
    let autostart = app.autolaunch();
    if enabled {
        autostart.enable().map_err(|e| e.to_string())
    } else {
        autostart.disable().map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn update_dbus_unread(
    _direct: u32,
    _indirect: u32,
    _unread_services: Value,
) {
    // On platforms with D-Bus support this would update the taskbar badge via
    // the com.canonical.Unity.LauncherEntry D-Bus API.  For now this is a
    // no-op stub that correctly accepts the typed arguments sent from the
    // frontend so that Tauri's argument deserialization succeeds.
}

fn generate_token() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let bytes: [u8; 16] = rng.gen();
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}
