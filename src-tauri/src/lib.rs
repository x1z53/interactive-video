use std::sync::Mutex;
use tauri::Manager;

#[tauri::command]
fn get_app_dir(app_handle: tauri::AppHandle) -> Result<String, String> {
    let path = app_handle
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn get_player_project(state: tauri::State<AppState>) -> Option<String> {
    state.player_project.lock().unwrap().clone()
}

#[tauri::command]
fn get_current_exe() -> Result<String, String> {
    std::env::current_exe()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

pub struct AppState {
    player_project: Mutex<Option<String>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let args: Vec<String> = std::env::args().collect();
    let player_project = args.get(1).cloned();

    tauri::Builder::default()
        .manage(AppState {
            player_project: Mutex::new(player_project),
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![get_app_dir, get_player_project, get_current_exe])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
