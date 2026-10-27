//! Jendela notch: posisi menempel (atas/bawah/kiri/kanan) atau melayang, seret, klik-tembus, kursor untuk mata Notnot.
//!
//! Jendelanya selalu seukuran kanvas CSS 1440x960 (dikali zoom). Antarmuka melaporkan kotak notch (setRect);
//! di luar kotak itu jendela dibuat tembus klik, jadi aplikasi di belakangnya tetap bisa dipakai.

use crate::store::{jbool, jf64, jstr, log, now_s, p, write_json};
use crate::Core;
use serde_json::{json, Value};
use tauri::{Emitter, PhysicalPosition, PhysicalSize};

pub const CSS_W: f64 = 1440.0;
pub const CSS_H: f64 = 960.0;

#[derive(Clone, Debug)]
pub struct Mon {
    pub name: String,
    pub full: (f64, f64, f64, f64),
    pub work: (f64, f64, f64, f64),
    pub sf: f64,
}

pub struct Drag {
    off: (f64, f64),
    dock: Option<String>,
    sname: String,
    along: Option<f64>,
    center: (f64, f64),
    mon: Option<Mon>,
    last: Option<String>,
}

pub struct WinState {
    pub st: Value,
    pub zoom: f64,
    pub sf: f64,
    pub pos: (f64, f64),
    pub drag: Option<Drag>,
    pub rect: Option<[f64; 4]>,
    pub fs_hidden: bool,
    pub force_until: f64,
    pub last_cursor: Option<(i64, i64)>,
    pub ignoring: Option<bool>,
    pub layout: Value,
    pub mon_sig: String,
    pub visible: bool,
}

impl WinState {
    pub fn new(zoom: f64) -> Self {
        let mut st = crate::store::read_json(&p(&["state.json"]), json!({}));
        if !st.is_object() {
            st = json!({});
        }
        for (k, v) in [("dock", json!("top")), ("along", json!(0.5)), ("fx", json!(0.5)), ("fy", json!(0.2))] {
            if st.get(k).is_none() {
                st[k] = v;
            }
        }
        WinState { st, zoom, sf: 0.0, pos: (0.0, 0.0), drag: None, rect: None, fs_hidden: false, force_until: 0.0, last_cursor: None,
            ignoring: None, layout: json!({}), mon_sig: String::new(), visible: false }
    }
}

pub fn zoom_of(cfg: &Value) -> f64 {
    (jf64(cfg, &["theme", "scale"], 100.0) / 100.0).clamp(0.75, 1.5)
}

pub fn monitors(core: &Core) -> Vec<Mon> {
    let Some(w) = core.window() else { return vec![] };
    w.available_monitors()
        .unwrap_or_default()
        .iter()
        .map(|m| {
            let (pos, size, wa) = (m.position(), m.size(), m.work_area());
            Mon {
                name: m.name().cloned().unwrap_or_default(),
                full: (pos.x as f64, pos.y as f64, size.width as f64, size.height as f64),
                work: (wa.position.x as f64, wa.position.y as f64, wa.size.width as f64, wa.size.height as f64),
                sf: m.scale_factor(),
            }
        })
        .collect()
}

fn primary(core: &Core) -> Option<Mon> {
    let w = core.window()?;
    let pm = w.primary_monitor().ok()??;
    let n = pm.name().cloned().unwrap_or_default();
    monitors(core).into_iter().find(|m| m.name == n)
}

pub fn screen_in(all: &[Mon], prim: Option<Mon>, ws: &WinState) -> Option<Mon> {
    let name = jstr(&ws.st, &["screen"]);
    all.iter().find(|m| !name.is_empty() && m.name == name).cloned().or(prim).or_else(|| all.first().cloned())
}

/// Posisi jendela (piksel fisik) + info tata letak untuk antarmuka (piksel CSS)
pub fn layout_for(ws: &WinState, dock: &str, m: &Mon, along: Option<f64>, center: Option<(f64, f64)>) -> ((f64, f64), Value) {
    let (gx, gy, gw, gh) = m.work;
    let z = ws.zoom * m.sf;
    let (w, h) = (CSS_W * z, CSS_H * z);
    let mut grow = "down";
    let along_v = along.unwrap_or_else(|| jf64(&ws.st, &["along"], 0.5));
    let (x, y, ax, ay);
    match dock {
        "top" | "bottom" => {
            let cx = gx + along_v * gw;
            x = cx - w / 2.0;
            y = if dock == "top" { gy } else { gy + gh - h };
            ax = CSS_W / 2.0;
            ay = if dock == "top" { 0.0 } else { CSS_H };
        }
        "left" | "right" => {
            let cy = gy + along_v * gh;
            y = cy - h / 2.0;
            x = if dock == "left" { gx } else { gx + gw - w };
            ax = if dock == "left" { 0.0 } else { CSS_W };
            ay = CSS_H / 2.0;
        }
        _ => {
            let c = center.unwrap_or((gx + jf64(&ws.st, &["fx"], 0.5) * gw, gy + jf64(&ws.st, &["fy"], 0.2) * gh));
            x = c.0 - w / 2.0;
            y = c.1 - h / 2.0;
            ax = CSS_W / 2.0;
            ay = CSS_H / 2.0;
            grow = if c.1 < gy + gh / 2.0 { "down" } else { "up" };
        }
    }
    let lay = json!({"dock": dock, "ax": ax, "ay": ay, "grow": grow,
        "scr": {"x": (gx - x) / z, "y": (gy - y) / z, "w": gw / z, "h": gh / z}});
    ((x.round(), y.round()), lay)
}

/// Hitung perpindahan (tanpa menyentuh jendela; dipanggil sambil memegang kunci)
fn plan_move(ws: &mut WinState, pos: (f64, f64), sf: f64) -> (Option<(u32, u32)>, (i32, i32)) {
    let z = ws.zoom * sf;
    let size = if (sf - ws.sf).abs() > 1e-6 { Some(((CSS_W * z).round() as u32, (CSS_H * z).round() as u32)) } else { None };
    ws.sf = sf;
    ws.pos = pos;
    (size, (pos.0 as i32, pos.1 as i32))
}

/// Terapkan perpindahan (dipanggil SETELAH kunci dilepas)
fn apply_move(core: &Core, mv: (Option<(u32, u32)>, (i32, i32))) {
    let Some(w) = core.window() else { return };
    if let Some((a, b)) = mv.0 {
        let _ = w.set_size(PhysicalSize::new(a, b));
    }
    let _ = w.set_position(PhysicalPosition::new(mv.1 .0, mv.1 .1));
}

pub fn place(core: &Core, dragging: bool) {
    let all = monitors(core);
    let prim = primary(core);
    let mut ws = core.win.lock().unwrap();
    let Some(m) = screen_in(&all, prim, &ws) else { return };
    let dock = jstr(&ws.st, &["dock"]);
    let (pos, mut lay) = layout_for(&ws, if dock.is_empty() { "top" } else { &dock }, &m, None, None);
    let mv = plan_move(&mut ws, pos, m.sf);
    lay["dragging"] = json!(dragging);
    ws.layout = lay.clone();
    drop(ws);
    apply_move(core, mv);
    let _ = core.app.emit("layout", lay.to_string());
}

/// Ukuran berubah (Pengaturan → Tampilan → Ukuran notch)
pub fn apply_zoom(core: &Core, zoom: f64) {
    {
        let mut ws = core.win.lock().unwrap();
        ws.zoom = zoom;
        ws.sf = 0.0; // paksa ukuran dihitung ulang
    }
    if let Some(w) = core.window() {
        let _ = w.set_zoom(zoom);
    }
    place(core, false);
}

pub fn save_state(ws: &WinState) {
    write_json(&p(&["state.json"]), &ws.st);
}

pub fn set_dock(core: &Core, dock: &str) {
    let prim = primary(core);
    {
        let mut ws = core.win.lock().unwrap();
        if dock == "reset" {
            ws.st["dock"] = json!("top");
            ws.st["along"] = json!(0.5);
            if let Some(pm) = prim {
                ws.st["screen"] = json!(pm.name);
            }
        } else if ["top", "bottom", "left", "right", "float"].contains(&dock) {
            ws.st["dock"] = json!(dock);
            ws.st["along"] = json!(0.5);
            if dock == "float" {
                ws.st["fx"] = json!(0.5);
                ws.st["fy"] = json!(0.18);
            }
        }
        save_state(&ws);
    }
    place(core, false);
}

fn cursor(core: &Core) -> Option<(f64, f64)> {
    core.app.cursor_position().ok().map(|c| (c.x, c.y))
}

pub fn drag_start(core: &Core, ox: f64, oy: f64) {
    let mut ws = core.win.lock().unwrap();
    let z = ws.zoom * ws.sf.max(0.5);
    ws.drag = Some(Drag { off: (ox * z, oy * z), dock: None, sname: String::new(), along: None, center: (0.0, 0.0), mon: None, last: None });
    drop(ws);
    set_ignore(core, false);
}

fn drag_tick(core: &Core) {
    let Some(cur) = cursor(core) else { return };
    let mons = monitors(core);
    let prim = primary(core);
    let mut ws = core.win.lock().unwrap();
    if ws.drag.is_none() {
        return;
    }
    let m = mons
        .iter()
        .find(|m| cur.0 >= m.full.0 && cur.0 < m.full.0 + m.full.2 && cur.1 >= m.full.1 && cur.1 < m.full.1 + m.full.3)
        .cloned()
        .or_else(|| screen_in(&mons, prim, &ws));
    let Some(m) = m else { return };
    let (gx, gy, gw, gh) = m.work;
    let t = 46.0 * m.sf;
    let off = ws.drag.as_ref().unwrap().off;
    let center = (cur.0 - off.0, cur.1 - off.1);
    let dock = if cur.1 - gy < t {
        "top"
    } else if gy + gh - cur.1 < t {
        "bottom"
    } else if cur.0 - gx < t {
        "left"
    } else if gx + gw - cur.0 < t {
        "right"
    } else {
        "float"
    };
    let along = match dock {
        "top" | "bottom" => Some(((center.0 - gx) / gw.max(1.0)).clamp(0.0, 1.0)),
        "left" | "right" => Some(((center.1 - gy) / gh.max(1.0)).clamp(0.0, 1.0)),
        _ => None,
    };
    let (pos, mut lay) = layout_for(&ws, dock, &m, along, Some(center));
    let mv = plan_move(&mut ws, pos, m.sf);
    let d = ws.drag.as_mut().unwrap();
    d.along = along;
    d.center = center;
    d.last = Some(dock.into());
    let emit_now = d.dock.as_deref() != Some(dock) || d.sname != m.name;
    if emit_now {
        d.dock = Some(dock.into());
        d.sname = m.name.clone();
    }
    d.mon = Some(m);
    if emit_now {
        lay["dragging"] = json!(true);
        ws.layout = lay.clone();
    }
    drop(ws);
    apply_move(core, mv);
    if emit_now {
        let _ = core.app.emit("layout", lay.to_string());
    }
}

pub fn drag_end(core: &Core) {
    {
        let mut ws = core.win.lock().unwrap();
        let Some(d) = ws.drag.take() else { return };
        if let (Some(last), Some(m)) = (d.last.clone(), d.mon.clone()) {
            let (gx, gy, gw, gh) = m.work;
            ws.st["screen"] = json!(m.name);
            ws.st["dock"] = json!(last);
            if last == "float" {
                let z = ws.zoom * m.sf;
                let (mx, my) = (140.0 * z, 30.0 * z);
                let cx = d.center.0.max(gx + mx).min(gx + gw - mx);
                let cy = d.center.1.max(gy + my).min(gy + gh - my);
                ws.st["fx"] = json!((cx - gx) / gw.max(1.0));
                ws.st["fy"] = json!((cy - gy) / gh.max(1.0));
            } else {
                ws.st["along"] = json!(d.along.unwrap_or(0.5).clamp(0.03, 0.97));
            }
            save_state(&ws);
        }
    }
    place(core, false);
}

pub fn set_rect(core: &Core, x: f64, y: f64, w: f64, h: f64) {
    core.win.lock().unwrap().rect = Some([x, y, w, h]);
}

fn set_ignore(core: &Core, ignore: bool) {
    let mut ws = core.win.lock().unwrap();
    if ws.ignoring == Some(ignore) {
        return;
    }
    ws.ignoring = Some(ignore);
    drop(ws);
    if let Some(w) = core.window() {
        let _ = w.set_ignore_cursor_events(ignore);
    }
}

/// Dipanggil terus-menerus dari thread latar: seret, klik-tembus, dan posisi kursor untuk mata Notnot.
pub fn ui_loop(core: std::sync::Arc<Core>) {
    let mut last_feed = 0.0f64;
    loop {
        let dragging = core.win.lock().unwrap().drag.is_some();
        if dragging {
            drag_tick(&core);
        }
        let (visible, rect, pos, z) = {
            let ws = core.win.lock().unwrap();
            (ws.visible, ws.rect, ws.pos, ws.zoom * ws.sf.max(0.5))
        };
        if visible {
            if let Some(cur) = cursor(&core) {
                // klik-tembus di luar notch
                let inside = dragging
                    || rect
                        .map(|r| {
                            let (x0, y0) = (pos.0 + r[0] * z - 2.0, pos.1 + r[1] * z - 2.0);
                            cur.0 >= x0 && cur.1 >= y0 && cur.0 <= x0 + r[2] * z + 4.0 && cur.1 <= y0 + r[3] * z + 4.0
                        })
                        .unwrap_or(false);
                set_ignore(&core, !inside);
                // kursor untuk mata Notnot (~30x per detik)
                let t = now_s();
                if !dragging && t - last_feed > 0.033 {
                    last_feed = t;
                    let want = {
                        let c = core.cfg.lock().unwrap();
                        jbool(&c, &["mascot", "on"], true) && jbool(&c, &["mascot", "eyes"], true)
                    };
                    if want {
                        let (x, y) = (((cur.0 - pos.0) / z) as i64, ((cur.1 - pos.1) / z) as i64);
                        let mut ws = core.win.lock().unwrap();
                        let moved = ws.last_cursor.map(|l| (x - l.0).abs() >= 2 || (y - l.1).abs() >= 2).unwrap_or(true);
                        if moved {
                            ws.last_cursor = Some((x, y));
                            drop(ws);
                            let _ = core.app.emit("cursor", format!("{},{}", x, y));
                        }
                    }
                }
            }
        }
        std::thread::sleep(std::time::Duration::from_millis(if dragging { 10 } else { 16 }));
    }
}

pub fn activate(core: &Core) {
    if let Some(w) = core.window() {
        let _ = w.set_focus();
        #[cfg(windows)]
        if let Ok(h) = w.hwnd() {
            crate::sys::force_foreground(h.0 as *mut std::ffi::c_void);
        }
    }
}

pub fn keep_top(core: &Core) {
    let ws = core.win.lock().unwrap();
    if !ws.visible || ws.drag.is_some() {
        return;
    }
    drop(ws);
    #[cfg(windows)]
    if let Some(w) = core.window() {
        if let Ok(h) = w.hwnd() {
            crate::sys::keep_top(h.0 as *mut std::ffi::c_void);
        }
    }
}

pub fn force_show(core: &Core) {
    let mut ws = core.win.lock().unwrap();
    ws.force_until = now_s() + 40.0;
    if ws.fs_hidden {
        ws.fs_hidden = false;
        ws.visible = true;
        drop(ws);
        if let Some(w) = core.window() {
            let _ = w.show();
        }
    }
}

pub fn check_fullscreen(core: &Core) {
    let hide_opt = jbool(&core.cfg.lock().unwrap(), &["notch", "hideFullscreen"], false);
    let mut ws = core.win.lock().unwrap();
    let want_hide = hide_opt && now_s() > ws.force_until && ws.drag.is_none() && crate::sys::foreground_is_fullscreen();
    if want_hide && !ws.fs_hidden {
        ws.fs_hidden = true;
        ws.visible = false;
        drop(ws);
        if let Some(w) = core.window() {
            let _ = w.hide();
        }
    } else if !want_hide && ws.fs_hidden {
        ws.fs_hidden = false;
        ws.visible = true;
        drop(ws);
        if let Some(w) = core.window() {
            let _ = w.show();
        }
    }
}

/// Kalau monitor dicabut/ditambah atau resolusi berubah, atur ulang posisi.
pub fn check_monitors(core: &Core) {
    let sig = monitors(core).iter().map(|m| format!("{}:{:?}:{:?}:{}", m.name, m.full, m.work, m.sf)).collect::<Vec<_>>().join("|");
    let changed = {
        let mut ws = core.win.lock().unwrap();
        let ch = !ws.mon_sig.is_empty() && ws.mon_sig != sig;
        ws.mon_sig = sig;
        ch && ws.drag.is_none()
    };
    if changed {
        log("monitor berubah, atur ulang posisi");
        place(core, false);
    }
}

pub fn show(core: &Core) {
    core.win.lock().unwrap().visible = true;
    if let Some(w) = core.window() {
        let _ = w.show();
    }
}
