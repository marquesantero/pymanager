use std::process::Command;
use std::path::{Path, PathBuf};
use serde::{Serialize, Deserialize};
use std::fs;
use std::time::UNIX_EPOCH;
use std::collections::{HashMap, HashSet};
use std::time::{Duration, Instant};
use std::thread;
use std::process::{Output, Stdio};
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
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
    manager_type: String,
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

// --- Internal Helpers ---

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

fn canonicalize_dir(path: &str) -> Result<PathBuf, String> {
    let p = PathBuf::from(path);
    let canon = fs::canonicalize(&p).map_err(|_| format!("Path not found: {}", path))?;
    if !canon.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }
    Ok(canon)
}

fn is_valid_venv_dir(path: &Path) -> bool {
    path.join("pyvenv.cfg").exists() || get_python_path(path).exists()
}

fn ensure_venv_dir(path: &str) -> Result<PathBuf, String> {
    let canon = canonicalize_dir(path)?;
    if !is_valid_venv_dir(&canon) {
        return Err("Invalid virtual environment path".to_string());
    }
    Ok(canon)
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
                Ok(out) if out.status.success() => {
                    let parsed = if out.stdout.is_empty() {
                        String::from_utf8_lossy(&out.stderr).trim().to_string()
                    } else {
                        String::from_utf8_lossy(&out.stdout).trim().to_string()
                    };
                    if !parsed.is_empty() {
                        version = parsed;
                    }
                },
                _ => { status = "Broken".to_string(); issue = Some("Interpreter corrupted".to_string()); }
            }
        }
        let manager_type = if p.join("uv.lock").exists() || p.parent().map_or(false, |parent| parent.join("uv.lock").exists()) {
            "uv".to_string()
        } else {
            "pip".to_string()
        };

        return Some(VenvInfo { 
            name: p.file_name().unwrap_or_default().to_string_lossy().to_string(), 
            path: p.to_string_lossy().to_string(), 
            version, 
            status, 
            issue, 
            last_modified,
            manager_type
        });
    }
    None
}

fn safe_dir_size_mb(root: &Path, max_entries: usize) -> f64 {
    let mut total_bytes: u64 = 0;
    let mut seen: usize = 0;

    for entry in WalkDir::new(root).follow_links(false).into_iter().filter_map(|e| e.ok()) {
        if seen >= max_entries {
            break;
        }
        seen += 1;
        let p = entry.path();
        if let Ok(meta) = fs::symlink_metadata(p) {
            if meta.file_type().is_file() {
                total_bytes = total_bytes.saturating_add(meta.len());
            }
        }
    }

    (total_bytes as f64) / 1024.0 / 1024.0
}

fn run_command_with_timeout(command: &mut Command, timeout_secs: u64) -> Result<Output, String> {
    command.stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = command.spawn().map_err(|e| e.to_string())?;
    let started = Instant::now();
    let deadline = Duration::from_secs(timeout_secs);

    loop {
        match child.try_wait().map_err(|e| e.to_string())? {
            Some(_) => return child.wait_with_output().map_err(|e| e.to_string()),
            None if started.elapsed() >= deadline => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(format!("Command timed out after {} seconds", timeout_secs));
            }
            None => thread::sleep(Duration::from_millis(120)),
        }
    }
}

fn stdout_or_stderr(out: &Output) -> String {
    if !out.stdout.is_empty() {
        String::from_utf8_lossy(&out.stdout).to_string()
    } else {
        String::from_utf8_lossy(&out.stderr).to_string()
    }
}

#[derive(Clone)]
struct BackgroundJobHandle {
    cancel: Arc<AtomicBool>,
    snapshot: Arc<Mutex<JobSnapshot>>,
}

#[derive(Clone)]
struct JobSnapshot {
    status: String,
    result: Option<serde_json::Value>,
    error: Option<String>,
}

impl JobSnapshot {
    fn running() -> Self {
        Self {
            status: "running".to_string(),
            result: None,
            error: None,
        }
    }
}

#[derive(Default)]
struct AppState {
    jobs: Mutex<HashMap<String, BackgroundJobHandle>>,
    job_seq: AtomicU64,
}

fn create_background_job(state: &tauri::State<'_, AppState>) -> Result<(String, BackgroundJobHandle), String> {
    let job_id = format!("job-{}", state.job_seq.fetch_add(1, Ordering::Relaxed) + 1);
    let handle = BackgroundJobHandle {
        cancel: Arc::new(AtomicBool::new(false)),
        snapshot: Arc::new(Mutex::new(JobSnapshot::running())),
    };
    let mut jobs = state.jobs.lock().map_err(|_| "Failed to lock job store".to_string())?;
    jobs.insert(job_id.clone(), handle.clone());
    Ok((job_id, handle))
}

fn set_job_status(handle: &BackgroundJobHandle, status: &str, result: Option<serde_json::Value>, error: Option<String>) {
    if let Ok(mut snapshot) = handle.snapshot.lock() {
        snapshot.status = status.to_string();
        snapshot.result = result;
        snapshot.error = error;
    }
}

fn run_command_with_timeout_and_cancel(command: &mut Command, timeout_secs: u64, cancel: &AtomicBool) -> Result<Output, String> {
    command.stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = command.spawn().map_err(|e| e.to_string())?;
    let started = Instant::now();
    let deadline = Duration::from_secs(timeout_secs);

    loop {
        if cancel.load(Ordering::Relaxed) {
            let _ = child.kill();
            let _ = child.wait();
            return Err("Cancelled by user".to_string());
        }

        match child.try_wait().map_err(|e| e.to_string())? {
            Some(_) => return child.wait_with_output().map_err(|e| e.to_string()),
            None if started.elapsed() >= deadline => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(format!("Command timed out after {} seconds", timeout_secs));
            }
            None => thread::sleep(Duration::from_millis(120)),
        }
    }
}

// --- New Commands for Analysis ---

#[tauri::command]
async fn get_package_sizes(venv_path: String) -> Result<HashMap<String, f64>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut sizes = HashMap::new();
        let p = Path::new(&venv_path);
        
        // Find site-packages directory (logic varies by Python version/OS)
        // On Linux usually: lib/python3.x/site-packages
        #[cfg(not(windows))]
        let lib_dir = p.join("lib");
        #[cfg(windows)]
        let lib_dir = p.join("Lib").join("site-packages");

        #[cfg(not(windows))]
        if let Ok(entries) = fs::read_dir(lib_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() && entry.file_name().to_string_lossy().starts_with("python") {
                    let site_pkgs = path.join("site-packages");
                    if site_pkgs.exists() {
                        if let Ok(pkg_entries) = fs::read_dir(site_pkgs) {
                            for pkg in pkg_entries.flatten() {
                                let pkg_path = pkg.path();
                                let name = pkg.file_name().to_string_lossy().to_string();
                                if !name.ends_with(".dist-info") && !name.starts_with("__") {
                                    sizes.insert(name, safe_dir_size_mb(&pkg_path, 120_000));
                                }
                            }
                        }
                    }
                }
            }
        }
        
        #[cfg(windows)]
        if lib_dir.exists() {
            if let Ok(pkg_entries) = fs::read_dir(lib_dir) {
                for pkg in pkg_entries.flatten() {
                    let pkg_path = pkg.path();
                    let name = pkg.file_name().to_string_lossy().to_string();
                    if !name.ends_with(".dist-info") && !name.starts_with("__") {
                        sizes.insert(name, safe_dir_size_mb(&pkg_path, 120_000));
                    }
                }
            }
        }

        Ok(sizes)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn generate_docker_files(_venv_path: String, python_version: String) -> HashMap<String, String> {
    let mut files = HashMap::new();
    let version = python_version.split(' ').last().unwrap_or("3.12");
    
    let dockerfile = format!(
r#"# Generated by PyManager
FROM python:{}-slim

WORKDIR /app

# Install system dependencies if needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy project code
COPY . .

# Default execution
CMD ["python", "main.py"]
"#, version);

    let compose = r#"# Generated by PyManager
services:
  app:
    build: .
    volumes:
      - .:/app
    environment:
      - PYTHONUNBUFFERED=1
"#;

    files.insert("Dockerfile".to_string(), dockerfile);
    files.insert("docker-compose.yml".to_string(), compose.to_string());
    files
}

// --- Standard Commands ---

#[tauri::command]
async fn check_venv_health(venv_path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let venv = ensure_venv_dir(&venv_path)?;
        let pip = get_pip_path(&venv);
        let mut cmd = Command::new(pip);
        cmd.arg("check");
        let out = run_command_with_timeout(&mut cmd, 90)?;
        if out.status.success() {
            Ok("No conflicts found.".into())
        } else if !out.stdout.is_empty() {
            Ok(String::from_utf8_lossy(&out.stdout).to_string())
        } else {
            Ok(String::from_utf8_lossy(&out.stderr).to_string())
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn list_outdated_packages(venv_path: String) -> Result<Vec<OutdatedPackage>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let venv = ensure_venv_dir(&venv_path)?;
        let pip = get_pip_path(&venv);
        let mut cmd = Command::new(pip);
        cmd.args(["list", "--outdated", "--format=json"]);
        let out = run_command_with_timeout(&mut cmd, 120)?;
        if out.status.success() {
            let pkgs: Vec<OutdatedPackage> = serde_json::from_slice(&out.stdout).map_err(|e| e.to_string())?;
            Ok(pkgs)
        } else {
            Ok(Vec::new())
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn get_pyvenv_cfg(venv_path: String) -> Result<String, String> {
    let venv = ensure_venv_dir(&venv_path)?;
    let path = venv.join("pyvenv.cfg");
    if path.exists() { fs::read_to_string(path).map_err(|e| e.to_string()) } else { Err("pyvenv.cfg not found".into()) }
}

#[tauri::command]
fn list_system_pythons() -> Vec<String> {
    let mut found_versions = HashMap::new(); // version_string -> path
    
    let path_var = std::env::var_os("PATH").unwrap_or_default();
    let paths = std::env::split_paths(&path_var);

    for dir in paths {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                let name_low = name.to_lowercase();
                
                // Match: python, python3, python3.x, python.exe, etc.
                // Avoid: python-config, python3-config, pip, etc.
                let is_python = (name_low == "python" || name_low == "python.exe" || 
                                 name_low == "python3" || name_low == "python3.exe" ||
                                 (name_low.starts_with("python3.") && name_low.chars().nth(8).map_or(false, |c| c.is_ascii_digit())))
                                && !name_low.contains("-config");

                if is_python {
                    let p = entry.path();
                    if let Ok(out) = Command::new(&p).arg("--version").output() {
                        if out.status.success() {
                            let version = if out.stdout.is_empty() {
                                String::from_utf8_lossy(&out.stderr)
                            } else {
                                String::from_utf8_lossy(&out.stdout)
                            }.trim().to_string();

                            if !version.is_empty() {
                                // Deduplicate: prefer paths with numbers (specific versions)
                                let current_path = p.to_string_lossy().to_string();
                                if !found_versions.contains_key(&version) || current_path.contains(".") {
                                    found_versions.insert(version, current_path);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    found_versions.into_iter().map(|(v, p)| format!("{}|{}", p, v)).collect()
}

#[tauri::command]
fn run_venv_script(venv_path: String, command: String) -> Result<String, String> {
    let venv = ensure_venv_dir(&venv_path)?;
    let python = get_python_path(&venv);
    let out = Command::new(python).arg("-c").arg(&command).output().map_err(|e| e.to_string())?;
    if out.status.success() { Ok(String::from_utf8_lossy(&out.stdout).to_string()) } else { Err(String::from_utf8_lossy(&out.stderr).to_string()) }
}

#[tauri::command]
fn read_env_file(venv_path: String) -> Result<String, String> {
    let pb = ensure_venv_dir(&venv_path)?;
    let project_root = pb.parent().unwrap_or(&pb);
    let env_path = project_root.join(".env");
    if env_path.exists() { fs::read_to_string(env_path).map_err(|e| e.to_string()) } else { Ok("".to_string()) }
}

#[tauri::command]
fn save_env_file(venv_path: String, content: String) -> Result<(), String> {
    let pb = ensure_venv_dir(&venv_path)?;
    let project_root = pb.parent().unwrap_or(&pb);
    let env_path = project_root.join(".env");
    fs::write(env_path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_terminal(path: String) -> Result<(), String> {
    let venv = ensure_venv_dir(&path)?;
    let safe_path = venv.to_string_lossy().to_string();
    #[cfg(target_os = "linux")] {
        let terminal_commands = [("gnome-terminal", vec!["--working-directory"]), ("konsole", vec!["--workdir"]), ("xfce4-terminal", vec!["--working-directory"]), ("xterm", vec!["-cd"])];
        let mut started = false;
        for (term, args) in terminal_commands {
            let mut cmd = Command::new(term);
            for arg in &args { cmd.arg(arg); }
            cmd.arg(&safe_path);
            if cmd.spawn().is_ok() {
                started = true;
                break;
            }
        }
        if !started {
            return Err("No supported terminal emulator found on PATH".to_string());
        }
    }
    #[cfg(target_os = "windows")] { Command::new("cmd").args(["/c", "start", "cmd.exe", "/k", "cd", "/d", &safe_path]).spawn().map_err(|e| e.to_string())?; }
    #[cfg(target_os = "macos")] {
        Command::new("open")
            .args(["-a", "Terminal", &safe_path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn open_in_vscode(path: String) -> Result<(), String> {
    let pb = ensure_venv_dir(&path)?;
    let parent = pb.parent().unwrap_or(&pb).to_string_lossy().to_string();
    #[cfg(target_os = "windows")] { Command::new("cmd").args(["/c", "code", &parent]).spawn().map_err(|e| e.to_string())?; }
    #[cfg(not(target_os = "windows"))] { Command::new("code").arg(&parent).spawn().map_err(|e| e.to_string())?; }
    Ok(())
}

#[tauri::command]
fn scan_venv(path: String) -> Result<VenvInfo, String> {
    let canon = ensure_venv_dir(&path)?;
    get_venv_info(&canon).ok_or_else(|| "Not a valid venv".to_string())
}

#[tauri::command]
fn list_venvs(base_path: String) -> Result<Vec<VenvInfo>, String> {
    let mut venvs = Vec::new();
    let root = canonicalize_dir(&base_path)?;
    // Limit traversal depth to keep scanning responsive on very large monorepos.
    let walker = WalkDir::new(&root).max_depth(8).into_iter().filter_entry(|e| {
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

#[derive(Serialize, Deserialize)]
pub struct AuditReport {
    broken_links: Vec<String>, // Paths in DB but not on disk
    untracked_venvs: Vec<VenvInfo>, // Paths on disk but not in DB
}

#[derive(Serialize, Deserialize)]
pub struct ManagerStatus {
    uv: bool,
    poetry: bool,
    pdm: bool,
}

#[tauri::command]
fn start_diagnostics_job(venv_path: String, state: tauri::State<'_, AppState>) -> Result<String, String> {
    let (job_id, job) = create_background_job(&state)?;
    tauri::async_runtime::spawn(async move {
        let blocking_job = job.clone();
        let outcome = tauri::async_runtime::spawn_blocking(move || -> Result<serde_json::Value, String> {
            let venv = ensure_venv_dir(&venv_path)?;
            let pip = get_pip_path(&venv);

            let mut check_cmd = Command::new(&pip);
            check_cmd.arg("check");
            let health_out = run_command_with_timeout_and_cancel(&mut check_cmd, 90, blocking_job.cancel.as_ref())?;
            let health = if health_out.status.success() {
                "No conflicts found.".to_string()
            } else {
                stdout_or_stderr(&health_out)
            };

            let mut outdated_cmd = Command::new(&pip);
            outdated_cmd.args(["list", "--outdated", "--format=json"]);
            let outdated_out = run_command_with_timeout_and_cancel(&mut outdated_cmd, 120, blocking_job.cancel.as_ref())?;
            let outdated: Vec<OutdatedPackage> = if outdated_out.status.success() {
                serde_json::from_slice(&outdated_out.stdout).map_err(|e| e.to_string())?
            } else {
                Vec::new()
            };

            Ok(serde_json::json!({
                "health": health,
                "outdated": outdated
            }))
        })
        .await
        .map_err(|e| e.to_string())
        .and_then(|res| res);

        match outcome {
            Ok(result) => set_job_status(&job, "success", Some(result), None),
            Err(err) if err == "Cancelled by user" => set_job_status(&job, "cancelled", None, None),
            Err(err) => set_job_status(&job, "error", None, Some(err)),
        }
    });
    Ok(job_id)
}

#[tauri::command]
fn start_security_audit_job(venv_path: String, state: tauri::State<'_, AppState>) -> Result<String, String> {
    let (job_id, job) = create_background_job(&state)?;
    tauri::async_runtime::spawn(async move {
        let blocking_job = job.clone();
        let outcome = tauri::async_runtime::spawn_blocking(move || -> Result<serde_json::Value, String> {
            let venv = ensure_venv_dir(&venv_path)?;
            let python_path = get_python_path(&venv);
            let mut cmd = Command::new(python_path);
            cmd.args(["-m", "pip_audit", "--format", "json"]);
            let out = run_command_with_timeout_and_cancel(&mut cmd, 180, blocking_job.cancel.as_ref())?;

            if out.status.success() {
                serde_json::from_slice(&out.stdout).map_err(|e| e.to_string())
            } else {
                let err_msg = String::from_utf8_lossy(&out.stderr).to_string();
                if err_msg.contains("No module named pip_audit") {
                    Err("pip-audit not installed in this environment.".to_string())
                } else if !out.stdout.is_empty() {
                    serde_json::from_slice(&out.stdout).map_err(|e| e.to_string())
                } else {
                    Err(err_msg)
                }
            }
        })
        .await
        .map_err(|e| e.to_string())
        .and_then(|res| res);

        match outcome {
            Ok(result) => set_job_status(&job, "success", Some(result), None),
            Err(err) if err == "Cancelled by user" => set_job_status(&job, "cancelled", None, None),
            Err(err) => set_job_status(&job, "error", None, Some(err)),
        }
    });
    Ok(job_id)
}

#[tauri::command]
fn get_background_job(job_id: String, state: tauri::State<'_, AppState>) -> Result<serde_json::Value, String> {
    let handle = {
        let jobs = state.jobs.lock().map_err(|_| "Failed to lock job store".to_string())?;
        jobs.get(&job_id).cloned()
    };
    let Some(handle) = handle else {
        return Err("Job not found".to_string());
    };
    let snapshot = handle.snapshot.lock().map_err(|_| "Failed to lock job snapshot".to_string())?;
    Ok(serde_json::json!({
        "status": snapshot.status,
        "result": snapshot.result,
        "error": snapshot.error,
    }))
}

#[tauri::command]
fn cancel_background_job(job_id: String, state: tauri::State<'_, AppState>) -> Result<bool, String> {
    let handle = {
        let jobs = state.jobs.lock().map_err(|_| "Failed to lock job store".to_string())?;
        jobs.get(&job_id).cloned()
    };
    let Some(handle) = handle else {
        return Ok(false);
    };
    handle.cancel.store(true, Ordering::Relaxed);
    set_job_status(&handle, "cancelling", None, None);
    Ok(true)
}

#[tauri::command]
async fn audit_security(venv_path: String) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let venv = ensure_venv_dir(&venv_path)?;
        let python_path = get_python_path(&venv);
        
        // We try to run pip-audit as a module inside the venv for maximum accuracy
        // Output is requested in JSON format for easy frontend parsing
        let mut cmd = Command::new(python_path);
        cmd.args(["-m", "pip_audit", "--format", "json"]);
        let out = run_command_with_timeout(&mut cmd, 180)?;

        if out.status.success() {
            serde_json::from_slice(&out.stdout).map_err(|e| e.to_string())
        } else {
            let err_msg = String::from_utf8_lossy(&out.stderr).to_string();
            if err_msg.contains("No module named pip_audit") {
                Err("pip-audit not installed in this environment.".to_string())
            } else {
                // pip-audit returns non-zero if vulnerabilities are found, but we still want the JSON from stdout
                if !out.stdout.is_empty() {
                    return serde_json::from_slice(&out.stdout).map_err(|e| e.to_string());
                }
                Err(err_msg)
            }
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn get_dependency_tree(venv_path: String, engine: String) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let venv = ensure_venv_dir(&venv_path)?;
        if engine == "uv" {
            let uv_path = get_manager_path("uv");
            let python_path = get_python_path(&venv);
            let mut cmd = Command::new(uv_path);
            cmd.args(["tree", "--format", "json", "--python", python_path.to_str().unwrap()]);
            let out = run_command_with_timeout(&mut cmd, 180)?;
            if out.status.success() {
                return serde_json::from_slice(&out.stdout).map_err(|e| e.to_string());
            } else {
                return Err(String::from_utf8_lossy(&out.stderr).to_string());
            }
        }

        // For PIP, we use pipdeptree. It needs to be installed in the venv.
        let python_path = get_python_path(&venv);
        let mut cmd = Command::new(python_path);
        cmd.args(["-m", "pipdeptree", "--json-tree"]);
        let out = run_command_with_timeout(&mut cmd, 180)?;

        if out.status.success() {
            serde_json::from_slice(&out.stdout).map_err(|e| e.to_string())
        } else {
            Err("pipdeptree not found. Please install it in the environment to see the dependency tree.".to_string())
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn audit_environments(workspace_paths: Vec<String>, registered_paths: Vec<String>) -> AuditReport {
    let mut broken_links = Vec::new();
    let mut untracked_venvs = Vec::new();
    let registered_set: HashSet<&String> = registered_paths.iter().collect();

    // 1. Check for Broken Links (DB entries without physical folder)
    for path in &registered_paths {
        if !Path::new(path).exists() {
            broken_links.push(path.clone());
        }
    }

    // 2. Check for Untracked Venvs (Folders on disk not in DB)
    for ws in workspace_paths {
        let Ok(root) = canonicalize_dir(&ws) else { continue };
        
        let walker = WalkDir::new(&root).max_depth(3).into_iter().filter_entry(|e| {
            let name = e.file_name().to_string_lossy();
            !["node_modules", "target", "__pycache__", ".git"].contains(&name.as_ref())
        });

        for entry in walker.filter_map(|e| e.ok()) {
            let p = entry.path();
            if let Some(info) = get_venv_info(p) {
                if !registered_set.contains(&info.path) {
                    untracked_venvs.push(info);
                }
            }
        }
    }

    AuditReport { broken_links, untracked_venvs }
}

#[tauri::command]
fn check_managers() -> ManagerStatus {
    let mut uv = false;
    let mut poetry = false;
    let mut pdm = false;

    // 1. First, check standard PATH
    if Command::new("uv").arg("--version").output().is_ok() { uv = true; }
    if Command::new("poetry").arg("--version").output().is_ok() { poetry = true; }
    if Command::new("pdm").arg("--version").output().is_ok() { pdm = true; }

    // 2. Comprehensive search in common directories
    if !uv || !poetry || !pdm {
        let mut search_dirs = vec![
            PathBuf::from("/usr/local/bin"),
            PathBuf::from("/usr/bin"),
            PathBuf::from("/bin"),
        ];

        if let Some(home) = dirs::home_dir() {
            search_dirs.push(home.join(".local").join("bin"));
            search_dirs.push(home.join(".cargo").join("bin"));
            search_dirs.push(home.join("bin"));
            search_dirs.push(home.join(".local").join("share").join("uv").join("bin")); // specific uv path
        }

        for dir in search_dirs {
            if !uv && dir.join("uv").exists() { 
                if Command::new(dir.join("uv")).arg("--version").output().is_ok() { uv = true; }
            }
            if !poetry && dir.join("poetry").exists() {
                if Command::new(dir.join("poetry")).arg("--version").output().is_ok() { poetry = true; }
            }
            if !pdm && dir.join("pdm").exists() {
                if Command::new(dir.join("pdm")).arg("--version").output().is_ok() { pdm = true; }
            }
        }
    }

    println!("EXHAUSTIVE CHECK: uv:{}, poetry:{}, pdm:{}", uv, poetry, pdm);
    ManagerStatus { uv, poetry, pdm }
}

fn get_manager_path(cmd: &str) -> String {
    // Check global PATH
    if Command::new(cmd).arg("--version").output().is_ok() {
        return cmd.to_string();
    }

    // Search manually
    if let Some(home) = dirs::home_dir() {
        let paths = [
            home.join(".local").join("bin").join(cmd),
            home.join(".cargo").join("bin").join(cmd),
            home.join("bin").join(cmd),
            PathBuf::from("/usr/local/bin").join(cmd),
        ];
        for p in paths {
            if p.exists() && Command::new(&p).arg("--version").output().is_ok() {
                return p.to_string_lossy().to_string();
            }
        }
    }
    cmd.to_string()
}

#[tauri::command]
fn create_venv(path: String, name: String, python_bin: String, engine: String) -> Result<String, String> {
    let root = canonicalize_dir(&path)?;
    let mut full_path = root;
    full_path.push(&name);
    let target_path = full_path.to_str().unwrap();

    if engine == "uv" {
        let uv_path = get_manager_path("uv");
        let mut cmd = Command::new(uv_path);
        cmd.args(["venv", target_path]);
        if !python_bin.is_empty() { cmd.arg("--python").arg(&python_bin); }
        let output = cmd.output().map_err(|e| e.to_string())?;
        if output.status.success() { return Ok(format!("Created with uv: {}", name)); }
        else { return Err(String::from_utf8_lossy(&output.stderr).to_string()); }
    }
    // ...

    let bin = if python_bin.is_empty() { "python3".to_string() } else { python_bin };
    let output = Command::new(bin).args(["-m", "venv", target_path]).output().map_err(|e| e.to_string())?;
    if output.status.success() { Ok(format!("Created with venv: {}", name)) } 
    else { Err(String::from_utf8_lossy(&output.stderr).to_string()) }
}

#[tauri::command]
fn delete_venv(path: String) -> Result<String, String> {
    let p = ensure_venv_dir(&path)?;
    if p.exists() {
        fs::remove_dir_all(&p).map_err(|e| format!("Delete failed: {}", e))?;
        Ok(format!("Deleted {}", p.to_string_lossy()))
    } else {
        Err("Not found".into())
    }
}

#[tauri::command]
fn install_dependency(venv_path: String, package: String, engine: String) -> Result<String, String> {
    let venv = ensure_venv_dir(&venv_path)?;
    if engine == "uv" {
        let uv_path = get_manager_path("uv");
        let python_path = get_python_path(&venv);
        let output = Command::new(uv_path)
            .args(["pip", "install", "--python", python_path.to_str().unwrap(), &package])
            .output().map_err(|e| e.to_string())?;
        if output.status.success() { return Ok(format!("uv installed {}", package)); }
        else { return Err(String::from_utf8_lossy(&output.stderr).to_string()); }
    }

    let p = get_pip_path(&venv);
    let output = Command::new(p).args(["install", &package]).output().map_err(|e| e.to_string())?;
    if output.status.success() { Ok(format!("Installed {}", package)) } else { Err(String::from_utf8_lossy(&output.stderr).to_string()) }
}

#[tauri::command]
fn uninstall_package(venv_path: String, package: String, engine: String) -> Result<String, String> {
    let venv = ensure_venv_dir(&venv_path)?;
    if engine == "uv" {
        let uv_path = get_manager_path("uv");
        let python_path = get_python_path(&venv);
        let out = Command::new(uv_path)
            .args(["pip", "uninstall", "--python", python_path.to_str().unwrap(), "-y", &package])
            .output().map_err(|e| e.to_string())?;
        if out.status.success() { return Ok(format!("uv uninstalled {}", package)); }
        else { return Err(String::from_utf8_lossy(&out.stderr).to_string()); }
    }

    let pip = get_pip_path(&venv);
    let out = Command::new(pip).args(["uninstall", "-y", &package]).output().map_err(|e| e.to_string())?;
    if out.status.success() { Ok(format!("Uninstalled {}", package)) } else { Err(String::from_utf8_lossy(&out.stderr).to_string()) }
}

#[tauri::command]
fn update_package(venv_path: String, package: String, engine: String) -> Result<String, String> {
    let venv = ensure_venv_dir(&venv_path)?;
    if engine == "uv" {
        let uv_path = get_manager_path("uv");
        let python_path = get_python_path(&venv);
        let out = Command::new(uv_path)
            .args(["pip", "install", "--upgrade", "--python", python_path.to_str().unwrap(), &package])
            .output().map_err(|e| e.to_string())?;
        if out.status.success() { return Ok(format!("uv updated {}", package)); }
        else { return Err(String::from_utf8_lossy(&out.stderr).to_string()); }
    }

    let pip = get_pip_path(&venv);
    let out = Command::new(pip).args(["install", "--upgrade", &package]).output().map_err(|e| e.to_string())?;
    if out.status.success() { Ok(format!("Updated {}", package)) } else { Err(String::from_utf8_lossy(&out.stderr).to_string()) }
}

#[tauri::command]
async fn get_venv_details(path: String) -> Result<VenvDetails, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let p = ensure_venv_dir(&path)?;
        let size_mb = safe_dir_size_mb(&p, 300_000);
        let pip = get_pip_path(&p);
        let mut cmd = Command::new(pip);
        cmd.args(["list", "--format=freeze"]);
        let output = run_command_with_timeout(&mut cmd, 120)?;
        if !output.status.success() {
            return Err(format!("Failed to list packages: {}", stdout_or_stderr(&output).trim()));
        }
        let packages = String::from_utf8_lossy(&output.stdout).lines().map(|s| s.to_string()).collect();
        Ok(VenvDetails { packages, size_mb })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn purge_pip_cache() -> Result<String, String> {
    let out = Command::new("python3").args(["-m", "pip", "cache", "purge"]).output().map_err(|e| e.to_string())?;
    if out.status.success() { Ok("Pip cache cleared".into()) } else { Err(String::from_utf8_lossy(&out.stderr).to_string()) }
}

#[tauri::command]
async fn export_requirements(venv_path: String) -> Result<String, String> {
    let pb = ensure_venv_dir(&venv_path)?;
    let pip = get_pip_path(&pb);
    let project_root = pb.parent().unwrap_or(&pb);
    let req_path = project_root.join("requirements.txt");
    let out = Command::new(pip).args(["freeze"]).output().map_err(|e| e.to_string())?;
    if out.status.success() {
        fs::write(&req_path, out.stdout).map_err(|e| e.to_string())?;
        Ok(format!("Exported to {}", req_path.to_string_lossy()))
    } else { Err(String::from_utf8_lossy(&out.stderr).to_string()) }
}

#[tauri::command]
async fn search_pypi(query: String) -> Result<serde_json::Value, String> {
    let url = format!("https://pypi.org/pypi/{}/json", query);
    let resp = reqwest::get(url).await.map_err(|e| e.to_string())?;
    if resp.status().is_success() { Ok(resp.json().await.map_err(|e| e.to_string())?) } else { Err("Not found".into()) }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration { version: 1, description: "init", sql: "CREATE TABLE workspaces (id INTEGER PRIMARY KEY AUTOINCREMENT, path TEXT UNIQUE); CREATE TABLE venvs (id INTEGER PRIMARY KEY AUTOINCREMENT, workspace_path TEXT, name TEXT, path TEXT UNIQUE, version TEXT, status TEXT, issue TEXT);", kind: MigrationKind::Up },
        Migration { version: 2, description: "last_mod", sql: "ALTER TABLE venvs ADD COLUMN last_modified INTEGER DEFAULT 0;", kind: MigrationKind::Up },
        Migration { version: 3, description: "scripts", sql: "CREATE TABLE scripts (id INTEGER PRIMARY KEY AUTOINCREMENT, venv_path TEXT, name TEXT, command TEXT);", kind: MigrationKind::Up },
        Migration { version: 4, description: "custom_templates", sql: "CREATE TABLE custom_templates (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, packages TEXT);", kind: MigrationKind::Up },
        Migration { version: 5, description: "orchestrator_fields", sql: "ALTER TABLE venvs ADD COLUMN manager_type TEXT DEFAULT 'pip'; ALTER TABLE venvs ADD COLUMN pyproject_path TEXT;", kind: MigrationKind::Up },
        Migration { version: 6, description: "default_workspace", sql: "ALTER TABLE workspaces ADD COLUMN is_default INTEGER DEFAULT 0;", kind: MigrationKind::Up }
    ];
    tauri::Builder::default()
        .manage(AppState::default())
        .plugin(tauri_plugin_sql::Builder::default().add_migrations("sqlite:py-manager.db", migrations).build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            start_diagnostics_job, start_security_audit_job, get_background_job, cancel_background_job,
            get_package_sizes, generate_docker_files, check_managers, audit_environments, get_dependency_tree, audit_security,
            check_venv_health, list_outdated_packages, scan_venv, run_venv_script, read_env_file, save_env_file, 
            open_terminal, open_in_vscode, create_venv, list_venvs, delete_venv, 
            install_dependency, get_venv_details, list_system_pythons, uninstall_package, update_package, purge_pip_cache,
            export_requirements, get_pyvenv_cfg, search_pypi
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
