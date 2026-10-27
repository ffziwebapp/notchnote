//! NotchNote - notch produktivitas untuk Windows (versi Rust/Tauri).
//! Antarmuka ada di folder ui/ (sama dengan versi Python). Data di %APPDATA%\NotchNote.

mod ai;
mod clips;
mod lyrics;
mod media;
mod sound;
mod store;
mod sys;
mod tracker;
mod window;

use base64::Engine;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::Sender;
use std::sync::{Arc, Mutex};
use store::{jbool, jf64, jget, jstr, log, now_s, p, read_json, write_json};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

pub struct Core {
    pub app: AppHandle,
    pub cfg: Mutex<Value>,
    secrets: Mutex<Value>,
    tracker: Mutex<tracker::Tracker>,
    pub win: Mutex<window::WinState>,
    clips: Mutex<clips::Clips>,
    media_tx: Mutex<Option<Sender<String>>>,
    media_last: Arc<Mutex<media::Last>>,
    ai_cancel: Mutex<HashMap<String, Arc<AtomicBool>>>,
    ready: AtomicBool,
    weather_at: Mutex<f64>,
}

const STORES: &[&str] = &["config", "tasks", "notes", "chat", "ui", "logbook"];
const PROVIDERS: &[&str] = &["claude", "openai", "gemini", "groq", "openrouter"];

impl Core {
    pub fn window(&self) -> Option<WebviewWindow> {
        self.app.get_webview_window("main")
    }

    fn emit(&self, name: &str, payload: String) {
        let _ = self.app.emit(name, payload);
    }

    fn emitter(self: &Arc<Self>) -> lyrics::Emit {
        let h = self.app.clone();
        Arc::new(move |name: &str, payload: String| {
            let _ = h.emit(name, payload);
        })
    }

    // ---------------------------------------------------------------- API key
    fn get_key(&self, provider: &str) -> String {
        let v = jstr(&self.secrets.lock().unwrap(), &[provider]);
        if v.is_empty() {
            return String::new();
        }
        let b64 = base64::engine::general_purpose::STANDARD;
        let r = if let Some(rest) = v.strip_prefix("plain:") {
            b64.decode(rest).ok()
        } else {
            b64.decode(&v).ok().and_then(|b| sys::dpapi(&b, false))
        };
        r.and_then(|b| String::from_utf8(b).ok()).unwrap_or_else(|| {
            log(format!("key {} tidak bisa dibaca", provider));
            String::new()
        })
    }

    fn api_status(&self) -> Value {
        let mut out = json!({});
        for k in PROVIDERS {
            let key = self.get_key(k);
            if !key.is_empty() {
                let tail: String = key.chars().rev().take(4).collect::<Vec<_>>().into_iter().rev().collect();
                out[*k] = json!(format!("…{}", tail));
            }
        }
        out
    }

    fn set_api_key(&self, provider: &str, key: &str) -> String {
        if PROVIDERS.contains(&provider) {
            let key = key.trim();
            let b64 = base64::engine::general_purpose::STANDARD;
            {
                let mut s = self.secrets.lock().unwrap();
                if !s.is_object() {
                    *s = json!({});
                }
                if key.is_empty() {
                    s.as_object_mut().unwrap().remove(provider);
                } else {
                    s[provider] = json!(match sys::dpapi(key.as_bytes(), true) {
                        Some(enc) => b64.encode(enc),
                        None => format!("plain:{}", b64.encode(key.as_bytes())),
                    });
                }
                write_json(&p(&["secrets.json"]), &s);
            }
        }
        let st = self.api_status().to_string();
        self.emit("apiStatus", st.clone());
        st
    }

    // ---------------------------------------------------------------- data
    fn init_payload(&self) -> Value {
        let lay = {
            let ws = self.win.lock().unwrap();
            let mut l = ws.layout.clone();
            if l.get("dock").is_none() {
                l = json!({"dock": jstr(&ws.st, &["dock"]), "ax": 720, "ay": 0, "grow": "down", "scr": {"x": 0, "y": 0, "w": 1440, "h": 900}});
            }
            l["dragging"] = json!(false);
            l
        };
        json!({
            "version": store::VERSION, "platform": if cfg!(windows) { "win" } else { "other" },
            "appPath": std::env::current_exe().ok().and_then(|e| e.parent().map(|d| d.to_string_lossy().to_string())).unwrap_or_default(),
            "config": self.cfg.lock().unwrap().clone(), "ui": read_json(&p(&["ui.json"]), json!({})),
            "tasks": read_json(&p(&["tasks.json"]), json!([])), "notes": read_json(&p(&["notes.json"]), json!([])),
            "chat": read_json(&p(&["chat.json"]), json!({"messages": []})),
            "logbook": read_json(&p(&["logbook.json"]), json!({"entries": []})),
            "clips": self.clips.lock().unwrap().public(), "api": self.api_status(), "layout": lay,
        })
    }

    fn save_store(self: &Arc<Self>, name: &str, data: &str) -> bool {
        if !STORES.contains(&name) {
            return false;
        }
        let Ok(obj) = serde_json::from_str::<Value>(data) else { return false };
        let ok = write_json(&p(&[&format!("{}.json", name)]), &obj);
        if name == "config" {
            let old = std::mem::replace(&mut *self.cfg.lock().unwrap(), obj);
            self.apply_cfg(Some(&old));
        }
        ok
    }

    fn apply_cfg(self: &Arc<Self>, old: Option<&Value>) {
        let c = self.cfg.lock().unwrap().clone();
        self.tracker.lock().unwrap().cfg = jget(&c, &["focus"]).cloned().unwrap_or(json!({}));
        let Some(old) = old else { return };
        if jf64(old, &["theme", "scale"], 100.0) != jf64(&c, &["theme", "scale"], 100.0) {
            window::apply_zoom(self, window::zoom_of(&c));
        }
        if jbool(old, &["general", "hotkeys"], true) != jbool(&c, &["general", "hotkeys"], true) {
            update_hotkeys(self);
        }
        if jget(old, &["prayer", "lat"]) != jget(&c, &["prayer", "lat"]) || jbool(old, &["general", "weather"], true) != jbool(&c, &["general", "weather"], true) {
            *self.weather_at.lock().unwrap() = 0.0;
        }
    }

    fn battery(&self) -> Value {
        match sys::battery() {
            Some((pct, plugged)) => json!({"battery": pct, "plugged": plugged}),
            None => json!({"battery": null}),
        }
    }

    fn fetch_weather(self: &Arc<Self>) {
        let c = self.cfg.lock().unwrap().clone();
        let (lat, lon) = (jf64(&c, &["prayer", "lat"], -6.1667), jf64(&c, &["prayer", "lon"], 106.8167));
        let e = self.emitter();
        std::thread::spawn(move || {
            let url = format!("https://api.open-meteo.com/v1/forecast?latitude={}&longitude={}&current=temperature_2m,weather_code,is_day&timezone=auto", lat, lon);
            match store::http_json(&url, 10) {
                Ok(j) => {
                    let cur = &j["current"];
                    let code = cur["weather_code"].as_i64().unwrap_or(0);
                    let day = cur["is_day"].as_i64().unwrap_or(1);
                    let icon = if code == 0 {
                        if day == 1 { "sun" } else { "moon" }
                    } else if code == 1 || code == 2 {
                        "cloud-sun"
                    } else if code == 3 {
                        "cloud"
                    } else if code == 45 || code == 48 {
                        "fog"
                    } else if code >= 95 {
                        "storm"
                    } else if (51..=67).contains(&code) || (80..=82).contains(&code) {
                        "rain"
                    } else {
                        "cloud"
                    };
                    e("status", json!({"weather": {"temp": cur["temperature_2m"], "icon": icon, "code": code}}).to_string());
                }
                Err(err) => log(format!("weather {}", err)),
            }
        });
    }

    fn on_ready(self: &Arc<Self>) {
        if self.ready.swap(true, Ordering::SeqCst) {
            return;
        }
        window::place(self, false);
        window::show(self);
        update_hotkeys(self);
        // musik
        let (tx, rx) = std::sync::mpsc::channel::<String>();
        *self.media_tx.lock().unwrap() = Some(tx);
        let (e, last) = (self.emitter(), self.media_last.clone());
        std::thread::spawn(move || media::run(e, rx, last));
        // detik
        let c = self.clone();
        std::thread::spawn(move || second_loop(c));
        // clipboard
        let c = self.clone();
        std::thread::spawn(move || clip_loop(c));
        let st = self.tracker.lock().unwrap().stats_json();
        self.emit("stats", st);
        self.emit("status", self.battery().to_string());
    }

    fn media_cmd(&self, c: String) {
        if let Some(tx) = self.media_tx.lock().unwrap().as_ref() {
            let _ = tx.send(c);
        }
    }
}

fn second_loop(core: Arc<Core>) {
    let mut ticks: u64 = 0;
    loop {
        std::thread::sleep(std::time::Duration::from_secs(1));
        ticks += 1;
        let (tj, sj) = {
            let mut t = core.tracker.lock().unwrap();
            t.tick();
            let sj = if ticks % 10 == 0 { Some(t.stats_json()) } else { None };
            if ticks % 30 == 0 {
                t.save();
            }
            (t.track_json(), sj)
        };
        core.emit("track", tj);
        if let Some(s) = sj {
            core.emit("stats", s);
        }
        if ticks % 30 == 0 {
            core.emit("status", core.battery().to_string());
        }
        if ticks % 2 == 0 {
            window::keep_top(&core);
        }
        if ticks % 3 == 0 {
            window::check_monitors(&core);
        }
        window::check_fullscreen(&core);
        let weather_on = jbool(&core.cfg.lock().unwrap(), &["general", "weather"], true);
        let due = { now_s() - *core.weather_at.lock().unwrap() > 1800.0 };
        if weather_on && due {
            *core.weather_at.lock().unwrap() = now_s();
            core.fetch_weather();
        }
    }
}

fn clip_loop(core: Arc<Core>) {
    if !cfg!(windows) {
        return;
    }
    let mut seq = sys::clipboard_seq();
    loop {
        std::thread::sleep(std::time::Duration::from_millis(250));
        let s = sys::clipboard_seq();
        if s == seq {
            continue;
        }
        seq = s;
        std::thread::sleep(std::time::Duration::from_millis(180));
        seq = sys::clipboard_seq().max(seq);
        let cfg = jget(&core.cfg.lock().unwrap(), &["clip"]).cloned().unwrap_or(json!({}));
        let (res, public) = {
            let mut c = core.clips.lock().unwrap();
            let r = c.capture(&cfg);
            let pb = c.public();
            (r, pb)
        };
        match res {
            clips::Captured::None => {}
            clips::Captured::Changed => core.emit("clips", public.to_string()),
            clips::Captured::NewImage(item) => {
                core.emit("clips", public.to_string());
                core.emit("clipNew", item.to_string());
                window::force_show(&core);
            }
        }
    }
}

// -------------------------------------------------------------------- pintasan keyboard
fn update_hotkeys(core: &Core) {
    use tauri_plugin_global_shortcut::GlobalShortcutExt;
    let gs = core.app.global_shortcut();
    let _ = gs.unregister_all();
    if jbool(&core.cfg.lock().unwrap(), &["general", "hotkeys"], true) {
        for (_, sc) in hotkeys() {
            if let Err(e) = gs.register(sc) {
                log(format!("hotkey: pintasan dipakai aplikasi lain {}", e));
            }
        }
    }
}

fn hotkeys() -> Vec<(&'static str, tauri_plugin_global_shortcut::Shortcut)> {
    use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut};
    let m = Some(Modifiers::CONTROL | Modifiers::ALT);
    vec![("ai", Shortcut::new(m, Code::Space)), ("note", Shortcut::new(m, Code::KeyN)), ("todo", Shortcut::new(m, Code::KeyT)), ("toggle", Shortcut::new(m, Code::KeyH))]
}

// -------------------------------------------------------------------- jembatan antarmuka
fn a_str(a: &[Value], i: usize) -> String {
    a.get(i).map(|v| v.as_str().map(String::from).unwrap_or_else(|| if v.is_null() { String::new() } else { v.to_string() })).unwrap_or_default()
}
fn a_f64(a: &[Value], i: usize) -> f64 {
    a.get(i).and_then(|v| v.as_f64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0.0)
}
fn a_bool(a: &[Value], i: usize) -> bool {
    a.get(i).and_then(|v| v.as_bool()).unwrap_or(false)
}

fn save_dialog(core: &Core, title: &str, dir: Option<std::path::PathBuf>, name: &str, filters: &[(&str, &[&str])]) -> Option<std::path::PathBuf> {
    use tauri_plugin_dialog::DialogExt;
    let mut d = core.app.dialog().file().set_title(title).set_file_name(name);
    if let Some(dir) = dir {
        d = d.set_directory(dir);
    }
    for (n, ext) in filters {
        d = d.add_filter(*n, ext);
    }
    d.blocking_save_file().and_then(|f| f.into_path().ok())
}

fn home() -> std::path::PathBuf {
    std::env::var_os("USERPROFILE").or_else(|| std::env::var_os("HOME")).map(std::path::PathBuf::from).unwrap_or_default()
}

/// Satu pintu untuk semua panggilan dari antarmuka: nama & argumennya sama dengan versi Python.
#[tauri::command]
async fn call(name: String, args: Vec<Value>, state: tauri::State<'_, Arc<Core>>) -> Result<Value, String> {
    let core: Arc<Core> = state.inner().clone();
    let a = &args;
    let r: Value = match name.as_str() {
        "init" => json!(core.init_payload().to_string()),
        "save" => json!(core.save_store(&a_str(a, 0), &a_str(a, 1))),
        "ready" => {
            core.on_ready();
            Value::Null
        }
        "setRect" => {
            window::set_rect(&core, a_f64(a, 0), a_f64(a, 1), a_f64(a, 2), a_f64(a, 3));
            Value::Null
        }
        "dragStart" => {
            window::drag_start(&core, a_f64(a, 0), a_f64(a, 1));
            Value::Null
        }
        "dragEnd" => {
            window::drag_end(&core);
            Value::Null
        }
        "setDock" => {
            window::set_dock(&core, &a_str(a, 0));
            Value::Null
        }
        "activate" => {
            window::activate(&core);
            Value::Null
        }
        "attention" => {
            window::force_show(&core);
            Value::Null
        }
        "openUrl" => {
            let u = a_str(a, 0);
            if u.starts_with("http://") || u.starts_with("https://") {
                use tauri_plugin_opener::OpenerExt;
                let _ = core.app.opener().open_url(u, None::<&str>);
            }
            Value::Null
        }
        "copyText" => {
            core.clips.lock().unwrap().copy_text(&a_str(a, 0));
            Value::Null
        }
        "copyClip" => {
            core.clips.lock().unwrap().copy(&a_str(a, 0));
            Value::Null
        }
        "deleteClip" | "pinClip" | "clearClips" => {
            let pb = {
                let mut c = core.clips.lock().unwrap();
                match name.as_str() {
                    "deleteClip" => c.delete(&a_str(a, 0)),
                    "pinClip" => c.pin(&a_str(a, 0), a_bool(a, 1)),
                    _ => c.clear(),
                }
                c.public()
            };
            core.emit("clips", pb.to_string());
            Value::Null
        }
        "saveClip" => {
            let src = core.clips.lock().unwrap().image_path(&a_str(a, 0));
            let Some(src) = src else { return Ok(json!("")) };
            let pics = home().join("Pictures");
            let name = format!("NotchNote-{}.png", chrono::Local::now().format("%Y%m%d-%H%M%S"));
            match save_dialog(&core, "Simpan gambar", Some(pics), &name, &[("PNG", &["png"]), ("JPEG", &["jpg", "jpeg"])]) {
                Some(mut path) => {
                    let ext = path.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
                    let ok = if ext == "jpg" || ext == "jpeg" {
                        image::open(&src).ok().map(|i| i.to_rgb8().save(&path).is_ok()).unwrap_or(false)
                    } else {
                        if ext != "png" {
                            path.set_extension("png");
                        }
                        std::fs::copy(&src, &path).is_ok()
                    };
                    json!(if ok { path.to_string_lossy().to_string() } else { String::new() })
                }
                None => json!(""),
            }
        }
        "openClip" => {
            if let Some(path) = core.clips.lock().unwrap().image_path(&a_str(a, 0)) {
                use tauri_plugin_opener::OpenerExt;
                let _ = core.app.opener().open_path(path.to_string_lossy().to_string(), None::<&str>);
            }
            Value::Null
        }
        "statsRange" => json!(core.tracker.lock().unwrap().range_json(&a_str(a, 0), &a_str(a, 1))),
        "saveReport" => {
            let re = regex::Regex::new(r#"[\\/:*?"<>|]+"#).unwrap();
            let mut name = re.replace_all(&a_str(a, 0), "-").to_string();
            if name.is_empty() {
                name = "Logbook.csv".into();
            }
            let content = a_str(a, 1);
            let docs = home().join("Documents");
            let filters: Vec<(&str, &[&str])> =
                if name.to_lowercase().ends_with(".csv") { vec![("Excel CSV", &["csv"]), ("Teks", &["txt"])] } else { vec![("Teks", &["txt"]), ("Excel CSV", &["csv"])] };
            match save_dialog(&core, "Simpan laporan logbook", Some(docs), &name, &filters) {
                Some(path) => {
                    let mut b = vec![0xEF, 0xBB, 0xBF];
                    b.extend_from_slice(content.as_bytes());
                    match std::fs::write(&path, b) {
                        Ok(_) => json!(path.to_string_lossy().to_string()),
                        Err(e) => {
                            log(format!("save_report {}", e));
                            json!("")
                        }
                    }
                }
                None => json!(""),
            }
        }
        "mediaCmd" => {
            core.media_cmd(a_str(a, 0));
            Value::Null
        }
        "seek" => {
            core.media_cmd(format!("seek:{}", a_f64(a, 0)));
            Value::Null
        }
        "lyricsRetry" => {
            let l = core.media_last.lock().unwrap().clone();
            if let Some((t, ar)) = l.key.split_once('|') {
                let (e, t, ar) = (core.emitter(), t.to_string(), ar.to_string());
                std::thread::spawn(move || lyrics::fetch(&e, &t, &ar, &l.album, l.dur, true));
            }
            Value::Null
        }
        "lyricsSearch" => {
            let k = core.media_last.lock().unwrap().key.clone();
            let q = a_str(a, 0).trim().to_string();
            if !k.is_empty() && !q.is_empty() {
                let e = core.emitter();
                std::thread::spawn(move || lyrics::search(&e, &k, &q));
            }
            Value::Null
        }
        "lyricsPick" => {
            let k = core.media_last.lock().unwrap().key.clone();
            let id = a_f64(a, 0) as i64;
            if !k.is_empty() {
                let e = core.emitter();
                std::thread::spawn(move || lyrics::pick(&e, &k, id));
            }
            Value::Null
        }
        "aiSend" => {
            let (rid, provider, model, history, system) = (a_str(a, 0), a_str(a, 1), a_str(a, 2), a_str(a, 3), a_str(a, 4));
            let key = core.get_key(&provider);
            if key.is_empty() && provider != "ollama" {
                core.emit("ai", json!({"id": rid, "type": "error", "text": "API key belum diatur."}).to_string());
            } else {
                let msgs = serde_json::from_str::<Value>(&history).unwrap_or(json!([]));
                let ev = Arc::new(AtomicBool::new(false));
                {
                    let mut m = core.ai_cancel.lock().unwrap();
                    m.retain(|_, v| !v.load(Ordering::Relaxed));
                    m.insert(rid.clone(), ev.clone());
                }
                let c = core.cfg.lock().unwrap().clone();
                let (ws, ol) = (jstr(&c, &["ai", "workspace"]).trim().to_string(), jstr(&c, &["ai", "ollamaUrl"]).trim().to_string());
                let e = core.emitter();
                std::thread::spawn(move || ai::stream(e, rid, provider, model, key, msgs, system, ev, ws, ol));
            }
            Value::Null
        }
        "aiCancel" => {
            if let Some(ev) = core.ai_cancel.lock().unwrap().get(&a_str(a, 0)) {
                ev.store(true, Ordering::Relaxed);
            }
            Value::Null
        }
        "setApiKey" => json!(core.set_api_key(&a_str(a, 0), &a_str(a, 1))),
        "playSound" => {
            sound::play(&a_str(a, 0), &a_str(a, 1), a_bool(a, 2), a_f64(a, 3) as i64);
            Value::Null
        }
        "stopSound" => {
            sound::stop();
            Value::Null
        }
        "pickSound" => {
            use tauri_plugin_dialog::DialogExt;
            let f = core.app.dialog().file().set_title("Pilih suara (.wav)").set_directory(home()).add_filter("Audio WAV", &["wav"]).blocking_pick_file();
            json!(f.and_then(|f| f.into_path().ok()).map(|p| p.to_string_lossy().to_string()).unwrap_or_default())
        }
        "getAutostart" => json!(sys::reg_get(store::APP).is_some()),
        "setAutostart" => json!(sys::set_autostart(a_bool(a, 0))),
        "openDataFolder" => {
            use tauri_plugin_opener::OpenerExt;
            let _ = core.app.opener().open_path(store::data_dir().to_string_lossy().to_string(), None::<&str>);
            Value::Null
        }
        "quit" => {
            shutdown(&core);
            core.app.exit(0);
            Value::Null
        }
        "resetStats" | "addPomodoro" => {
            let s = {
                let mut t = core.tracker.lock().unwrap();
                if name == "resetStats" { t.reset() } else { t.add_pomodoro() }
                t.stats_json()
            };
            core.emit("stats", s);
            Value::Null
        }
        other => {
            log(format!("panggilan tidak dikenal: {}", other));
            Value::Null
        }
    };
    Ok(r)
}

fn shutdown(core: &Core) {
    sound::stop();
    core.tracker.lock().unwrap().save();
    use tauri_plugin_global_shortcut::GlobalShortcutExt;
    let _ = core.app.global_shortcut().unregister_all();
}

fn toggle_from_outside(core: &Core) {
    window::force_show(core);
    window::activate(core);
    core.emit("hotkey", "toggle".into());
}

// -------------------------------------------------------------------- mulai
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    std::panic::set_hook(Box::new(|info| log(format!("PANIC {}", info))));
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(core) = app.try_state::<Arc<Core>>() {
                toggle_from_outside(&core);
            }
        }))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, sc, ev| {
                    use tauri_plugin_global_shortcut::ShortcutState;
                    if ev.state() != ShortcutState::Pressed {
                        return;
                    }
                    let Some(core) = app.try_state::<Arc<Core>>() else { return };
                    if let Some((name, _)) = hotkeys().into_iter().find(|(_, s)| s == sc) {
                        window::force_show(&core);
                        window::activate(&core);
                        core.emit("hotkey", name.into());
                    }
                })
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![call])
        .setup(|app| {
            // versi Python lama: tutup, dan pindahkan autostart ke aplikasi ini
            let n = sys::stop_python_copies();
            if n > 0 {
                std::thread::sleep(std::time::Duration::from_millis(600));
            }
            sys::fix_autostart();

            let cfg = read_json(&p(&["config.json"]), json!({}));
            let zoom = window::zoom_of(&cfg);
            let core = Arc::new(Core {
                app: app.handle().clone(),
                cfg: Mutex::new(cfg),
                secrets: Mutex::new(read_json(&p(&["secrets.json"]), json!({}))),
                tracker: Mutex::new(tracker::Tracker::new()),
                win: Mutex::new(window::WinState::new(zoom)),
                clips: Mutex::new(clips::Clips::load()),
                media_tx: Mutex::new(None),
                media_last: Arc::new(Mutex::new(media::Last::default())),
                ai_cancel: Mutex::new(HashMap::new()),
                ready: AtomicBool::new(false),
                weather_at: Mutex::new(0.0),
            });
            core.apply_cfg(None);
            app.manage(core.clone());

            // gambar sampul lagu & screenshot dibuka lewat protokol aset
            let _ = app.asset_protocol_scope().allow_directory(store::data_dir(), true);

            #[allow(unused_mut)]
            let mut b = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("NotchNote")
                .decorations(false)
                .transparent(true)
                .shadow(false)
                .always_on_top(true)
                .skip_taskbar(true)
                .resizable(false)
                .visible(false)
                .focused(false)
                .inner_size(window::CSS_W * zoom, window::CSS_H * zoom)
                .on_navigation(|url| {
                    let host = url.host_str().unwrap_or("");
                    let internal = url.scheme() == "tauri" || host == "tauri.localhost" || host == "asset.localhost" || host == "localhost" || host == "ipc.localhost";
                    if !internal && (url.scheme() == "http" || url.scheme() == "https") {
                        let _ = tauri_plugin_opener::open_url(url.as_str(), None::<&str>);
                        return false;
                    }
                    true
                });
            #[cfg(windows)]
            {
                b = b.additional_browser_args(
                    "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows --autoplay-policy=no-user-gesture-required",
                );
            }
            let w = b.build()?;
            let _ = w.set_zoom(zoom);
            let c2 = core.clone();
            w.on_window_event(move |ev| {
                if let tauri::WindowEvent::Focused(f) = ev {
                    let _ = c2.app.emit("active", *f);
                }
            });

            // ikon di tray
            let h = app.handle();
            let menu = Menu::with_items(
                h,
                &[
                    &MenuItem::with_id(h, "toggle", "Buka atau tutup notch", true, None::<&str>)?,
                    &MenuItem::with_id(h, "settings", "Pengaturan", true, None::<&str>)?,
                    &MenuItem::with_id(h, "reset", "Kembalikan ke tengah atas", true, None::<&str>)?,
                    &PredefinedMenuItem::separator(h)?,
                    &MenuItem::with_id(h, "quit", "Keluar", true, None::<&str>)?,
                ],
            )?;
            let mut tray = TrayIconBuilder::with_id("main").tooltip("NotchNote").menu(&menu).show_menu_on_left_click(false);
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.on_menu_event(|app, ev| {
                let Some(core) = app.try_state::<Arc<Core>>() else { return };
                match ev.id().as_ref() {
                    "toggle" => {
                        window::force_show(&core);
                        core.emit("hotkey", "toggle".into());
                    }
                    "settings" => {
                        window::force_show(&core);
                        window::activate(&core);
                        core.emit("hotkey", "settings".into());
                    }
                    "reset" => window::set_dock(&core, "reset"),
                    "quit" => {
                        shutdown(&core);
                        app.exit(0);
                    }
                    _ => {}
                }
            })
            .on_tray_icon_event(|tray, ev| {
                if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = ev {
                    if let Some(core) = tray.app_handle().try_state::<Arc<Core>>() {
                        window::force_show(&core);
                        core.emit("hotkey", "toggle".into());
                    }
                }
            })
            .build(h)?;

            // seret, klik-tembus, dan kursor
            let c3 = core.clone();
            std::thread::spawn(move || window::ui_loop(c3));
            // uji otomatis (hanya build debug): laporkan keadaan antarmuka ke ui.json
            #[cfg(debug_assertions)]
            if std::env::var("NOTCHNOTE_SELFTEST").is_ok() {
                let w2 = w.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_secs(8));
                    let _ = w2.eval("NN.open('logbook'); setTimeout(()=>NN.call('save','ui',JSON.stringify({selftest:true, ready:NN.ready, view:NN.isl.view, page:NN.isl.page, dock:NN.isl.layout.dock, scr:NN.isl.layout.scr, pages:NN.cfg.notch.pages, tasks:NN.st.tasks.length, lb:document.querySelectorAll('.lbrow').length, version:NN.init.version, clips:NN.pages.clip?1:0})), 1500)");
                });
            }
            // cadangan: kalau antarmuka tidak memanggil "ready" (misal error), tetap tampilkan setelah 5 detik
            let c4 = core.clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_secs(5));
                c4.on_ready();
            });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("gagal memulai NotchNote")
        .run(|app, ev| {
            if let tauri::RunEvent::ExitRequested { api, code, .. } = &ev {
                // jendela notch tidak punya tombol tutup; tetap jalan di tray kecuali Keluar dipilih
                if code.is_none() {
                    api.prevent_exit();
                }
            }
            if let tauri::RunEvent::Exit = ev {
                if let Some(core) = app.try_state::<Arc<Core>>() {
                    shutdown(&core);
                }
            }
        });
}
