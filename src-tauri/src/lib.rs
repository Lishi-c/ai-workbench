use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use serde::Serialize;
use serde_json::Value;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, RunEvent, WindowEvent,
};
use tauri_plugin_autostart::ManagerExt as _;
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_dialog::DialogExt;
use chrono::Timelike;

static IS_QUITTING: AtomicBool = AtomicBool::new(false);

// ── 路径 ────────────────────────────────────────
// 便携模式：数据放在程序(exe)旁边的 data/ 目录，整包拷贝即可迁移
fn data_dir(_app: &AppHandle) -> Result<PathBuf, String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let exe_dir = exe.parent().ok_or_else(|| "无法确定程序所在目录".to_string())?;
    Ok(exe_dir.join("data"))
}

// 旧版数据存放位置（系统 AppData），仅用于首次迁移
fn legacy_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(|e| e.to_string())
}

// 首次以便携模式启动时，若 exe 旁还没有数据、但 AppData 有旧数据，则整体迁移过去（只拷贝、不删除旧数据）
fn migrate_legacy_data(app: &AppHandle) {
    let Ok(portable) = data_dir(app) else { return };
    let Ok(legacy) = legacy_data_dir(app) else { return };
    if !portable.join("workbench-data.json").exists() && legacy.join("workbench-data.json").exists() {
        let _ = fs::create_dir_all(&portable);
        let _ = copy_dir(&legacy, &portable);
    }
}
fn data_file(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(data_dir(app)?.join("workbench-data.json"))
}
fn content_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(data_dir(app)?.join("content"))
}

fn write_content(app: &AppHandle, kind: &str, id: &str, content: &str) -> Result<(), String> {
    let dir = content_dir(app)?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let file = dir.join(format!("{kind}-{id}.txt"));
    fs::write(&file, content).map_err(|e| e.to_string())
}

// 正文拆分：books/documents 的 content 抽到 content/*.txt，主 JSON 只留 preview
fn split_content(app: &AppHandle, value: &mut Value) {
    for (list_key, kind) in [("books", "book"), ("documents", "doc")] {
        if let Some(arr) = value.get_mut(list_key).and_then(Value::as_array_mut) {
            for item in arr.iter_mut() {
                if let Some(obj) = item.as_object_mut() {
                    let id = obj
                        .get("id")
                        .and_then(Value::as_str)
                        .unwrap_or_default()
                        .to_string();
                    if id.is_empty() {
                        continue;
                    }
                    if let Some(content) = obj.get("content").and_then(Value::as_str) {
                        if !content.is_empty() {
                            let content = content.to_string();
                            if write_content(app, kind, &id, &content).is_ok() {
                                let preview: String = content.chars().take(200).collect();
                                obj.insert("preview".to_string(), Value::String(preview));
                                obj.insert("content".to_string(), Value::String(String::new()));
                            }
                        }
                    }
                }
            }
        }
    }
}

fn read_data(app: &AppHandle) -> Option<Value> {
    let file = data_file(app).ok()?;
    let raw = fs::read_to_string(&file).ok()?;
    serde_json::from_str(&raw).ok()
}

// ── 备份与恢复 ──────────────────────────────────
fn copy_dir(src: &Path, dst: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let from = entry.path();
        let to = dst.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_dir(&from, &to)?;
        } else {
            fs::copy(&from, &to)?;
        }
    }
    Ok(())
}

fn backup_data(app: &AppHandle) {
    let Ok(dir) = data_dir(app) else { return };
    let file = dir.join("workbench-data.json");
    if !file.exists() {
        return;
    }
    let backup_root = dir.join("backups");
    let _ = fs::create_dir_all(&backup_root);
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let backup_dir = backup_root.join(format!("backup-{stamp}"));
    let _ = fs::create_dir_all(&backup_dir);
    let _ = fs::copy(&file, backup_dir.join("workbench-data.json"));
    let content = dir.join("content");
    if content.exists() {
        let _ = copy_dir(&content, &backup_dir.join("content"));
    }
    // 只保留最近 10 份
    let mut dirs: Vec<_> = fs::read_dir(&backup_root)
        .into_iter()
        .flatten()
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path().is_dir() && e.file_name().to_string_lossy().starts_with("backup-")
        })
        .collect();
    dirs.sort_by_key(|e| e.file_name());
    while dirs.len() > 10 {
        if let Some(old) = dirs.first() {
            let _ = fs::remove_dir_all(old.path());
        }
        dirs.remove(0);
    }
}

fn restore_from_backup(app: &AppHandle) -> Option<Value> {
    let dir = data_dir(app).ok()?;
    let backup_root = dir.join("backups");
    let mut dirs: Vec<_> = fs::read_dir(&backup_root)
        .ok()?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().is_dir())
        .collect();
    dirs.sort_by_key(|e| e.file_name());
    for entry in dirs.into_iter().rev() {
        let json = entry.path().join("workbench-data.json");
        if let Ok(raw) = fs::read_to_string(&json) {
            if let Ok(v) = serde_json::from_str::<Value>(&raw) {
                let file = data_file(app).ok()?;
                let _ = fs::write(&file, &raw);
                let content_src = entry.path().join("content");
                if content_src.exists() {
                    if let Ok(cdir) = content_dir(app) {
                        let _ = fs::remove_dir_all(&cdir);
                        let _ = copy_dir(&content_src, &cdir);
                    }
                }
                return Some(v);
            }
        }
    }
    None
}

// ── 数据命令 ────────────────────────────────────
#[derive(Serialize)]
struct LoadResult {
    data: Option<Value>,
    restored: bool,
}

#[tauri::command]
fn load_data(app: AppHandle) -> Result<LoadResult, String> {
    let file = data_file(&app)?;
    if !file.exists() {
        return Ok(LoadResult {
            data: None,
            restored: false,
        });
    }
    match fs::read_to_string(&file) {
        Ok(raw) => match serde_json::from_str::<Value>(&raw) {
            Ok(data) => Ok(LoadResult {
                data: Some(data),
                restored: false,
            }),
            // 损坏：尝试从最近备份恢复
            Err(_) => {
                if let Some(restored) = restore_from_backup(&app) {
                    Ok(LoadResult {
                        data: Some(restored),
                        restored: true,
                    })
                } else {
                    Ok(LoadResult {
                        data: None,
                        restored: false,
                    })
                }
            }
        },
        Err(_) => Ok(LoadResult {
            data: None,
            restored: false,
        }),
    }
}

#[tauri::command]
fn save_data(app: AppHandle, value: Value) -> Result<bool, String> {
    let mut value = value;
    split_content(&app, &mut value);
    let file = data_file(&app)?;
    if let Some(parent) = file.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let raw = serde_json::to_string_pretty(&value).map_err(|e| e.to_string())?;
    let tmp = data_dir(&app)?.join("workbench-data.json.tmp");
    fs::write(&tmp, &raw).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &file).map_err(|e| e.to_string())?;
    // 应用开机自启设置
    let auto_launch = value
        .get("settings")
        .and_then(|s| s.get("autoLaunch"))
        .and_then(Value::as_bool)
        .unwrap_or(true);
    apply_auto_launch(&app, auto_launch);
    Ok(true)
}

#[tauri::command]
fn save_backup(app: AppHandle, json: String, file_name: String) -> Result<Option<String>, String> {
    let mut builder = app
        .dialog()
        .file()
        .set_file_name(&file_name)
        .add_filter("JSON", &["json"]);
    if let Ok(dir) = data_dir(&app) {
        builder = builder.set_directory(dir);
    }
    let Some(picked) = builder.blocking_save_file() else {
        return Ok(None);
    };
    let path = picked.into_path().map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(Some(path.to_string_lossy().into_owned()))
}

#[tauri::command]
fn reveal_in_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let select = format!("/select,{}", path);
        if std::process::Command::new("explorer")
            .arg(select)
            .spawn()
            .is_err()
        {
            if let Some(parent) = std::path::Path::new(&path).parent() {
                let _ = std::process::Command::new("explorer").arg(parent).spawn();
            }
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        if let Some(parent) = std::path::Path::new(&path).parent() {
            let _ = std::process::Command::new("xdg-open").arg(parent).spawn();
        }
    }
    Ok(())
}

fn apply_auto_launch(app: &AppHandle, enabled: bool) {
    let autolaunch = app.autolaunch();
    let _ = if enabled {
        autolaunch.enable()
    } else {
        autolaunch.disable()
    };
}

#[tauri::command]
fn get_content(app: AppHandle, kind: String, id: String) -> Result<String, String> {
    let file = content_dir(&app)?.join(format!("{kind}-{id}.txt"));
    if !file.exists() {
        return Ok(String::new());
    }
    Ok(fs::read_to_string(&file).unwrap_or_default())
}

#[tauri::command]
async fn get_holidays(app: AppHandle, year: i32) -> Result<Value, String> {
    let cache_file = data_dir(&app)?.join(format!("holidays-{year}.json"));
    if let Ok(raw) = fs::read_to_string(&cache_file) {
        if let Ok(v) = serde_json::from_str::<Value>(&raw) {
            return Ok(v);
        }
    }
    let url = format!("https://timor.tech/api/holiday/year/{year}");
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;
    match client.get(&url).send().await {
        Ok(res) => {
            let json: Value = res.json().await.map_err(|e| e.to_string())?;
            if json.get("code").and_then(Value::as_i64) == Some(0) {
                if let Some(holiday_map) = json.get("holiday").and_then(Value::as_object) {
                    let mut result_map = serde_json::Map::new();
                    for (md, v) in holiday_map {
                        let key = format!("{year}-{md}");
                        let holiday = v.get("holiday").and_then(Value::as_bool).unwrap_or(false);
                        let name = v
                            .get("name")
                            .and_then(Value::as_str)
                            .unwrap_or_default()
                            .to_string();
                        result_map
                            .insert(key, serde_json::json!({ "holiday": holiday, "name": name }));
                    }
                    let result = serde_json::json!({ "holiday": result_map });
                    let _ = fs::write(&cache_file, serde_json::to_string_pretty(&result).unwrap_or_default());
                    return Ok(result);
                }
            }
            Ok(serde_json::json!({ "holiday": {} }))
        }
        Err(_) => Ok(serde_json::json!({ "holiday": {} })),
    }
}

// ── 窗口 / 托盘 ─────────────────────────────────
fn show_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_minimized().unwrap_or(false) {
            let _ = window.unminimize();
        }
        let _ = window.show();
        let _ = window.set_focus();
        // Windows 上 hidden 窗口 show 后可能不置顶，用「置顶再取消」强制拉前台
        let _ = window.set_always_on_top(true);
        let _ = window.set_always_on_top(false);
    }
}

fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "打开工作台", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;
    let icon = tauri::include_image!("icons/icon.png");
    let tray = TrayIconBuilder::new()
        .icon(icon)
        .tooltip("月蓝琉璃工作台")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_window(app),
            "quit" => {
                IS_QUITTING.store(true, Ordering::SeqCst);
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_window(tray.app_handle());
            }
        })
        .build(app)?;
    app.manage(tray);
    Ok(())
}

// ── 通知与提醒 ─────────────────────────────────
fn show_notification(app: &AppHandle, title: &str, body: &str) {
    let _ = app
        .notification()
        .builder()
        .title(title)
        .body(body)
        .show();
}

fn minutes_of_day(hm: &str) -> i64 {
    let mut parts = hm.split(':');
    let h: i64 = parts.next().and_then(|s| s.parse().ok()).unwrap_or(0);
    let m: i64 = parts.next().and_then(|s| s.parse().ok()).unwrap_or(0);
    h * 60 + m
}

fn show_startup_reminder(app: &AppHandle) {
    let Some(data) = read_data(app) else { return };
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let task_count = data
        .get("tasks")
        .and_then(Value::as_array)
        .map(|arr| {
            arr.iter()
                .filter(|t| {
                    t.get("date").and_then(Value::as_str) == Some(today.as_str())
                        && !t.get("done").and_then(Value::as_bool).unwrap_or(false)
                })
                .count()
        })
        .unwrap_or(0);
    let schedule_count = data
        .get("schedule")
        .and_then(Value::as_array)
        .map(|arr| {
            arr.iter()
                .filter(|s| s.get("date").and_then(Value::as_str) == Some(today.as_str()))
                .count()
        })
        .unwrap_or(0);
    if task_count + schedule_count > 0 {
        let mut parts = vec![];
        if task_count > 0 {
            parts.push(format!("{task_count} 件待办"));
        }
        if schedule_count > 0 {
            parts.push(format!("{schedule_count} 项日程"));
        }
        show_notification(app, "月蓝琉璃工作台", &format!("今天还有 {}", parts.join("、")));
    }
}

fn check_reminders(app: &AppHandle, today: &str, notified: &mut HashSet<String>) {
    let Some(data) = read_data(app) else { return };
    let now = chrono::Local::now();
    let now_min = (now.hour() * 60 + now.minute()) as i64;
    let advance = data
        .get("settings")
        .and_then(|s| s.get("reminderAdvanceMinutes"))
        .and_then(Value::as_i64)
        .unwrap_or(0);

    if let Some(tasks) = data.get("tasks").and_then(Value::as_array) {
        for t in tasks {
            if t.get("date").and_then(Value::as_str) != Some(today) {
                continue;
            }
            if t.get("done").and_then(Value::as_bool).unwrap_or(false) {
                continue;
            }
            let (Some(id), Some(time)) = (
                t.get("id").and_then(Value::as_str),
                t.get("time").and_then(Value::as_str),
            ) else {
                continue;
            };
            let trigger = minutes_of_day(time) - advance;
            if now_min >= trigger && now_min - trigger <= 30 {
                if notified.insert(id.to_string()) {
                    let title = t.get("title").and_then(Value::as_str).unwrap_or_default();
                    show_notification(app, "待办提醒", &format!("{time} · {title}"));
                }
            }
        }
    }
    if let Some(schedules) = data.get("schedule").and_then(Value::as_array) {
        for s in schedules {
            if s.get("date").and_then(Value::as_str) != Some(today) {
                continue;
            }
            let (Some(id), Some(time)) = (
                s.get("id").and_then(Value::as_str),
                s.get("time").and_then(Value::as_str),
            ) else {
                continue;
            };
            let key = format!("s-{id}");
            let trigger = minutes_of_day(time) - advance;
            if now_min >= trigger && now_min - trigger <= 30 {
                if notified.insert(key) {
                    let title = s.get("title").and_then(Value::as_str).unwrap_or_default();
                    show_notification(app, "日程提醒", &format!("{time} · {title}"));
                }
            }
        }
    }
}

fn spawn_background(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(60));
        interval.tick().await; // 跳过立即触发
        let mut notified: HashSet<String> = HashSet::new();
        let mut notified_day = String::new();
        let mut last_backup_day = String::new();
        loop {
            interval.tick().await;
            let today = chrono::Local::now().format("%Y-%m-%d").to_string();
            if today != last_backup_day {
                last_backup_day = today.clone();
                backup_data(&app);
            }
            if today != notified_day {
                notified_day = today.clone();
                notified.clear();
            }
            check_reminders(&app, &today, &mut notified);
        }
    });
}

// ── 入口 ────────────────────────────────────────
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_window(app);
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            load_data,
            save_data,
            get_content,
            get_holidays,
            save_backup,
            reveal_in_folder
        ])
        .setup(|app| {
            migrate_legacy_data(app.handle());
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            setup_tray(app)?;
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(Duration::from_secs(3)).await;
                show_startup_reminder(&handle);
            });
            spawn_background(app.handle().clone());
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if !IS_QUITTING.load(Ordering::SeqCst) {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        if let RunEvent::Exit = event {
            backup_data(app_handle);
        }
    });
}
