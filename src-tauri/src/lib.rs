use serde::Deserialize;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
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
fn launch_yaml_player(app_handle: tauri::AppHandle, yaml_path: String) -> Result<(), String> {
    let yaml_file = PathBuf::from(&yaml_path);
    if !yaml_file.is_file() {
        return Err(format!("YAML file not found: {}", yaml_path));
    }

    let player_script = find_player_script(&app_handle)?;

    Command::new("python3")
        .arg(&player_script)
        .arg(&yaml_file)
        .current_dir(yaml_file.parent().unwrap_or(&yaml_file))
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to launch player: {e}"))?;

    Ok(())
}

#[derive(Deserialize, Clone)]
struct VideoNodeData {
    #[serde(default)]
    label: String,
    #[serde(rename = "videoPath")]
    video_path: String,
    #[serde(default, rename = "videoName")]
    video_name: String,
}

#[derive(Deserialize, Clone)]
struct ProjectNode {
    id: String,
    #[serde(rename = "type")]
    _node_type: String,
    data: VideoNodeData,
}

#[derive(Deserialize, Clone)]
#[allow(dead_code)]
struct ChoiceEdgeData {
    #[serde(default)]
    label: String,
}

#[derive(Deserialize, Clone)]
#[allow(dead_code)]
struct ProjectEdge {
    id: String,
    source: String,
    target: String,
    #[serde(default)]
    data: Option<ChoiceEdgeData>,
}

#[derive(Deserialize, Clone)]
#[allow(dead_code)]
struct Project {
    name: String,
    #[serde(rename = "startNodeId")]
    start_node_id: Option<String>,
    nodes: Vec<ProjectNode>,
    edges: Vec<ProjectEdge>,
}

#[tauri::command]
fn play_yaml_player(app_handle: tauri::AppHandle, project: Project) -> Result<(), String> {
    let app_dir = app_handle
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?;
    let export_dir = app_dir.join("yaml-player-export");
    let videos_dir = export_dir.join("videos");

    if export_dir.exists() {
        fs::remove_dir_all(&export_dir).map_err(|e| e.to_string())?;
    }
    fs::create_dir_all(&videos_dir).map_err(|e| e.to_string())?;

    let yaml_path = export_dir.join("project.yaml");
    let yaml_content = build_yaml(&project, &videos_dir)?;
    fs::write(&yaml_path, yaml_content).map_err(|e| e.to_string())?;

    launch_yaml_player(app_handle, yaml_path.to_string_lossy().to_string())
}

fn build_yaml(project: &Project, videos_dir: &Path) -> Result<String, String> {
    let mut ordered_nodes = project.nodes.clone();
    if let Some(start_id) = &project.start_node_id {
        if let Some(start_index) = ordered_nodes.iter().position(|n| &n.id == start_id) {
            if start_index > 0 {
                let start_node = ordered_nodes.remove(start_index);
                ordered_nodes.insert(0, start_node);
            }
        }
    }

    let mut id_map: HashMap<String, usize> = HashMap::new();
    for (index, node) in ordered_nodes.iter().enumerate() {
        id_map.insert(node.id.clone(), index + 1);
    }

    let mut outputs_by_node: HashMap<String, Vec<String>> = HashMap::new();
    for edge in &project.edges {
        if id_map.contains_key(&edge.source) && id_map.contains_key(&edge.target) {
            outputs_by_node
                .entry(edge.source.clone())
                .or_default()
                .push(edge.target.clone());
        }
    }

    let mut lines: Vec<String> = vec!["nodes:".to_string()];

    for node in &ordered_nodes {
        let numeric_id = id_map.get(&node.id).copied().unwrap_or(1);
        let video_name = if node.data.video_name.is_empty() {
            Path::new(&node.data.video_path)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or(&format!("video_{numeric_id}"))
                .to_string()
        } else {
            node.data.video_name.clone()
        };
        let title = if node.data.label.is_empty() {
            if node.data.video_name.is_empty() {
                format!("Node {numeric_id}")
            } else {
                node.data.video_name.clone()
            }
        } else {
            node.data.label.clone()
        };

        let src_path = Path::new(&node.data.video_path);
        let dest_path = videos_dir.join(&video_name);
        fs::copy(src_path, dest_path).map_err(|e| {
            format!("Failed to copy video {}: {e}", src_path.display())
        })?;

        lines.push(format!("  - id: {numeric_id}"));
        lines.push(format!("    title: {}", yaml_string(&title)));
        lines.push(format!("    file: {}", yaml_string(&format!("videos/{video_name}"))));

        if let Some(outputs) = outputs_by_node.get(&node.id) {
            if !outputs.is_empty() {
                lines.push("    outputs:".to_string());
                for target_old_id in outputs {
                    if let Some(&target_id) = id_map.get(target_old_id) {
                        lines.push(format!("      - {target_id}"));
                    }
                }
            }
        }
    }

    Ok(lines.join("\n") + "\n")
}

fn yaml_string(value: &str) -> String {
    let escaped = value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
        .replace('\t', "\\t");
    format!("\"{escaped}\"")
}

fn find_player_script(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    // In production the player is bundled as a Tauri resource.
    let resource_dir = app_handle
        .path()
        .resource_dir()
        .map_err(|e| e.to_string())?;
    let bundled = resource_dir.join("player").join("main.py");
    if bundled.is_file() {
        return Ok(bundled);
    }

    // In development the player is located inside src-tauri.
    let dev_candidates = [
        PathBuf::from("src-tauri/player/main.py"),
        PathBuf::from("../interactive-video/src-tauri/player/main.py"),
    ];
    for candidate in &dev_candidates {
        if candidate.is_file() {
            return Ok(candidate.canonicalize().unwrap_or_else(|_| candidate.clone()));
        }
    }

    Err("Player script (player/main.py) not found.".to_string())
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn build_yaml_maps_start_node_first_and_numeric_ids() {
        let temp_dir = tempfile::tempdir().unwrap();
        let videos_dir = temp_dir.path().join("videos");
        fs::create_dir_all(&videos_dir).unwrap();

        let video_a = temp_dir.path().join("1.mp4");
        let video_b = temp_dir.path().join("2.mp4");
        let video_c = temp_dir.path().join("3.mp4");
        for path in [&video_a, &video_b, &video_c] {
            let mut f = fs::File::create(path).unwrap();
            f.write_all(b"dummy").unwrap();
        }

        let project = Project {
            name: "Test".to_string(),
            start_node_id: Some("node_b".to_string()),
            nodes: vec![
                ProjectNode {
                    id: "node_a".to_string(),
                    _node_type: "video".to_string(),
                    data: VideoNodeData {
                        label: "Video A".to_string(),
                        video_path: video_a.to_string_lossy().to_string(),
                        video_name: "1.mp4".to_string(),
                    },
                },
                ProjectNode {
                    id: "node_b".to_string(),
                    _node_type: "video".to_string(),
                    data: VideoNodeData {
                        label: "Video \"B\"".to_string(),
                        video_path: video_b.to_string_lossy().to_string(),
                        video_name: "2.mp4".to_string(),
                    },
                },
                ProjectNode {
                    id: "node_c".to_string(),
                    _node_type: "video".to_string(),
                    data: VideoNodeData {
                        label: "".to_string(),
                        video_path: video_c.to_string_lossy().to_string(),
                        video_name: "3.mp4".to_string(),
                    },
                },
            ],
            edges: vec![
                ProjectEdge {
                    id: "edge_1".to_string(),
                    source: "node_b".to_string(),
                    target: "node_a".to_string(),
                    data: None,
                },
                ProjectEdge {
                    id: "edge_2".to_string(),
                    source: "node_b".to_string(),
                    target: "node_c".to_string(),
                    data: None,
                },
            ],
        };

        let yaml = build_yaml(&project, &videos_dir).unwrap();
        assert!(yaml.contains("- id: 1"));
        assert!(yaml.contains("title: \"Video \\\"B\\\"\""));
        assert!(yaml.contains("file: \"videos/2.mp4\""));
        assert!(yaml.contains("outputs:\n      - 2\n      - 3") || yaml.contains("outputs:\n      - 3\n      - 2"));

        // First node should be the start node.
        let first_id_line = yaml.lines().find(|l| l.contains("- id:")).unwrap();
        assert!(first_id_line.contains("- id: 1"));

        // Videos should be copied.
        assert!(videos_dir.join("1.mp4").is_file());
        assert!(videos_dir.join("2.mp4").is_file());
        assert!(videos_dir.join("3.mp4").is_file());
    }
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
        .invoke_handler(tauri::generate_handler![get_app_dir, get_player_project, get_current_exe, launch_yaml_player, play_yaml_player])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
