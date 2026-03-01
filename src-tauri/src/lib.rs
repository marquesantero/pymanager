use std::process::Command;
use std::path::{Path, PathBuf};
use serde::{Serialize, Deserialize};
use std::fs;
use std::time::UNIX_EPOCH;
use walkdir::WalkDir;
use tauri_plugin_sql::{Migration, MigrationKind};

#[derive(Serialize, Deserialize, Clone)]
pub struct VenvInfo {
    name: String,
    path: String,
    version: String,
    status: String,
    issue: Option<String>,
    last_modified: u64,
}

#[derive(Serialize, Deserialize)]
pub struct VenvDetails {
    packages: Vec<String>,
    size_mb: f64,
}

#[derive(Serialize, Deserialize)]
pub struct OutdatedPackage {
    name: String,
    version: String,
    latest_version: String,
}

fn get_pip_path(venv_path: &Path) -> PathBuf {
    let mut p = venv_path.to_path_buf();
    #[cfg(windows)] p.push("Scripts/pip.exe");
    #[cfg(not(windows))] p.push("bin/pip");
    p
}

fn get_python_path(venv_path: &Path) -> PathBuf {
    let mut p = venv_path.to_path_buf();
    #[cfg(windows)] p.push("Scripts/python.exe");
    #[cfg(not(windows))] p.push("bin/python");
    p
}

fn get_venv_info(p: &Path) -> Option<VenvInfo> {
    if !p.is_dir() { return None; }
    let cfg_path = p.join("pyvenv.cfg");
    let bin_path = get_python_path(p);

    if cfg_path.exists() || bin_path.exists() {
        let mut status = "Healthy".to_string();
        let mut issue = None;
        let mut version = "Unknown".to_string();
        let last_modified = p.metadata().and_then(|m| m.modified()).map(|t| t.duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)).unwrap_or(0);

        if !bin_path.exists() {
            status = "Broken".to_string();
            issue = Some("Missing Python binary".to_string());
        } else {
            let version_output = Command::new(&bin_path).arg("--version").output();
            match version_output {
                Ok(out) if out.status.success() => { version = String::from_utf8_lossy(&out.stdout).trim().to_string(); },
                _ => { status = "Broken".to_string(); issue = Some("Interpreter corrupted".to_string()); }
            }
        }
        return Some(VenvInfo { name: p.file_name().unwrap_or_default().to_string_lossy().to_string(), path: p.to_string_lossy().to_string(), version, status, issue, last_modified });
    }
    None
}

#[tauri::command]
fn check_venv_health(venv_path: String) -> Result<String, String> {
    let pip = get_pip_path(Path::new(&venv_path));
    let out = Command::new(pip).arg("check").output().map_err(|e| e.to_string())?;
    if out.status.success() { Ok("No conflicts found.".into()) } else { Ok(String::from_utf8_lossy(&out.stdout).to_string()) }
}

#[tauri::command]
fn list_outdated_packages(venv_path: String) -> Result<Vec<OutdatedPackage>, String> {
    let pip = get_pip_path(Path::new(&venv_path));
    let out = Command::new(pip).args(["list", "--outdated", "--format=json"]).output().map_err(|e| e.to_string())?;
    if out.status.success() { let pkgs: Vec<OutdatedPackage> = serde_json::from_slice(&out.stdout).map_err(|e| e.to_string())?; Ok(pkgs) } else { Ok(Vec::new()) }
}

#[tauri::command]
fn get_pyvenv_cfg(venv_path: String) -> Result<String, String> {
    let path = Path::new(&venv_path).join("pyvenv.cfg");
    if path.exists() { fs::read_to_string(path).map_err(|e| e.to_string()) } else { Err("pyvenv.cfg not found".into()) }
}

#[tauri::command]
fn list_system_pythons() -> Vec<String> {
    let mut found = Vec::new();
    let paths = ["/usr/bin/python3", "/usr/bin/python", "/usr/local/bin/python3"];
    for p in paths {
        if Path::new(p).exists() { if let Ok(out) = Command::new(p).arg("--version").output() { found.push(format!("{}|{}", p, String::from_utf8_lossy(&out.stdout).trim())); } }
    }
    found
}

#[tauri::command]
fn run_venv_script(venv_path: String, command: String) -> Result<String, String> {
    let python = get_python_path(Path::new(&venv_path));
    let out = Command::new(python).arg("-c").arg(&command).output().map_err(|e| e.to_string())?;
    if out.status.success() { Ok(String::from_utf8_lossy(&out.stdout).to_string()) } else { Err(String::from_utf8_lossy(&out.stderr).to_string()) }
}

#[tauri::command]
fn read_env_file(venv_path: String) -> Result<String, String> {
    let pb = PathBuf::from(&venv_path);
    let project_root = pb.parent().unwrap_or(Path::new(&venv_path));
    let env_path = project_root.join(".env");
    if env_path.exists() { fs::read_to_string(env_path).map_err(|e| e.to_string()) } else { Ok("".to_string()) }
}

#[tauri::command]
fn save_env_file(venv_path: String, content: String) -> Result<(), String> {
    let pb = PathBuf::from(&venv_path);
    let project_root = pb.parent().unwrap_or(Path::new(&venv_path));
    let env_path = project_root.join(".env");
    fs::write(env_path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_terminal(path: String) -> Result<(), String> {
    #[cfg(target_os = "linux")] {
        let terminal_commands = [("gnome-terminal", vec!["--working-directory"]), ("konsole", vec!["--workdir"]), ("xfce4-terminal", vec!["--working-directory"]), ("xterm", vec!["-cd"])];
        for (term, args) in terminal_commands {
            let mut cmd = Command::new(term);
            for arg in &args { cmd.arg(arg); }
            cmd.arg(&path);
            if cmd.spawn().is_ok() { return Ok(()); }
        }
    }
    #[cfg(target_os = "windows")] { Command::new("cmd").args(["/c", "start", "cmd.exe", "/k", "cd", "/d", &path]).spawn().map_err(|e| e.to_string())?; }
    Ok(())
}

#[tauri::command]
fn open_in_vscode(path: String) -> Result<(), String> {
    let pb = PathBuf::from(&path);
    let parent = pb.parent().unwrap_or(Path::new(&path)).to_string_lossy().to_string();
    #[cfg(target_os = "windows")] { Command::new("cmd").args(["/c", "code", &parent]).spawn().map_err(|e| e.to_string())?; }
    #[cfg(not(target_os = "windows"))] { Command::new("code").arg(&parent).spawn().map_err(|e| e.to_string())?; }
    Ok(())
}

#[tauri::command]
fn scan_venv(path: String) -> Result<VenvInfo, String> {
    get_venv_info(Path::new(&path)).ok_or_else(|| "Not a valid venv".to_string())
}

#[tauri::command]
fn list_venvs(base_path: String) -> Result<Vec<VenvInfo>, String> {
    let mut venvs = Vec::new();
    let root = Path::new(&base_path);
    if !root.is_dir() { return Err("Invalid directory path".to_string()); }
    let walker = WalkDir::new(root).into_iter().filter_entry(|e| {
        let name = e.file_name().to_string_lossy();
        if name == "node_modules" || name == "target" || name == "__pycache__" || name == ".git" { return false; }
        if name.starts_with('.') && name != ".venv" { return false; }
        true
    });
    for entry in walker.filter_map(|e| e.ok()) {
        if let Some(info) = get_venv_info(entry.path()) { venvs.push(info); }
    }
    Ok(venvs)
}

#[tauri::command]
fn create_venv(path: String, name: String, python_bin: String) -> Result<String, String> {
    let mut full_path = PathBuf::from(&path);
    full_path.push(&name);
    let bin = if python_bin.is_empty() { "python3".to_string() } else { python_bin };
    let output = Command::new(bin).args(["-m", "venv", full_path.to_str().unwrap()]).output().map_err(|e| e.to_string())?;
    if output.status.success() { Ok(format!("Created {}", name)) } else { Err(String::from_utf8_lossy(&output.stderr).to_string()) }
}

#[tauri::command]
fn delete_venv(path: String) -> Result<String, String> {
    let p = PathBuf::from(&path);
    if p.exists() { fs::remove_dir_all(&p).map_err(|e| format!("Delete failed: {}", e))?; Ok(format!("Deleted {}", path)) } else { Err("Not found".into()) }
}

#[tauri::command]
fn install_dependency(venv_path: String, package: String) -> Result<String, String> {
    let p = get_pip_path(Path::new(&venv_path));
    let output = Command::new(p).args(["install", &package]).output().map_err(|e| e.to_string())?;
    if output.status.success() { Ok(format!("Installed {}", package)) } else { Err(String::from_utf8_lossy(&output.stderr).to_string()) }
}

#[tauri::command]
fn uninstall_package(venv_path: String, package: String) -> Result<String, String> {
    let pip = get_pip_path(Path::new(&venv_path));
    let out = Command::new(pip).args(["uninstall", "-y", &package]).output().map_err(|e| e.to_string())?;
    if out.status.success() { Ok(format!("Uninstalled {}", package)) } else { Err(String::from_utf8_lossy(&out.stderr).to_string()) }
}

#[tauri::command]
fn update_package(venv_path: String, package: String) -> Result<String, String> {
    let pip = get_pip_path(Path::new(&venv_path));
    let out = Command::new(pip).args(["install", "--upgrade", &package]).output().map_err(|e| e.to_string())?;
    if out.status.success() { Ok(format!("Updated {}", package)) } else { Err(String::from_utf8_lossy(&out.stderr).to_string()) }
}

#[tauri::command]
fn get_venv_details(path: String) -> Result<VenvDetails, String> {
    let p = PathBuf::from(&path);
    let size_bytes = fs_extra::dir::get_size(&p).unwrap_or(0);
    let size_mb = (size_bytes as f64) / 1024.0 / 1024.0;
    let pip = get_pip_path(&p);
    let mut packages = Vec::new();
    if let Ok(output) = Command::new(pip).args(["list", "--format=freeze"]).output() {
        packages = String::from_utf8_lossy(&output.stdout).lines().map(|s| s.to_string()).collect();
    }
    Ok(VenvDetails { packages, size_mb })
}

#[tauri::command]
fn purge_pip_cache() -> Result<String, String> {
    let out = Command::new("python3").args(["-m", "pip", "cache", "purge"]).output().map_err(|e| e.to_string())?;
    if out.status.success() { Ok("Pip cache cleared".into()) } else { Err(String::from_utf8_lossy(&out.stderr).to_string()) }
}

#[tauri::command]
fn export_requirements(venv_path: String) -> Result<String, String> {
    let pip = get_pip_path(Path::new(&venv_path));
    let pb = PathBuf::from(&venv_path);
    let project_root = pb.parent().unwrap_or(Path::new(&venv_path));
    let req_path = project_root.join("requirements.txt");
    let out = Command::new(pip).args(["freeze"]).output().map_err(|e| e.to_string())?;
    if out.status.success() {
        fs::write(&req_path, out.stdout).map_err(|e| e.to_string())?;
        Ok(format!("Exported to {}", req_path.to_string_lossy()))
    } else { Err(String::from_utf8_lossy(&out.stderr).to_string()) }
}

#[tauri::command]
fn sync_requirements(venv_path: String) -> Result<String, String> {
    let pip = get_pip_path(Path::new(&venv_path));
    let pb = PathBuf::from(&venv_path);
    let project_root = pb.parent().unwrap_or(Path::new(&venv_path));
    let req_path = project_root.join("requirements.txt");
    if !req_path.exists() { return Err("requirements.txt not found".into()); }
    let out = Command::new(pip).args(["install", "-r", req_path.to_str().unwrap()]).output().map_err(|e| e.to_string())?;
    if out.status.success() { Ok("Synced!".into()) } else { Err(String::from_utf8_lossy(&out.stderr).to_string()) }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration { version: 1, description: "init", sql: "CREATE TABLE workspaces (id INTEGER PRIMARY KEY AUTOINCREMENT, path TEXT UNIQUE); CREATE TABLE venvs (id INTEGER PRIMARY KEY AUTOINCREMENT, workspace_path TEXT, name TEXT, path TEXT UNIQUE, version TEXT, status TEXT, issue TEXT);", kind: MigrationKind::Up },
        Migration { version: 2, description: "last_mod", sql: "ALTER TABLE venvs ADD COLUMN last_modified INTEGER DEFAULT 0;", kind: MigrationKind::Up },
        Migration { version: 3, description: "scripts", sql: "CREATE TABLE scripts (id INTEGER PRIMARY KEY AUTOINCREMENT, venv_path TEXT, name TEXT, command TEXT);", kind: MigrationKind::Up },
        Migration { version: 4, description: "custom_templates", sql: "CREATE TABLE custom_templates (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, packages TEXT);", kind: MigrationKind::Up }
    ];
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().add_migrations("sqlite:py-manager.db", migrations).build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            check_venv_health, list_outdated_packages, scan_venv, run_venv_script, read_env_file, save_env_file, 
            open_terminal, open_in_vscode, create_venv, list_venvs, delete_venv, 
            install_dependency, get_venv_details, list_system_pythons, uninstall_package, update_package, purge_pip_cache,
            export_requirements, sync_requirements, get_pyvenv_cfg
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
